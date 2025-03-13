# Juit Capacitor Updater

This library demonstrates how to perform [Capacitor](https://capacitorjs.com/)
live updates, which update the contents of the web application without requiring
an update from the app store.

Please note that this is not intended to be production quality, but rather a
simple showcase of the interaction between different Capacitor APIs that can
be used to perform live updates.

* [Outline](#outline)
* [Functions](#functions)
  * [`updateCapacitor(...)`](#updatecapacitor)
  * [`persistUpdates()`](#persistupdates)
* [License](LICENSE.md)
* [Copyright Notice](NOTICE.md)

### Outline

When Capacitor starts, it serves the web application bundled within the binary
itself (the `.ipa` for iOS or `.apk` for Android).

The [`updateCapacitor(...)`](#updatecapacitor) function performs the following
steps:

1. Downloads a ZIP file from the specified URL.
2. Uses [JSZip](https://stuk.github.io/jszip) to extract the downloaded ZIP file
   in the [`Library`](https://capacitorjs.com/docs/apis/filesystem#directory)
   directory of the app, following Capacitor's updates naming scheme.
3. Provides a callback to reload the current web view, pointing the root to the
   extracted ZIP file.

Upon restart, the [`persistUpdates()`](#persistupdates) function can be called
to persist the server base path (where the ZIP file was extracted) and use this
for all subsequent uses of the app (e.g., when forcefully restarted).

### Functions

This library exposes two functions:

#### `updateCapacitor(...)`

The `updateCapacitor(...)` async function downloads the specified URL, extracts
it on the local device, and provides a callback to reload the web view with the
updated content. It accepts the following arguments:

* `url` _(required)_: A `string` or `URL` from which the ZIP file will be
                      downloaded.
* `progress` _(optional)_: A callback that will be invoked with a number between
                           0 and 1 indicating progress. Between 0.5, the
                           progress indicates download; between 0.5 and 1, it
                           indicates unzipping progress.
* `verbose` _(optional)_: When `true`, the update process will be logged using
                          `console.log(...)`.

When successful, this function will asynchronously return a callback
`() => Promise<void>` that needs to be invoked to reload the web view with the
updated contents.

If this function asynchronously returns `undefined`, it means that the update
could not be performed (either due to live-reload in Capacitor or when on the
web).

In case of errors during downloading or unzipping, this function will throw an
error asynchronously (returning a rejected promise).

#### `persistUpdates()`

Upon initialization of your app, always call `persistUpdates()` to ensure that
app reloads will point to the latest updated code.

This function is safe to call anytime and on any platform, as it will only
persist the path when the current server base path is indeed a directory
created during an update with [`updateCapacitor(...)`](#updatecapacitor).

This function is also asynchronous and will return a promise to a `boolean`
indicating `true` when the path has been persisted.
