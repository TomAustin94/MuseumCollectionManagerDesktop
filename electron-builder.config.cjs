/**
 * @type {import('electron-builder').Configuration}
 */
const config = {
  appId: 'com.museum.collection-manager',
  productName: 'Museum Collection Manager',
  directories: {
    buildResources: 'build',
    output: 'dist'
  },
  files: [
    'out/**/*',
    '!out/**/*.map'
  ],
  extraResources: [
    {
      from: 'node_modules/better-sqlite3/build/Release',
      to: 'better-sqlite3/build/Release'
    }
  ],
  mac: {
    target: ['dmg', 'zip'],
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
  },
  win: {
    target: ['nsis', 'portable'],
    sign: false
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  },
  publish: {
    provider: 'github',
    owner: 'museum',
    repo: 'collection-manager'
  }
}

module.exports = config
