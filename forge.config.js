const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// Load environment variables
require('dotenv').config();

module.exports = {
  packagerConfig: {
    name: 'PortCleaner',
    productName: 'PortCleaner',
    asar: true,
    icon: process.platform === 'darwin' ? './src/assets/icon.icns' : './src/assets/icon',
    appBundleId: 'com.portcleaner.app',
    appCategoryType: 'public.app-category.developer-tools',
    ignore: [
      /^\/\.github/,
      /^\/build-assets/,
      /^\/\.claude/,
      /^\/.*\.py$/,
      /^\/.*\.sh$/,
      /^\/entitlements\.plist$/,
      /^\/forge\.config\.js$/,
      /^\/\.env/,
      /^\/test-telemetry\.js$/,
      /^\/add-icon-padding\./,
      /^\/.*\.heapsnapshot$/,
      /^\/deploymenbt-mvp-plan\.md$/,
      /^\/FORCE_KILL_FEATURE\.md$/,
      /^\/UX_AUDIT\.md$/,
      /^\/SIGNING_GUIDE\.md$/
    ],
    osxSign: process.env.CERTIFICATE_IDENTITY ? {
      identity: process.env.CERTIFICATE_IDENTITY,
      'hardened-runtime': true,
      'entitlements': './entitlements.plist',
      'entitlements-inherit': './entitlements.plist',
      'signature-flags': 'library'
    } : undefined,
    osxNotarize: process.env.APPLE_ID ? {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        name: 'PortCleaner',
        title: 'PortCleaner ${version}',
        icon: './src/assets/icon.icns',
        background: './build-assets/dmg-background.png',
        format: 'ULFO',
        window: {
          size: {
            width: 540,
            height: 380
          }
        },
        contents: [
          {
            x: 140,
            y: 220,
            type: 'file',
            path: './out/PortCleaner-darwin-arm64/PortCleaner.app'
          },
          {
            x: 400,
            y: 220,
            type: 'link',
            path: '/Applications'
          }
        ]
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
