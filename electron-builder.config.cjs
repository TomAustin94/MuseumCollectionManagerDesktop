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
  // Native modules (.node files) cannot be loaded from inside an asar archive
  asarUnpack: [
    'node_modules/better-sqlite3/**',
    '**/*.node'
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
    owner: 'Radverth',
    repo: 'MuseumCollectionManagerDesktop'
  }
}

module.exports = config
