/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Options } from 'yargs';

/**
 * Default path to the xBuild configuration file.
 *
 * @remarks
 * Used as the default value for the `--config` option when no path is given.
 *
 * @since 2.0.0
 */

export const CLI_CONFIG_PATH = 'config.xbuild.ts' as const;

/**
 * Built-in CLI option definitions for xBuild, in yargs {@link Options} format.
 *
 * @remarks
 * Registered by {@link ArgvModule.enhancedParse} alongside any user-defined options, and command-line values override
 * the configuration file. Each entry sets the option's type, alias, description, and where relevant its choices or
 * default.
 *
 * @see CLI_CONFIG_PATH
 * @see CLI_USAGE_EXAMPLES
 *
 * @since 2.0.0
 */

export const CLI_DEFAULT_OPTIONS: Record<string, Options> = {
    entryPoints: {
        describe: 'Source files to build (supports glob patterns)',
        type: 'string',
        array: true
    },
    typeCheck: {
        describe: 'Perform type checking without building output',
        alias: 'tc',
        type: 'boolean'
    },
    platform: {
        describe: 'Target platform for the build output',
        alias: 'p',
        type: 'string',
        choices: [ 'browser', 'node', 'neutral' ] as const
    },
    serve: {
        describe: 'Start server to the <folder>',
        alias: 's',
        type: 'string'
    },
    outdir: {
        describe: 'Directory for build output files',
        alias: 'o',
        type: 'string'
    },
    clear: {
        describe: 'Remove the output directory before building',
        alias: 'cl',
        type: 'boolean'
    },
    declaration: {
        describe: 'Generate TypeScript declaration files (.d.ts)',
        alias: 'de',
        type: 'boolean'
    },
    watch: {
        describe: 'Watch mode - rebuild on file changes',
        alias: 'w',
        type: 'boolean'
    },
    config: {
        describe: 'Path to build configuration file',
        alias: 'c',
        type: 'string',
        default: CLI_CONFIG_PATH
    },
    tsconfig: {
        describe: 'Path to TypeScript configuration file',
        alias: 'tsc',
        type: 'string'
    },
    minify: {
        describe: 'Minify the build output',
        alias: 'm',
        type: 'boolean'
    },
    bundle: {
        describe: 'Bundle dependencies into output files',
        alias: 'b',
        type: 'boolean'
    },
    types: {
        describe: 'Enable type checking during build process',
        alias: 'btc',
        type: 'boolean'
    },
    failOnError: {
        describe: 'Fail build when TypeScript errors are detected',
        alias: 'foe',
        type: 'boolean'
    },
    format: {
        describe: 'Output module format',
        alias: 'f',
        type: 'string',
        choices: [ 'cjs', 'esm', 'iife' ]
    },
    verbose: {
        describe: 'Verbose error stack traces',
        alias: 'v',
        type: 'boolean'
    },
    build: {
        describe: 'Select an build configuration variant by names (as defined in your config file)',
        alias: 'xb',
        type: 'string',
        array: true
    }
} as const;

/**
 * Example commands shown in `--help` output.
 *
 * @remarks
 * Each entry is a `[command, description]` pair registered through yargs `example` by
 * {@link ArgvModule.enhancedParse}.
 *
 * @see CLI_DEFAULT_OPTIONS
 * @since 2.0.0
 */

export const CLI_USAGE_EXAMPLES = [
    [ 'xBuild src/index.ts', 'Build a single file with default settings' ],
    [ 'xBuild src/**/*.ts --bundle --minify', 'Bundle and minify all TypeScript files' ],
    [ 'xBuild src/app.ts -s', 'Development mode with watch and dev server' ],
    [ 'xBuild src/app.ts -s dist', 'Development mode with watch and dev server from dist folder' ],
    [ 'xBuild src/lib.ts --format esm --declaration', 'Build ESM library with type definitions' ],
    [ 'xBuild src/server.ts --platform node --outdir dist', 'Build Node.js application to dist folder' ],
    [ 'xBuild --typeCheck', 'Type check only without generating output' ],
    [ 'xBuild --config custom.xbuild.ts', 'Use custom configuration file' ]
] as const;
