/**
 * Import will remove at compile time
 */

import type { ConfigurationInterface } from '@interfaces/configuration.interface';

// todo tsdocs

export const TSCONFIG_PATH = 'tsconfig.json' as const;
export const CLI_CONFIG_PATH = 'config.xbuild.ts' as const;

export const DEFAULTS_COMMON_CONFIG: ConfigurationInterface = Object.freeze({
    verbose: false,
    variants: {},
    common: Object.freeze({
        types: true,
        declaration: true,
        esbuild: Object.freeze({
            write: true,
            bundle: true,
            minify: true,
            format: 'cjs',
            outdir: 'dist',
            platform: 'browser',
            tsconfig: TSCONFIG_PATH,
            absWorkingDir: process.cwd()
        })
    })
});
