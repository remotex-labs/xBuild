/**
 * Imports
 */

import { defineVersionedConfig } from '@viteplus/versions';

/**
 * Doc config
 */

export default defineVersionedConfig({
    title: 'xBuild',
    base: '/xBuild/',
    description: 'A versatile JavaScript and TypeScript toolchain build system',
    head: [
        [ 'link', { rel: 'icon', type: 'image/png', href: '/xBuild/logo.png' }],
        [ 'meta', { name: 'theme-color', content: '#ff7e17' }],
        [ 'script', { async: '', src: 'https://www.googletagmanager.com/gtag/js?id=G-PXPEYPM3R0' }],
        [
            'script', {},
            'window.dataLayer = window.dataLayer || [];function gtag(){ dataLayer.push(arguments); }gtag(\'js\', new Date());gtag(\'config\', \'G-PXPEYPM3R0\');'
        ]
    ],
    versionsConfig: {
        current: 'v3.0.0',
        versionSwitcher: false
    },
    themeConfig: {
        logo: '/logo.png',

        search: {
            provider: 'local'
        },

        nav: {
            root: [
                { text: 'Home', link: '/' },
                { text: 'Guide', link: '/guide' },
                {
                    text: 'Macros',
                    items: [
                        { text: 'Ifdef', link: '/macros/ifdef' },
                        { text: 'Ifndef', link: '/macros/ifndef' },
                        { text: 'Inline', link: '/macros/inline' }
                    ]
                },
                {
                    text: 'Configuration',
                    items: [
                        { text: 'CLI', link: '/configuration/cli' },
                        { text: 'File', link: '/configuration/file' },
                        { text: 'Serve', link: '/configuration/serve' },
                        { text: 'Runtime', link: '/configuration/runtime' },
                        { text: 'Lifecycle', link: '/configuration/lifecycle' }
                    ]
                },
                { component: 'VersionSwitcher' }
            ],
            'v1.x.x': [
                { text: 'Home', link: '/' },
                { text: 'Guide', link: '/guide' },
                {
                    text: 'Macros',
                    items: [{ text: 'Ifdef', link: '/macros/ifdef' }]
                },
                {
                    text: 'Configuration',
                    items: [
                        { text: 'CLI', link: '/configuration/cli' },
                        { text: 'File', link: '/configuration/file' },
                        { text: 'Serve', link: '/configuration/serve' },
                        { text: 'Lifecycle', link: '/configuration/lifecycle' }
                    ]
                },
                { component: 'VersionSwitcher' }
            ]
        },

        sidebar: {
            root: [
                { text: 'Getting Started', link: '/guide' },
                { text: 'Release Notes', link: '/release' },
                {
                    text: 'Macros',
                    collapsed: false,
                    items: [
                        { text: 'Ifdef', link: '/macros/ifdef' },
                        { text: 'Ifndef', link: '/macros/ifndef' },
                        { text: 'Inline', link: '/macros/inline' }
                    ]
                },
                {
                    text: 'Configuration',
                    collapsed: false,
                    items: [
                        { text: 'CLI', link: '/configuration/cli' },
                        { text: 'File', link: '/configuration/file' },
                        { text: 'Serve', link: '/configuration/serve' },
                        { text: 'Runtime', link: '/configuration/runtime' },
                        { text: 'Lifecycle', link: '/configuration/lifecycle' }
                    ]
                },
                {
                    text: 'Advanced',
                    collapsed: false,
                    items: [
                        { text: 'Observables', link: '/advanced/observables' },
                        { text: 'Programmatic', link: '/advanced/programmatic' }
                    ]
                }
            ],
            'v1.x.x': [
                { text: 'Getting Started', link: '/guide' },
                { text: 'Release Notes', link: '/release' },
                {
                    text: 'Macros',
                    collapsed: false,
                    items: [{ text: 'Ifdef', link: '/macros/ifdef' }]
                },
                {
                    text: 'Configuration',
                    collapsed: false,
                    items: [
                        { text: 'CLI', link: '/configuration/cli' },
                        { text: 'File', link: '/configuration/file' },
                        { text: 'Serve', link: '/configuration/serve' },
                        { text: 'Lifecycle', link: '/configuration/lifecycle' }
                    ]
                },
                {
                    text: 'Advanced',
                    collapsed: false,
                    items: [{ text: 'Programmatic', link: '/advanced/programmatic' }]
                }
            ]
        },

        socialLinks: [
            { icon: 'github', link: 'https://github.com/remotex-labs/xBuild' },
            { icon: 'npm', link: 'https://www.npmjs.com/package/@remotex-labs/xbuild' }
        ],

        docFooter: {
            prev: true,
            next: true
        },
        footer: {
            message: 'Released under the Mozilla Public License 2.0',
            copyright: `Copyright © ${ new Date().getFullYear() } @remotex-labs/xBuild Contributors`
        }
    }
});
