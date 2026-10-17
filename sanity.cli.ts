import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'c13lzzsv',
    dataset: 'production'
  },
  studioHost: 'n11-pictures',
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
    appId: 'a81r085zwh1du46on95mkmyh',
  },
})
