/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { NavItemType, SidebarItemType } from '@viteplus/versions';

/**
 * Imports
 */

import { defineVersionedConfig } from '@viteplus/versions';

/**
 * One documentation page, in the form both the nav and the sidebar accept.
 */

interface PageInterface {
    text: string;
    link: string;
}

/**
 * The pages one version carries, grouped by the section they sit under.
 */

interface VersionPagesInterface {
    macros: Array<PageInterface>;
    advanced: Array<PageInterface>;
    configuration: Array<PageInterface>;
}

/**
 * Every page any version has ever carried, named once so a version lists names rather than links.
 */

const Pages = {
    cli: { text: 'Cli', link: '/configuration/cli' },
    file: { text: 'File', link: '/configuration/file' },
    ifdef: { text: '$ifdef', link: '/macros/ifdef' },
    watch: { text: 'Watch', link: '/configuration/watch' },
    serve: { text: 'Serve', link: '/configuration/serve' },
    inline: { text: '$inline', link: '/macros/inline' },
    ifndef: { text: '$ifndef', link: '/macros/ifndef' },
    plugins: { text: 'Plugins', link: '/configuration/plugins' },
    runtime: { text: 'Runtime', link: '/configuration/runtime' },
    lifecycle: { text: 'Lifecycle', link: '/configuration/lifecycle' },
    observables: { text: 'Observables', link: '/advanced/observables' },
    programmatic: { text: 'Programmatic', link: '/advanced/programmatic' }
} as const satisfies Record<string, PageInterface>;

/**
 * The v2 layout, which v2.1.x and v2.5.x share.
 */

const LegacyPages: VersionPagesInterface = {
    macros: [ Pages.ifdef, Pages.ifndef, Pages.inline ],
    advanced: [ Pages.observables, Pages.programmatic ],
    configuration: [ Pages.cli, Pages.file, Pages.serve, Pages.runtime, Pages.lifecycle ]
};

/**
 * What each version carries, keyed by the directory it is archived under, `root` being the current line.
 *
 * @remarks
 * A version key does not inherit from `root` in `@viteplus/versions`, so each one states its whole set.
 * Stating it as pages rather than as two trees is what keeps that from being written twice per version.
 */

const VersionPages: Record<string, VersionPagesInterface> = {
    root: {
        macros: [ Pages.ifdef, Pages.ifndef, Pages.inline ],
        advanced: [ Pages.programmatic ],
        configuration: [ Pages.cli, Pages.file, Pages.watch, Pages.serve, Pages.plugins, Pages.lifecycle ]
    },
    'v2.5.x': LegacyPages,
    'v2.1.x': LegacyPages,
    'v1.x.x': {
        macros: [ Pages.ifdef ],
        advanced: [ Pages.programmatic ],
        configuration: [ Pages.cli, Pages.file, Pages.serve, Pages.lifecycle ]
    }
};

/**
 * Builds one version's top bar from the pages it carries.
 */

function navOf({ macros, configuration }: VersionPagesInterface): Array<NavItemType> {
    return [
        { text: 'Home', link: '/' },
        { text: 'Guide', link: '/guide' },
        { text: 'Macros', items: macros },
        { text: 'Configuration', items: configuration },
        { component: 'VersionSwitcher' }
    ];
}

/**
 * Builds one version's sidebar from the pages it carries.
 */

function sidebarOf({ macros, advanced, configuration }: VersionPagesInterface): Array<SidebarItemType> {
    return [
        { text: 'Getting Started', link: '/guide' },
        { text: 'Release Notes', link: '/release' },
        { text: 'Macros', collapsed: false, items: macros },
        { text: 'Configuration', collapsed: false, items: configuration },
        { text: 'Advanced', collapsed: false, items: advanced }
    ];
}

/**
 * Runs a builder over every version and keys the results the way the plugin expects.
 */

function perVersion<T>(build: (pages: VersionPagesInterface) => T): Record<string, T> {
    return Object.fromEntries(
        Object.entries(VersionPages).map(([ version, pages ]) => [ version, build(pages) ])
    );
}

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

        nav: perVersion(navOf),
        sidebar: perVersion(sidebarOf),

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
