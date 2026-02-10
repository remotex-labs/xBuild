/**
 * Import will remove at compile time
 */

import type { Options } from 'yargs';

/**
 * Default path to the TypeScript configuration file.
 *
 * @remarks
 * This constant defines the standard location for TypeScript compiler configuration.
 * Used as the default value for the `--tsconfig` CLI option when no custom path is provided.
 *
 * The tsconfig file controls TypeScript compilation settings including:
 * - Compiler options (target, module, strict mode)
 * - Include/exclude patterns
 * - Path mappings and module resolution
 * - Declaration file generation settings
 *
 * @example
 * ```ts
 * // Used internally as default
 * const tsconfig = options.tsconfig ?? TSCONFIG_PATH;
 * // Resolves to: 'tsconfig.json'
 * ```
 *
 * @since 2.0.0
 */

export const TSCONFIG_PATH = 'tsconfig.json' as const;

/**
 * Default path to the xBuild configuration file.
 *
 * @remarks
 * This constant defines the standard location for xBuild's build configuration.
 * Used as the default value for the `--config` CLI option when no custom path is provided.
 *
 * The configuration file contains:
 * - Build variant definitions (production, development, etc.)
 * - Common build settings shared across variants
 * - esbuild compiler options
 * - TypeScript integration settings
 * - Custom lifecycle hooks
 * - Define replacements and injections
 *
 * The file is a TypeScript module that exports build configuration, enabling
 * type-safe configuration with IDE autocomplete support.
 *
 * @example
 * ```ts
 * // Default usage
 * xBuild src/index.ts
 * // Automatically looks for: config.xbuild.ts
 * ```
 *
 * @example
 * ```ts
 * // Custom config path
 * xBuild src/index.ts --config build/custom.xbuild.ts
 * ```
 *
 * @since 2.0.0
 */

export const CLI_CONFIG_PATH = 'config.xbuild.ts' as const;

/**
 * Default command-line interface options and their configurations.
 *
 * @remarks
 * This constant defines all available CLI flags and arguments for the xBuild tool,
 * providing comprehensive build customization from the command line. Each option
 * includes type validation, aliases, descriptions, and default values.
 *
 * **Option Categories:**
 *
 * **Input/Output:**
 * - `entryPoints`: Source files to compile (supports glob patterns)
 * - `outdir`: Output directory for compiled files
 *
 * **Build Modes:**
 * - `watch`: Enable watch mode for automatic rebuilds
 * - `serve`: Start development server
 * - `typeCheck`: Type check only without output
 *
 * **Build Configuration:**
 * - `bundle`: Bundle dependencies into output
 * - `minify`: Minify output code
 * - `format`: Module format (cjs, esm, iife)
 * - `platform`: Target platform (browser, node, neutral)
 *
 * **TypeScript:**
 * - `declaration`: Generate .d.ts files
 * - `types`: Enable type checking during build
 * - `failOnError`: Fail build on type errors
 * - `tsconfig`: Custom tsconfig.json path
 *
 * **Configuration:**
 * - `config`: Custom build configuration file path
 * - `verbose`: Enable detailed error messages
 *
 * All options can be used individually or combined to create complex build workflows.
 * Options specified on the command line override configuration file settings.
 *
 * @example
 * ```ts
 * // Single file build with defaults
 * xBuild src/index.ts
 * ```
 *
 * @example
 * ```ts
 * // Production build with bundling and minification
 * xBuild src/app.ts --bundle --minify --format esm
 * ```
 *
 * @example
 * ```ts
 * // Development mode with watch and server
 * xBuild src/app.ts --watch --serve dist
 * ```
 *
 * @example
 * ```ts
 * // Library build with type definitions
 * xBuild src/lib.ts --declaration --format esm --outdir dist
 * ```
 *
 * @example
 * ```ts
 * // Type checking only (no output)
 * xBuild --typeCheck
 * ```
 *
 * @see {@link TSCONFIG_PATH}
 * @see {@link CLI_CONFIG_PATH}
 * @see {@link CLI_USAGE_EXAMPLES}
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
        type: 'string',
        default: TSCONFIG_PATH
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
 * Example command-line usage patterns demonstrating common build scenarios.
 *
 * @remarks
 * This constant provides a curated collection of practical CLI usage examples
 * that demonstrate how to combine xBuild options for common development workflows.
 * Each example includes the complete command and a description of its purpose.
 *
 * **Example Categories:**
 *
 * **Basic Builds:**
 * - Single file compilation with defaults
 * - Multi-file bundling with optimization
 *
 * **Development Workflows:**
 * - Watch mode with development server
 * - Custom server directory configuration
 *
 * **Library Publishing:**
 * - ESM library with type definitions
 * - Platform-specific builds
 *
 * **Validation:**
 * - Type checking without output
 * - Custom configuration files
 *
 * These examples are displayed in CLI help output and serve as quick-start
 * templates for developers learning the tool.
 *
 * @example
 * ```ts
 * // Displayed when running: xBuild --help
 * // Shows all usage examples with descriptions
 * ```
 *
 * @example
 * ```ts
 * // Example: Production library build
 * xBuild src/lib.ts --format esm --declaration
 * // Generates: dist/lib.js and dist/lib.d.ts as ESM
 * ```
 *
 * @example
 * ```ts
 * // Example: Development with hot reload
 * xBuild src/app.ts -s dist
 * // Starts: Watch mode + dev server serving from dist/
 * ```
 *
 * @see {@link CLI_DEFAULT_OPTIONS}
 *
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
