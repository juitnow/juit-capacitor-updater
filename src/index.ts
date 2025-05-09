/* eslint-disable no-console */
import { Capacitor, WebView } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import JSZip from 'jszip'

import type { FileInfo, ProgressStatus } from '@capacitor/filesystem'

/**
 * The updates directory, where the downloaded updates are stored.
 *
 * On iOS, this is the `.../Library/NoCloud/ionic_built_snapshots` directory,
 * and its path is forced by Capacitor itself when the directory is persisted.
 *
 * Basically, what happens is that upon start, Capacitor will check if the
 * server directory has been persisted, and if so it'll use the *LAST* path
 * component of the persisted directory appended to the directory below,
 * within the "Library" foled.
 *
 * So, we just append to this our UUID, and use it as the new "serverBasePath".
 *
 * See: https://github.com/ionic-team/capacitor/blob/17fe053722c8b9b3fb8b0e0c6826d2309c68c072/ios/Capacitor/Capacitor/CAPBridgeViewController.swift#L97-L109
 */
const UPDATES_DIRECTORY = 'NoCloud/ionic_built_snapshots'

/**
 * Update Capactitor contents by downloading and unzipping the specified URL.
 *
 * @param url - The URL to download the update from.
 * @returns A function that will reload the WebView with the new contents.
 * @throws If the update fails for any reason (platform is not native, using
 *         "live reload", update fails to download, read, extract, write, ...)
 */
export function updateCapacitor(url: string | URL): Promise<() => Promise<void>>

/**
 * Update Capactitor contents by downloading and unzipping the specified URL.
 *
 * @param url - The URL to download the update from.
 * @param verbose - Log the progress of the update (default: `false`).
 * @returns A function that will reload the WebView with the new contents.
 * @throws If the update fails for any reason (platform is not native, using
 *         "live reload", update fails to download, read, extract, write, ...)
 */
export function updateCapacitor(url: string | URL, verbose: boolean): Promise<() => Promise<void>>

/**
 * Update Capactitor contents by downloading and unzipping the specified URL.
 *
 * @param url - The URL to download the update from.
 * @param progress - A function to call with the progress of the update: the
 *                   function will receive a number between 0 and 1; when this
 *                   number between 0 and 0.5, the update is downloading, and
 *                   when it's between 0.5 and 1, the update is extracting.
 * @returns A function that will reload the WebView with the new contents.
 * @throws If the update fails for any reason (platform is not native, using
 *         "live reload", update fails to download, read, extract, write, ...)
 */
export function updateCapacitor(url: string | URL, progress: (progress: number) => any): Promise<() => Promise<void>>

/**
 * Update Capactitor contents by downloading and unzipping the specified URL.
 *
 * @param url - The URL to download the update from.
 * @param progress - A function to call with the progress of the update: the
 *                   function will receive a number between 0 and 1; when this
 *                   number between 0 and 0.5, the update is downloading, and
 *                   when it's between 0.5 and 1, the update is extracting.
 * @param verbose - Log the progress of the update (default: `false`).
 * @returns A function that will reload the WebView with the new contents.
 * @throws If the update fails for any reason (platform is not native, using
 *         "live reload", update fails to download, read, extract, write, ...)
 */
export function updateCapacitor(url: string | URL, progress: (progress: number) => any, verbose: boolean): Promise<() => Promise<void>>

export async function updateCapacitor(
    url: string | URL,
    progressOrVerbose?: boolean | ((progress: number) => any),
    maybeVerbose?: boolean,
): Promise<() => Promise<void>> {
  /* Parse the arguments */
  const progress = typeof progressOrVerbose === 'function' ? progressOrVerbose : () => {}
  const verbose = typeof progressOrVerbose === 'boolean' ? progressOrVerbose : !!maybeVerbose
  const log = verbose ? console.log : () => {}

  /* ===== CHECKS =========================================================== */

  if (! Capacitor.isNativePlatform()) {
    throw new Error('Update is only supported on native platforms')
  }

  if (window.location.protocol !== 'capacitor:') {
    throw new Error('Update is not supported in Capacitor LiveReload')
  }

  /* The unique identifier of this update, randomly generated */
  const uuid = crypto.randomUUID()
  /* The name of the downloaded ZIP file */
  const zipFileName = `update-${uuid}.zip`

  try {
    /* ===== DOWNLOAD AND READ ============================================== */

    /* Progress listener (leaks, we don't want to call "removeAllListeners") */
    await Filesystem.addListener('progress', (event: ProgressStatus) => {
      if (event.url !== url.toString()) return
      if (! event.bytes) return progress(0) // avoid simple division by zero
      progress((event.contentLength || event.bytes) / event.bytes / 2) // 0 - .5
    })

    /* Download the zip file */
    log(`Downloading update from "${url}" as "${zipFileName}"`)
    await Filesystem.downloadFile({
      url: url.toString(),
      path: zipFileName,
      directory: Directory.Cache,
      progress: true,
    })

    /* Read the downloaded zip file as a BASE64 string */
    log(`Reading downloaded ZIP file "${zipFileName}"`)
    const { data } = await Filesystem.readFile({
      path: zipFileName,
      directory: Directory.Cache,
      // no encoding, we'll get the BASE64 data
    })

    /* ===== UNZIP ========================================================== */

    /* Read up the downloaded ZIP file from its BASE64 contents */
    log(`Reading ZIP file contents from "${zipFileName}"`)
    const zipFile = await new JSZip().loadAsync(data, {
      base64: true, // this is what Capacitor gives us
      checkCRC32: true,
    })

    /* Extract the contents of the ZIP file, one by one */
    const entriesCount = Object.keys(zipFile.files).length
    let entryIndex = 0
    for (const zipEntry of Object.values(zipFile.files)) {
      progress(((entryIndex ++) / entriesCount / 2) + 0.5) // .5 - 1

      if (zipEntry.dir) continue // skip directories, we only want files

      /* Extract the file contents, returning a BASE64 string */
      const data = await zipEntry.async('base64')

      /* Write the extracted file to the updates directory */
      log(`Writing ZIP entry "${zipEntry.name}"`)
      await Filesystem.writeFile({
        path: `${UPDATES_DIRECTORY}/${uuid}/${zipEntry.name}`,
        directory: Directory.Library,
        recursive: true,
        data: data,
        // no encoding, let Capacitor handle the BASE64 data
      })
    }

    /* ===== DONE =========================================================== */

    /* Get the URI of the updates directory */
    const { uri } = await Filesystem.getUri({
      path: `${UPDATES_DIRECTORY}/${uuid}`,
      directory: Directory.Library,
    })

    /* Convert the URI to a path */
    const serverBasePath = normalize(uri)
    log(`Update extracted to "${serverBasePath}"`)
    progress(1) // Done!

    /* Return the function that will *reload* the WebView using the new path */
    return () => {
      log(`Setting capacitor base path to "${serverBasePath}"`)
      return WebView.setServerBasePath({ path: serverBasePath })
    }
  } finally {
    /* ===== CLEANUP ======================================================= */
    log(`Deleting ZIP file "${zipFileName}"`)
    await Filesystem.deleteFile({
      path: zipFileName,
      directory: Directory.Cache,
    })
  }
}

/**
 * Persist the current server base path if and only if it is an update path.
 *
 * This function should be called after the appication is loaded successfully,
 * and will update the server base path to the current path if it is an update.
 *
 * In this way, Capacitor will use the update path as the server base path.
 *
 * @returns A boolean indicating whether the update path was persisted or not.
 */
export async function persistUpdates(): Promise<boolean> {
  if (! Capacitor.isNativePlatform()) {
    console.warn('Update is only supported on native platforms')
    return false
  }

  if (window.location.protocol !== 'capacitor:') {
    console.warn('Update is not supported in Capacitor LiveReload')
    return false
  }

  /* Get the URI of the updates directory */
  const { uri } = await Filesystem.getUri({
    directory: Directory.Library,
    path: UPDATES_DIRECTORY,
  })

  /* Convert the URI to a path */
  const serverBasePathPrefix = normalize(uri)

  /* Get the current server base path */
  const { path } = await WebView.getServerBasePath()

  /* Figure out all entries in our updates directory */
  let files: FileInfo[]
  try {
    const result = await Filesystem.readdir({
      directory: Directory.Library,
      path: UPDATES_DIRECTORY,
    })
    files = result.files
  } catch (error) {
    console.error(`Failed to read updates directory "${UPDATES_DIRECTORY}"`, error)
    files = []
  }

  /* Delete all old updates */
  for (const file of files) {
    if (file.type !== 'directory') continue // skip files
    if (normalize(path) === normalize(file.uri)) continue // skip current update

    console.log(`Deleting old update directory "${file.name}"`)
    await Filesystem.rmdir({
      directory: Directory.Library,
      path: `${UPDATES_DIRECTORY}/${file.name}`,
      recursive: true,
    })
  }

  /* Persist the current server base path if it is an update path */
  if (path.startsWith(serverBasePathPrefix)) {
    console.log(`Persisting Capacitor updates from "${path}"`)
    await WebView.persistServerBasePath()
    return true
  } else {
    console.warn(`Cannot persist updates directory "${path}"`)
    return false
  }
}

/** Normalize a file URI or path (no double or trailing slashes) */
function normalize(uriOrPath: string): string {
  return new URL(uriOrPath, 'file:///').pathname // convert to path
      .replaceAll(/\/+/g, '/') // normalize slashes
      .replace(/\/+$/, '') // remove trailing slashes
}
