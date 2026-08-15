/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Options } from 'yargs';

/**
 * Path the `--config` option falls back to.
 *
 * @remarks
 * Resolved against the working directory, so the file is picked up by name from wherever the build was started.
 * It is the default of the option itself rather than a fallback applied afterward,
 * which is what lets every parse pass report a path whether one was typed.
 *
 * @example
 * ```ts
 * ArgsConfigPath;                            // 'config.xbuild.ts'
 * ArgsDefaultOptions.config.default;         // 'config.xbuild.ts' - the same value, reused
 * ```
 *
 * @since 3.0.0
 */

export const ArgsConfigPath = 'config.xbuild.ts' as const;

/**
 * Every option xBuild itself accepts, in the form yargs declares them.
 *
 * @remarks
 * One table serving three purposes:
 * - it declares the options for the full parse,
 * - it supplies `config` on its own to the early pass that only needs the configuration path,
 * - and its keys name the flags help gathers under the xBuild heading.
 *
 * An option added here is therefore declared, parsed, and documented by that one edit.
 * Only `config` carries a default, so every other flag is absent from the parse result unless it was typed.
 * That is what lets configuration handling tell a flag that was left out from one that was passed as `false`.
 * `platform` and `format` restrict their values, so an unrecognized one fails during parsing rather than reaching the
 * build.
 *
 * @example
 * ```ts
 * ArgsDefaultOptions.minify.alias;   // 'm'
 * ArgsDefaultOptions.format.choices; // [ 'cjs', 'esm', 'iife' ]
 * Object.keys(ArgsDefaultOptions);   // the flags listed under 'xBuild Options:' in help
 * ```
 *
 * @see ArgsConfigPath
 * @since 3.0.0
 */

export const ArgsDefaultOptions: Record<string, Options> = {
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
        default: ArgsConfigPath
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
    },
    clean: {
        describe: 'Clean build artifacts',
        type: 'boolean',
        default: false
    }
} as const;

/**
 * Command and description pairs shown in the examples section of the help output.
 *
 * @remarks
 * Registered one by one on the parser, so the order here is the order they are printed in.
 * They document the combinations worth reaching for rather than every flag,
 * the option list above already covers each flag on its own.
 *
 * @example
 * ```ts
 * ArgsUsageExamples[0]; // [ 'xBuild src/index.ts', 'Build a single file with default settings' ]
 * ```
 *
 * @see ArgsDefaultOptions
 * @since 3.0.0
 */

export const ArgsUsageExamples = [
    [ 'xBuild src/index.ts', 'Build a single file with default settings' ],
    [ 'xBuild src/**/*.ts --bundle --minify', 'Bundle and minify all TypeScript files' ],
    [ 'xBuild src/app.ts -s', 'Development mode with watch and dev server' ],
    [ 'xBuild src/app.ts -s dist', 'Development mode with watch and dev server from dist folder' ],
    [ 'xBuild src/lib.ts --format esm --declaration', 'Build ESM library with type definitions' ],
    [ 'xBuild src/server.ts --platform node --outdir dist', 'Build Node.js application to dist folder' ],
    [ 'xBuild --typeCheck', 'Type check only without generating output' ],
    [ 'xBuild --config custom.xbuild.ts', 'Use custom configuration file' ]
] as const;
