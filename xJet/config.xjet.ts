/**
 * Import will remove at compile time
 */

import type { xJetConfig } from '@remotex-labs/xjet';

/**
 * Imports
 */

import { version } from 'process';

/**
 * Config
 */

export default {
    parallel: 1,
    logLevel: 'Debug',
    build: {
        target: [ `node${ version.slice(1) }` ],
        platform: 'node',
        packages: 'bundle',
        external: [ 'typescript', 'esbuild', 'yargs', 'url' ],
        loader: {
            '.html': 'text'
        }
    }
} as xJetConfig;
