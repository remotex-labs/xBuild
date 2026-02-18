/**
 * Import will remove at compile time
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Imports
 */

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

/**
 * Config build
 */

export const config: xBuildConfig = {
    variants: {
        main: {
            define: {
                __VERSION: pkg.version
            },
            esbuild: {
                bundle: true,
                minify: true,
                format: 'esm',
                target: [ `node${ version.slice(1) }` ],
                platform: 'node',
                packages: 'external',
                sourcemap: true,
                external: [ './index.js' ],
                sourceRoot: `https://github.com/remotex-lab/xBuild/tree/v${ pkg.version }/`,
                entryPoints: {
                    bash: 'src/bash.ts',
                    index: 'src/index.ts'
                },
                loader: {
                    '.html': 'text'
                }
            }
        }
    }
};
