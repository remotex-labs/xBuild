/**
 * Imports
 */

import defineVersionedConfig from 'vitepress-versioning-plugin';

/**
 * Doc config
 */

export default defineVersionedConfig({
    title: 'xBuild',
    base: '/xBuild/',
    description: 'A versatile JavaScript and TypeScript toolchain build system',
    themeConfig: {
        versionSwitcher: false,

        nav: [
            { text: 'Home', link: '.' },
            {
                component: 'VersionSwitcher'
            }
        ],

        sidebar: {
            '/': [
                { text: 'Guide', link: '.' },
                { text: 'Hooks', link: './hooks' },
                { text: 'serve', link: './serve' },
                { text: 'Macros', link: './macros' },
                { text: 'Configuration', link: './configuration' }
            ]
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/remotex-labs/xBuild' },
            { icon: 'npm', link: 'https://www.npmjs.com/package/@remotex-labs/xbuild' }
        ],

        docFooter: {
            prev: false,
            next: false
        }
    },
    versioning: {
        latestVersion: 'v1.5.8'
    }
}, __dirname);
