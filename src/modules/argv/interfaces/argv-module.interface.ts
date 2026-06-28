/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Options } from 'yargs';
import type { Platform } from 'esbuild';

/**
 * User-defined CLI options that extend xBuild's built-in options.
 *
 * @remarks
 * Declared by a build configuration to add project-specific flags. Each key is an option name and each value a yargs
 * {@link Options} definition. {@link ArgvModule.enhancedParse} merges them with the defaults and lists them under a
 * separate "User Options" group in help. Parsed values are available to lifecycle hooks and configuration functions.
 *
 * @example
 * ```ts
 * const userExtensions: UserExtensionInterface = {
 *   env: { describe: 'Build environment', type: 'string', choices: ['dev', 'staging', 'prod'] }
 * };
 * ```
 *
 * @see ArgumentsInterface
 * @see ArgvModule.enhancedParse
 *
 * @since 2.0.0
 */

export interface UserExtensionInterface {
    /**
     * A single custom CLI option definition in yargs {@link Options} format.
     *
     * @since 2.0.0
     */

    [key: string]: Options;
}

/**
 * The fields every yargs parse result contains, regardless of the options supplied.
 *
 * @remarks
 * The foundation for {@link ArgumentsInterface}. The index signature carries named options - both defaults and user
 * extensions - alongside the standard yargs metadata.
 *
 * @see ArgumentsInterface
 * @see ArgvModule.parseConfigFile
 *
 * @since 2.0.0
 */

export interface BaseArgumentsInterface {
    /**
     * Positional arguments (values given without an option flag), typically file paths.
     *
     * @since 2.0.0
     */

    _: Array<string | number>;

    /**
     * The script name or path used to invoke the command, as reported by yargs.
     *
     * @since 2.0.0
     */

    $0: string;

    /**
     * Parsed values for any named option, drawn from the defaults or user extensions.
     *
     * @since 2.0.0
     */

    [argName: string]: unknown;
}

/**
 * Fully parsed xBuild arguments returned by {@link ArgvModule.enhancedParse}.
 *
 * @remarks
 * Extends {@link BaseArgumentsInterface} with every built-in option. All fields are optional, since any option may be
 * absent from the command line; defaults are applied later during configuration processing.
 *
 * @see BaseArgumentsInterface
 * @see UserExtensionInterface
 * @see ArgvModule.enhancedParse
 * @see CLI_DEFAULT_OPTIONS
 *
 * @since 2.0.0
 */

export interface ArgumentsInterface extends BaseArgumentsInterface {
    /**
     * Entry points included only in development builds.
     *
     * @since 2.0.0
     */

    dev?: Array<string>;

    /**
     * Run the TypeScript type checker during the build.
     *
     * @remarks
     * Reports type errors; whether they fail the build depends on {@link ArgumentsInterface.failOnError}.
     *
     * @since 2.0.0
     */

    types?: boolean;

    /**
     * Entry points included only in debug builds.
     *
     * @since 2.0.0
     */

    debug?: Array<string>;

    /**
     * Directory to serve over a local development server.
     *
     * @remarks
     * Commonly paired with {@link ArgumentsInterface.watch} for live development.
     *
     * @since 2.0.0
     */

    serve?: string;

    /**
     * Directory for build output files, overriding the esbuild `outdir`.
     *
     * @since 2.0.0
     */

    outdir?: string;

    /**
     * Remove the output directory before building.
     *
     * @remarks
     * When true, the resolved output directory is deleted so the build starts from a clean folder. Applies to the
     * {@link ArgumentsInterface.outdir} target.
     *
     * @since 2.6.0
     */

    clear?: boolean;

    /**
     * Rebuild automatically when source files change.
     *
     * @since 2.0.0
     */

    watch?: boolean;

    /**
     * Path to the build configuration file, instead of the default {@link CLI_CONFIG_PATH}.
     *
     * @since 2.0.0
     */

    config?: string;

    /**
     * Minify the build output.
     *
     * @since 2.0.0
     */

    minify?: boolean;

    /**
     * Bundle imported modules into the output instead of preserving module structure.
     *
     * @since 2.0.0
     */

    bundle?: boolean;

    /**
     * Output module format: `cjs`, `esm`, or `iife`.
     *
     * @since 2.0.0
     */

    format?: 'cjs' | 'esm' | 'iife';

    /**
     * Emit detailed build logging and full error stack traces.
     *
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Target platform: `browser`, `node`, or `neutral`.
     *
     * @remarks
     * Affects module resolution, built-in polyfills, and the default output format.
     *
     * @since 2.0.0
     */

    platform?: Platform;

    /**
     * Path to a custom `tsconfig.json` for type checking and declaration generation.
     *
     * @since 2.0.0
     */

    tsconfig?: string;

    /**
     * Type check only, without producing build output.
     *
     * @since 2.0.0
     */

    typeCheck?: boolean;

    /**
     * Emit TypeScript declaration files (`.d.ts`) alongside the output.
     *
     * @since 2.0.0
     */

    declaration?: boolean;

    /**
     * Source files to build, as paths or glob patterns.
     *
     * @remarks
     * May be given as positional arguments or via `--entryPoints`.
     *
     * @since 2.0.0
     */

    entryPoints?: Array<string>;

    /**
     * Exit with a non-zero code when type checking finds errors.
     *
     * @remarks
     * Used with {@link ArgumentsInterface.types}; when false, errors are logged and the build continues.
     *
     * @since 2.0.0
     */

    failOnError?: boolean;

    /**
     * Names of the configuration variants to build.
     *
     * @remarks
     * When omitted, every variant in the configuration file is built; when given, only the named variants are. Accepts
     * multiple values, and a name that does not exist is a build error.
     *
     * @example
     * ```ts
     * // xBuild --build development --build staging
     * ```
     *
     * @see CLI_CONFIG_PATH
     * @since 2.0.0
     */

    build?: Array<string>;
}
