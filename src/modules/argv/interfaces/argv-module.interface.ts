/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Options } from 'yargs';
import type { Platform } from 'esbuild';

/**
 * Options a configuration file adds to the command line.
 *
 * @remarks
 * Each key becomes a flag and each value declares it the way yargs does, so a configuration reaches the same type,
 * alias, and validation handling xBuild's own options get.
 * They are registered alongside the built-in options and listed under a heading of their own in help, which is what
 * keeps a project's flags distinguishable from the tool's.
 *
 * @example
 * ```ts
 * const userExtensions: UserExtensionInterface = {
 *     env: { describe: 'Build environment', type: 'string', choices: [ 'dev', 'prod' ] }
 * };
 *
 * argv.enhancedParse(process.argv, userExtensions).env; // 'prod'
 * ```
 *
 * @see ArgumentsInterface
 * @since 2.0.0
 */

export interface UserExtensionInterface {
    /**
     * Declaration of one added flag, named by its key.
     *
     * @remarks
     * A yargs `Options` object, so type, alias, default, and choices all mean what they mean there.
     *
     * @example
     * ```ts
     * userExtensions.env; // { describe: 'Build environment', type: 'string', choices: [ 'dev', 'prod' ] }
     * ```
     *
     * @since 2.0.0
     */

    [key: string]: Options;
}

/**
 * What every parse produces, whatever options were declared.
 *
 * @remarks
 * The two fields yargs always fills, plus an index signature for the flags a given pass happened to declare.
 * It is what the early passes return, their option set being deliberately partial, and what
 * {@link ArgumentsInterface} builds on once the whole set is known.
 *
 * @example
 * ```ts
 * // xBuild src/app.ts src/worker.ts
 * args._;  // [ 'src/app.ts', 'src/worker.ts' ]
 * args.$0; // 'xBuild'
 * ```
 *
 * @see ArgumentsInterface
 * @since 2.0.0
 */

export interface BaseArgumentsInterface {
    /**
     * Values given without a flag in front of them.
     *
     * @remarks
     * Numbers as well as strings, yargs converting a value that reads as one.
     * In the full parse these are claimed by the default command and surface as `entryPoints` instead, so what
     * remains here is whatever that command did not take.
     *
     * @example
     * ```ts
     * args._; // [ 'src/app.ts' ]
     * ```
     *
     * @since 2.0.0
     */

    _: Array<string | number>;

    /**
     * Name the script was invoked as.
     *
     * @remarks
     * Filled by yargs and used in the usage line it prints.
     *
     * @example
     * ```ts
     * args.$0; // 'xBuild'
     * ```
     *
     * @since 2.0.0
     */

    $0: string;

    /**
     * Any other flag the parse declared.
     *
     * @remarks
     * Open-ended because a configuration file can add flags this package never sees, so what a result carries is
     * decided at run time rather than by this declaration.
     *
     * @example
     * ```ts
     * args['env']; // 'prod' - a flag a configuration added
     * ```
     *
     * @since 2.0.0
     */

    [argName: string]: unknown;
}

/**
 * The result of the full parse, with xBuild's own options named.
 *
 * @remarks
 * Every field is optional: an option that was not typed is absent rather than defaulted, defaults being applied while
 * the configuration is resolved, so this type describes what was asked for rather than what the build settles on.
 * Flags a configuration file added are reachable through the inherited index signature.
 *
 * @example
 * ```ts
 * // xBuild src/index.ts --bundle --minify --format esm
 * args.entryPoints; // [ 'src/index.ts' ]
 * args.bundle;      // true
 * args.watch;       // undefined - not typed, not defaulted
 * ```
 *
 * @see ArgsDefaultOptions
 * @see BaseArgumentsInterface
 *
 * @since 2.0.0
 */

export interface ArgumentsInterface extends BaseArgumentsInterface {
    /**
     * Entry points reserved for development builds.
     *
     * @remarks
     * Declared for configuration handling to read.
     * No command-line flag produces it, so it never arrives from a parse.
     *
     * @example
     * ```ts
     * args.dev; // [ 'src/dev-tools.ts' ]
     * ```
     *
     * @since 2.0.0
     */

    dev?: Array<string>;

    /**
     * Whether to type check while building.
     *
     * @remarks
     * Runs the checker alongside the build rather than instead of it, which is what separates it from
     * {@link typeCheck}.
     * Whether a reported error stops the build is {@link failOnError}'s to decide.
     *
     * @example
     * ```ts
     * args.types; // true - typed as --types or --btc
     * ```
     *
     * @since 2.0.0
     */

    types?: boolean;

    /**
     * Entry points reserved for debug builds.
     *
     * @remarks
     * Declared for configuration handling to read.
     * No command-line flag produces it, so it never arrives from a parse.
     *
     * @example
     * ```ts
     * args.debug; // [ 'src/debug-logger.ts' ]
     * ```
     *
     * @since 2.0.0
     */

    debug?: Array<string>;

    /**
     * Directory to serve the build output from.
     *
     * @remarks
     * Carries the directory rather than a flag, so serving and choosing where to serve from are the one option.
     *
     * @example
     * ```ts
     * args.serve; // 'dist'
     * ```
     *
     * @since 2.0.0
     */

    serve?: string;

    /**
     * Directory the build output is written to.
     *
     * @remarks
     * Overrides whatever the configuration set, the command line being the later word.
     *
     * @example
     * ```ts
     * args.outdir; // 'dist'
     * ```
     *
     * @since 2.0.0
     */

    outdir?: string;

    /**
     * Whether to rebuild as files change.
     *
     * @example
     * ```ts
     * args.watch; // true
     * ```
     *
     * @since 2.0.0
     */

    watch?: boolean;

    /**
     * Path of the configuration file to load.
     *
     * @remarks
     * The one option read before the others, {@link ArgsConfigPath} standing in when it is not typed, so it is always
     * present in a parsed result.
     *
     * @example
     * ```ts
     * args.config; // 'config.xbuild.ts'
     * ```
     *
     * @since 2.0.0
     */

    config?: string;

    /**
     * Whether to minify the output.
     *
     * @example
     * ```ts
     * args.minify; // true
     * ```
     *
     * @since 2.0.0
     */

    minify?: boolean;

    /**
     * Whether to pull imported modules into the output.
     *
     * @remarks
     * Left unset, the module structure is preserved and the imports have to resolve at run time instead.
     *
     * @example
     * ```ts
     * args.bundle; // true
     * ```
     *
     * @since 2.0.0
     */

    bundle?: boolean;

    /**
     * Module format the output is written in.
     *
     * @remarks
     * Checked while parsing, so a value outside the three fails on the command line rather than in the build.
     *
     * @example
     * ```ts
     * args.format; // 'esm'
     * ```
     *
     * @since 2.0.0
     */

    format?: 'cjs' | 'esm' | 'iife';

    /**
     * Whether to report errors with their stack traces.
     *
     * @example
     * ```ts
     * args.verbose; // true
     * ```
     *
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Runtime the output targets.
     *
     * @remarks
     * Decides how modules resolve and which built-ins are assumed, `neutral` assuming neither browser nor Node.
     * Checked while parsing, like {@link format}.
     *
     * @example
     * ```ts
     * args.platform; // 'node'
     * ```
     *
     * @since 2.0.0
     */

    platform?: Platform;

    /**
     * Path of the TypeScript configuration to use.
     *
     * @remarks
     * Governs both the type check and the declarations, the two coming from the same compiler.
     *
     * @example
     * ```ts
     * args.tsconfig; // 'tsconfig.build.json'
     * ```
     *
     * @since 2.0.0
     */

    tsconfig?: string;

    /**
     * Whether to type check instead of building.
     *
     * @remarks
     * Nothing is emitted, which is what separates it from {@link types}.
     *
     * @example
     * ```ts
     * args.typeCheck; // true - typed as --typeCheck or --tc
     * ```
     *
     * @since 2.0.0
     */

    typeCheck?: boolean;

    /**
     * Whether to emit declaration files beside the output.
     *
     * @example
     * ```ts
     * args.declaration; // true
     * ```
     *
     * @since 2.0.0
     */

    declaration?: boolean;

    /**
     * Files to build, glob patterns included.
     *
     * @remarks
     * Filled from the files named without a flag as well as from `--entryPoints`, so the usual invocation needs no
     * flag at all.
     *
     * @example
     * ```ts
     * args.entryPoints; // [ 'src/index.ts' ]
     * ```
     *
     * @since 2.0.0
     */

    entryPoints?: Array<string>;

    /**
     * Whether a type error should stop the build.
     *
     * @remarks
     * Reads on the errors {@link types} produces: left unset they are reported and the build carries on.
     *
     * @example
     * ```ts
     * args.failOnError; // true - typed as --failOnError or --foe
     * ```
     *
     * @since 2.0.0
     */

    failOnError?: boolean;

    /**
     * Names of the configuration's build variants to run.
     *
     * @remarks
     * Left unset, every variant the configuration defines is built.
     * Naming some builds only those, which is what a pipeline that ships one target at a time wants.
     * Repeat the flag to name more than one.
     *
     * @example
     * ```ts
     * // xBuild --build development --xb staging
     * args.build; // [ 'development', 'staging' ]
     * ```
     *
     * @see ArgsConfigPath
     * @since 2.0.0
     */

    build?: Array<string>;

    /**
     * Whether to clear the artifacts of an earlier build before this one runs.
     *
     * @remarks
     * The one option the parser gives a default,
     * so a result carries `false` where the flag was not typed rather than leaving it out as the others do.
     * Nothing reads it yet, so typing it changes a parsed result and nothing else.
     *
     * @example
     * ```ts
     * args.clean; // true - typed as --clean
     * ```
     *
     * @since 3.0.0
     */

    clean?: boolean;
}
