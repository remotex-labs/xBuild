/**
 * Import will remove at compile time
 */

import type { Options } from 'yargs';
import type { Platform } from 'esbuild';

/**
 * User-defined command-line options that extend the base xBuild CLI.
 *
 * @remarks
 * This interface allows build configurations to define custom CLI arguments beyond
 * xBuild's built-in options. Each key represents an option name, and each value
 * is a yargs `Options` object defining the argument's type, description, aliases,
 * and validation rules.
 *
 * User extensions enable:
 * - Project-specific build flags (e.g., `--env`, `--feature`)
 * - Custom output configurations
 * - Integration with external tools
 * - Conditional build behavior based on CLI arguments
 *
 * These options are merged with xBuild's default options and appear in the help
 * output under a separate "User Options" section for clarity.
 *
 * The parsed values are accessible in lifecycle hooks and configuration functions,
 * allowing dynamic build behavior based on command-line input.
 *
 * @example
 * ```ts
 * const userExtensions: UserExtensionInterface = {
 *   env: {
 *     describe: 'Build environment',
 *     type: 'string',
 *     choices: ['dev', 'staging', 'prod'],
 *     default: 'dev'
 *   },
 *   feature: {
 *     describe: 'Enable experimental features',
 *     type: 'boolean',
 *     alias: 'f'
 *   }
 * };
 * ```
 *
 * @example
 * ```ts
 * // In build configuration
 * export default {
 *   userArgv: {
 *     deploy: {
 *       describe: 'Deploy after build',
 *       type: 'boolean'
 *     },
 *     target: {
 *       describe: 'Deployment target',
 *       type: 'string',
 *       choices: ['staging', 'production']
 *     }
 *   },
 *   variants: { ... }
 * };
 * ```
 *
 * @see {@link ArgumentsInterface}
 * @see {@link ArgvModule.enhancedParse}
 *
 * @since 2.0.0
 */

export interface UserExtensionInterface {
    /**
     * Custom CLI option definition.
     *
     * @remarks
     * Each property defines a command-line argument with its type, description,
     * aliases, and validation using yargs `Options` format.
     *
     * @since 2.0.0
     */

    [key: string]: Options;
}

/**
 * Base structure for parsed command-line arguments from yargs.
 *
 * @remarks
 * This interface represents the minimal structure that all yargs-parsed argument
 * objects contain, regardless of specific options. It includes the standard yargs
 * metadata fields that are always present after parsing.
 *
 * **Standard fields:**
 * - `_`: Positional arguments (non-option values)
 * - `$0`: The script name or path that was executed
 * - Additional dynamic properties for named options
 *
 * This interface serves as the foundation for more specific argument interfaces
 * like `ArgumentsInterface`, which extends it with xBuild-specific options.
 *
 * The index signature allows any additional properties to accommodate both
 * xBuild's default options and user-defined extensions without losing type safety
 * for the core yargs metadata.
 *
 * @example
 * ```ts
 * // Minimal parsed arguments
 * const args: BaseArgumentsInterface = {
 *   _: ['src/index.ts'],
 *   $0: 'xBuild',
 *   config: 'custom.config.ts'
 * };
 * ```
 *
 * @example
 * ```ts
 * // With positional arguments
 * // Command: xBuild src/app.ts src/worker.ts
 * const args: BaseArgumentsInterface = {
 *   _: ['src/app.ts', 'src/worker.ts'],
 *   $0: '/usr/local/bin/xBuild'
 * };
 * ```
 *
 * @see {@link ArgumentsInterface}
 * @see {@link ArgvModule.parseConfigFile}
 *
 * @since 2.0.0
 */

export interface BaseArgumentsInterface {
    /**
     * Positional arguments (non-option values).
     *
     * @remarks
     * Contains values provided without option flags. Typically, it includes
     * file paths or commands. Can be strings or numbers depending on parsing context.
     *
     * @example
     * ```ts
     * // Command: xBuild src/index.ts src/utils.ts
     * // _: ['src/index.ts', 'src/utils.ts']
     * ```
     *
     * @since 2.0.0
     */

    _: Array<string | number>;

    /**
     * The script name or path that was executed.
     *
     * @remarks
     * Represents the command used to invoke the script, typically the executable
     * name or full path. Used by yargs to help text generation.
     *
     * @example
     * ```ts
     * $0: 'xBuild'              // When invoked as 'xBuild'
     * $0: '/usr/bin/xBuild'     // Full path
     * $0: 'node build.js'       // When run with Node.js
     * ```
     *
     * @since 2.0.0
     */

    $0: string;

    /**
     * Dynamic properties for parsed command-line options.
     *
     * @remarks
     * Allows any additional properties to represent both xBuild's default options
     * and user-defined extensions. The actual properties present depend on the
     * options configuration and arguments provided.
     *
     * @since 2.0.0
     */

    [argName: string]: unknown;
}

/**
 * Complete parsed command-line arguments including all xBuild options.
 *
 * @remarks
 * This interface extends the base yargs structure with all xBuild-specific CLI
 * options. It represents the fully parsed arguments after running `enhancedParse`
 * with both default options and any user extensions.
 *
 * **Argument categories:**
 *
 * **Input/Output:**
 * - `entryPoints`: Source files to compile
 * - `outdir`: Output directory path
 *
 * **Build Modes:**
 * - `watch`: Enable watch mode for auto-rebuild
 * - `serve`: Start development server (with optional directory)
 * - `typeCheck`: Type check only without output
 *
 * **Build Configuration:**
 * - `bundle`: Bundle dependencies into output
 * - `minify`: Minify output code
 * - `format`: Module format (cjs, esm, iife)
 * - `platform`: Target platform (browser, node, neutral)
 *
 * **TypeScript:**
 * - `types`: Enable type checking during build
 * - `declaration`: Generate .d.ts files
 * - `failOnError`: Fail build on type errors
 * - `tsconfig`: Custom tsconfig path
 *
 * **Configuration:**
 * - `config`: Build configuration file path
 * - `verbose`: Enable detailed logging
 * - `debug`: Debug-specific entry points
 * - `dev`: Development-specific entry points
 *
 * All properties are optional since they may not be provided on the command line.
 * Default values are applied during configuration processing, not during parsing.
 *
 * @example
 * ```ts
 * // Production build
 * const args: ArgumentsInterface = {
 *   _: [],
 *   $0: 'xBuild',
 *   entryPoints: ['src/index.ts'],
 *   bundle: true,
 *   minify: true,
 *   format: 'esm',
 *   outdir: 'dist',
 *   declaration: true
 * };
 * ```
 *
 * @example
 * ```ts
 * // Development mode
 * const args: ArgumentsInterface = {
 *   _: [],
 *   $0: 'xBuild',
 *   entryPoints: ['src/app.ts'],
 *   watch: true,
 *   serve: 'dist',
 *   types: true
 * };
 * ```
 *
 * @example
 * ```ts
 * // Type check only
 * const args: ArgumentsInterface = {
 *   _: [],
 *   $0: 'xBuild',
 *   typeCheck: true,
 *   tsconfig: 'tsconfig.strict.json'
 * };
 * ```
 *
 * @see {@link BaseArgumentsInterface}
 * @see {@link UserExtensionInterface}
 * @see {@link ArgvModule.enhancedParse}
 * @see {@link CLI_DEFAULT_OPTIONS}
 *
 * @since 2.0.0
 */

export interface ArgumentsInterface extends BaseArgumentsInterface {
    /**
     * Development-specific entry points for conditional builds.
     *
     * @remarks
     * Optional array of file paths used only in development builds. Allows
     * including additional files (like dev tools, mock data) that shouldn't
     * be in production builds.
     *
     * @example
     * ```ts
     * dev: ['src/dev-tools.ts', 'src/mocks.ts']
     * ```
     *
     * @since 2.0.0
     */

    dev?: Array<string>;

    /**
     * Enable TypeScript type checking during the build process.
     *
     * @remarks
     * When true, runs TypeScript type checker in parallel with esbuild compilation.
     * Type errors are reported but may not fail the build depending on `failOnError`.
     *
     * @example
     * ```ts
     * types: true  // Enable type checking
     * ```
     *
     * @since 2.0.0
     */

    types?: boolean;

    /**
     * Debug-specific entry points for conditional builds.
     *
     * @remarks
     * Optional array of file paths used only in debug builds. Useful for including
     * debugging utilities, loggers, or diagnostic tools.
     *
     * @example
     * ```ts
     * debug: ['src/debug-logger.ts']
     * ```
     *
     * @since 2.0.0
     */

    debug?: Array<string>;

    /**
     * Start development server serving from specified directory.
     *
     * @remarks
     * When provided, starts a local HTTP server to serve build output. The value
     * specifies which directory to serve. Commonly used with watch mode for
     * live development.
     *
     * @example
     * ```ts
     * serve: 'dist'        // Serve from dist/
     * serve: 'public'      // Serve from public/
     * ```
     *
     * @since 2.0.0
     */

    serve?: string;

    /**
     * Directory for build output files.
     *
     * @remarks
     * Specifies where compiled files should be written. Overrides the `outdir`
     * setting in esbuild configuration when provided.
     *
     * @example
     * ```ts
     * outdir: 'dist'
     * outdir: 'build/output'
     * ```
     *
     * @since 2.0.0
     */

    outdir?: string;

    /**
     * Enable watch mode to rebuild on file changes.
     *
     * @remarks
     * When true, the build system watches source files and automatically rebuilds
     * when changes are detected. Often used with `serve` for development workflows.
     *
     * @example
     * ```ts
     * watch: true  // Enable watch mode
     * ```
     *
     * @since 2.0.0
     */

    watch?: boolean;

    /**
     * Path to build a configuration file.
     *
     * @remarks
     * Specifies a custom configuration file instead of the default `config.xbuild.ts`.
     * The file must export a valid `BuildConfigInterface` object.
     *
     * @example
     * ```ts
     * config: 'build/custom.xbuild.ts'
     * config: 'configs/prod.config.ts'
     * ```
     *
     * @since 2.0.0
     */

    config?: string;

    /**
     * Enable minification of build output.
     *
     * @remarks
     * When true, applies code minification including whitespace removal, name
     * mangling, and dead code elimination. Typically used for production builds.
     *
     * @example
     * ```ts
     * minify: true  // Minify output
     * ```
     *
     * @since 2.0.0
     */

    minify?: boolean;

    /**
     * Bundle dependencies into output files.
     *
     * @remarks
     * When true, includes all imported modules in the output. When false, preserves
     * module structure and requires dependencies to be available at runtime.
     *
     * @example
     * ```ts
     * bundle: true   // Bundle everything
     * bundle: false  // Preserve module structure
     * ```
     *
     * @since 2.0.0
     */

    bundle?: boolean;

    /**
     * Output module format for generated code.
     *
     * @remarks
     * Specifies the JavaScript module system to use:
     * - `cjs`: CommonJS (require/module.exports)
     * - `esm`: ECMAScript modules (import/export)
     * - `iife`: Immediately Invoked Function Expression (for browsers)
     *
     * @example
     * ```ts
     * format: 'esm'   // ES modules
     * format: 'cjs'   // CommonJS
     * format: 'iife'  // Browser bundle
     * ```
     *
     * @since 2.0.0
     */

    format?: 'cjs' | 'esm' | 'iife';

    /**
     * Enable verbose logging output during builds.
     *
     * @remarks
     * When true, outputs detailed build information including file processing,
     * hook execution, timing, and diagnostic messages. Useful for debugging.
     *
     * @example
     * ```ts
     * verbose: true  // Detailed output
     * ```
     *
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Target platform for the build output.
     *
     * @remarks
     * Specifies the runtime environment:
     * - `browser`: Web browser environment
     * - `node`: Node.js environment
     * - `neutral`: Platform-agnostic (no platform-specific APIs)
     *
     * Affects module resolution, built-in polyfills, and output format.
     *
     * @example
     * ```ts
     * platform: 'node'     // Node.js target
     * platform: 'browser'  // Browser target
     * platform: 'neutral'  // Universal
     * ```
     *
     * @since 2.0.0
     */

    platform?: Platform;

    /**
     * Path to TypeScript configuration file.
     *
     * @remarks
     * Specifies a custom tsconfig.json instead of the default. Used for both
     * type checking and declaration generation.
     *
     * @example
     * ```ts
     * tsconfig: 'tsconfig.build.json'
     * tsconfig: 'configs/tsconfig.strict.json'
     * ```
     *
     * @since 2.0.0
     */

    tsconfig?: string;

    /**
     * Perform type checking without building output.
     *
     * @remarks
     * When true, runs TypeScript type checker only without executing esbuild
     * compilation. Useful for validating types in CI/CD pipelines or pre-commit hooks.
     *
     * @example
     * ```ts
     * typeCheck: true  // Type check only, no output
     * ```
     *
     * @since 2.0.0
     */

    typeCheck?: boolean;

    /**
     * Generate TypeScript declaration files (.d.ts).
     *
     * @remarks
     * When true, emits TypeScript declaration files alongside JavaScript output.
     * Used for library builds to provide type information to consumers.
     *
     * @example
     * ```ts
     * declaration: true  // Generate .d.ts files
     * ```
     *
     * @since 2.0.0
     */

    declaration?: boolean;

    /**
     * Source files to build (supports glob patterns).
     *
     * @remarks
     * Array of file paths or glob patterns identifying build entry points.
     * Can be provided as positional arguments or via the `--entryPoints` flag.
     *
     * @example
     * ```ts
     * entryPoints: ['src/index.ts']
     * entryPoints: ['src/*.ts', 'src/workers/*.ts']
     * ```
     *
     * @since 2.0.0
     */

    entryPoints?: Array<string>;

    /**
     * Fail build when TypeScript errors are detected.
     *
     * @remarks
     * When true, exits with non-zero code if type checking finds errors.
     * When false, logs errors but continues the build. Used with `types: true`.
     *
     * @example
     * ```ts
     * failOnError: true   // Fail on type errors
     * failOnError: false  // Log errors, continue build
     * ```
     *
     * @since 2.0.0
     */

    failOnError?: boolean;

    /**
     * Array of build variant names to compile from the configuration file.
     *
     * @remarks
     * Specifies which build variants defined in the xBuild configuration should be executed.
     * Build variants allow you to define multiple build configurations (e.g., production, development,
     * testing) in a single configuration file and selectively compile them via the CLI.
     *
     * **Behavior:**
     * - If not specified: All variants in the configuration file are built
     * - If specified: Only the named variants are compiled
     * - Supports multiple values: Can specify multiple variants in a single command
     * - Non-existent variants: Will result in a build error if specified variant doesn't exist
     *
     * **Common use cases:**
     * - Building-only production bundles: `--build production`
     * - Building multiple specific variants: `--build development --build staging`
     * - Selective compilation in CI/CD pipelines
     * - Testing specific build configurations during development
     *
     * Build variants are defined in the xBuild configuration file and can include different:
     * - Entry points and output directories
     * - Compiler options (minification, bundling, source maps)
     * - Target platforms and formats
     * - Environment-specific settings
     *
     * @example
     * ```ts
     * // Build only the production variant
     * xBuild --build production
     * ```
     *
     * @example
     * ```ts
     * // Build multiple specific variants
     * xBuild --build development --build staging
     * // Or using the alias:
     * xBuild --xb development --xb staging
     * ```
     *
     * @example
     * ```ts
     * // Configuration file with variants
     * export default {
     *   variants: {
     *     production: {
     *       entryPoints: ['src/index.ts'],
     *       minify: true,
     *       bundle: true
     *     },
     *     development: {
     *       entryPoints: ['src/index.ts'],
     *       sourcemap: true
     *     }
     *   }
     * };
     *
     * // Build only production
     * xBuild --build production
     * ```
     *
     * @see {@link CLI_CONFIG_PATH} for configuration file location
     *
     * @since 2.0.0
     */

    build?: Array<string>;
}
