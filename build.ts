import { plugjs, tasks } from '@plugjs/build'

export default plugjs({
  ...tasks({ cjs: false, esmExtension: '.js' }),

  async all(): Promise<void> {
    await this.transpile()
    await this.lint()
  },
})
