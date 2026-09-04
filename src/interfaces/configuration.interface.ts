/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BuildOptions } from 'esbuild';
import type { LogOverridesType } from '@providers/interfaces/log-provider.interface';
import type { RuntimeHandlerType, PrimitiveOrObjectType } from '@interfaces/types.interface';
import type { LifecycleHooksInterface, LifecyclePluginInterface } from '@interfaces/lifecycle.interface';

/**
 * The esbuild options a configuration is allowed to state.
 *
 * @remarks
 * esbuild's own options, less the ones this package assembles itself.
 * Plugins, defines, banners, footers, and the two logging settings are all built from the fields beside `esbuild`,
 * so a build has a single place to state each of them and no way to state one twice.
 *
 * @example
 * ```ts
 * const options: EsbuildOptionsType = { minify: true, format: 'esm', target: 'node20' };
 * ```
 *
 * @see BaseConfigurationInterface
 * @since 3.0.0
 */

export type EsbuildOptionsType = Omit<
    BuildOptions,
    'plugins' | 'define' | 'banner' | 'footer' | 'logOverride' | 'logLevel'
>;

/**
 * Code injected into the output, either written out or produced when the build runs.
 *
 * @remarks
 * A string is injected as it stands, while a function is called at build time and its result injected instead,
 * which is what lets a banner carry a version or a timestamp the configuration file cannot know.
 *
 * @example
 * ```ts
 * const fixed: InjectableCodeType = '#!/usr/bin/env node';
 * const dynamic: InjectableCodeType = (name, args) => args.production === true;
 * ```
 *
 * @see RuntimeHandlerType
 * @since 3.0.0
 */

export type InjectableCodeType = string | RuntimeHandlerType;

/**
 * How declaration files are emitted for a build that wants more than on or off.
 *
 * @remarks
 * The long form of `declaration`, reached only when the plain boolean will not do.
 *
 * @example
 * ```ts
 * const declaration: DeclarationOptionsInterface = { outDir: 'types' };
 * ```
 *
 * @see BaseConfigurationInterface
 * @since 2.0.0
 */

export interface DeclarationOptionsInterface {
    /**
     * Directory the declarations are written to.
     *
     * @remarks
     * Overrides what the TypeScript configuration would have chosen, so declarations can land apart from the code
     * without editing `tsconfig.json`.
     *
     * @example
     * ```ts
     * { outDir: 'types' } // dist/index.js beside types/index.d.ts
     * ```
     *
     * @since 2.0.0
     */

    outDir?: string;
}

/**
 * How type checking behaves for a build that wants more than on or off.
 *
 * @remarks
 * The long form of `types`, reached only when the plain boolean will not do.
 *
 * @example
 * ```ts
 * const types: TypeCheckOptionsInterface = { failOnError: true };
 * ```
 *
 * @see BaseConfigurationInterface
 * @since 2.0.0
 */

export interface TypeCheckOptionsInterface {
    /**
     * Whether a type error stops the build rather than only being reported.
     *
     * @remarks
     * Left off, a build carries on and emits despite the errors, which suits a watch cycle where the report is enough.
     *
     * @example
     * ```ts
     * { failOnError: true } // a type error fails the run
     * ```
     *
     * @since 2.0.0
     */

    failOnError?: boolean;
}

/**
 * The settings a build understands, shared by the common block and every variant.
 *
 * @remarks
 * Every field is optional here, so a variant states only what it changes and inherits the rest from `common`.
 * The esbuild options it carries are stripped of the ones this package owns, since those are assembled from the
 * fields beside them rather than passed through.
 *
 * @example
 * ```ts
 * const common: BaseConfigurationInterface = {
 *     types: true,
 *     declaration: { outDir: 'types' },
 *     esbuild: { minify: true, target: 'esnext' }
 * };
 * ```
 *
 * @see VariantConfigurationInterface
 * @since 3.0.0
 */

export interface BaseConfigurationInterface {
    /**
     * Whether the build type-checks and how strictly.
     *
     * @remarks
     * `true` checks and reports. The object form also decides whether an error stops the build.
     *
     * @example
     * ```ts
     * { types: true }                       // check and report
     * { types: { failOnError: true } }      // check and fail on an error
     * ```
     *
     * @see TypeCheckOptionsInterface
     * @since 2.0.0
     */

    types?: boolean | TypeCheckOptionsInterface;

    /**
     * The hooks this configuration attaches to a build.
     *
     * @remarks
     * One set per configuration, merged hook by hook with whatever `common` supplied,
     * so a variant naming a hook replaces that hook alone and leaves the rest of the shared set standing.
     * Where a build wants several named sets instead, `plugins` takes a list of them.
     * {@link LifecycleHooksInterface} documents what each hook receives and when it runs.
     *
     * @example
     * ```ts
     * { lifecycle: { onEnd: ({ duration }) => report(duration) } }
     * ```
     *
     * @see LifecycleHooksInterface
     * @since 3.0.0
     */

    lifecycle?: LifecycleHooksInterface;

    /**
     * The plugins this configuration attaches to a build.
     *
     * @remarks
     * Each is a named set of the same hooks that `lifecycle` takes, and the list applies in the order written.
     * A variant appends to the list `common` supplied rather than replacing it,
     * so a shared plugin runs ahead of the one a variant adds for itself.
     *
     * @example
     * ```ts
     * { plugins: [ timing, copyAssets ] } // timing first, then copyAssets
     * ```
     *
     * @see LifecyclePluginInterface
     * @since 3.0.0
     */

    plugins?: Array<LifecyclePluginInterface>;

    /**
     * Values substituted into the source wherever their name appears.
     *
     * @remarks
     * A plain value is substituted as written, while a function is called at build time and its result substituted
     * instead, so a substituted value can follow a flag.
     *
     * @example
     * ```ts
     * { define: { __VERSION: '1.0.0', __DEV: (name, args) => args.watch === true } }
     * ```
     *
     * @see RuntimeHandlerType
     * @since 3.0.0
     */

    define?: Record<string, PrimitiveOrObjectType | RuntimeHandlerType>;

    /**
     * Code placed at the top of each output file, keyed by the format it belongs to.
     *
     * @example
     * ```ts
     * { banner: { js: '#!/usr/bin/env node' } }
     * ```
     *
     * @see InjectableCodeType
     * @since 2.0.0
     */

    banner?: Record<string, InjectableCodeType>;

    /**
     * Code placed at the bottom of each output file, keyed by the format it belongs to.
     *
     * @example
     * ```ts
     * { footer: { js: '//# sourceMappingURL=index.js.map' } }
     * ```
     *
     * @see InjectableCodeType
     * @since 2.0.0
     */

    footer?: Record<string, InjectableCodeType>;

    /**
     * Severity to report a given esbuild message under.
     *
     * @remarks
     * Keyed by esbuild's own message name, so a warning a project has decided to live with can be silenced without
     * silencing the rest.
     * A key carrying regular-expression syntax is read as an anchored pattern instead of as a name,
     * which is how a family of messages is claimed by one entry.
     *
     * @example
     * ```ts
     * { logOverride: { 'direct-eval': 'silent' } }        // this message alone
     * { logOverride: { 'TS-2\\d{3}': 'warning' } }         // every TypeScript diagnostic in the 2000 range
     * ```
     *
     * @see LogOverridesType
     * @since 3.0.0
     */

    logOverride?: LogOverridesType;

    /**
     * Whether declaration files are emitted and how.
     *
     * @remarks
     * `true` emits them beside the code, following what the TypeScript configuration chose.
     * The object form also decides where they land.
     *
     * @example
     * ```ts
     * { declaration: true }                     // beside the code
     * { declaration: { outDir: 'types' } }      // apart from it
     * ```
     *
     * @see DeclarationOptionsInterface
     * @since 2.0.0
     */

    declaration?: boolean | DeclarationOptionsInterface;

    /**
     * esbuild options passed through to the bundler.
     *
     * @remarks
     * Optional here, unlike on a variant, since the common block states what every variant starts from
     * rather than a build of its own.
     *
     * @example
     * ```ts
     * { esbuild: { minify: true, format: 'esm', target: 'node20' } }
     * ```
     *
     * @see EsbuildOptionsType
     * @since 3.0.0
     */

    esbuild?: EsbuildOptionsType;
}

/**
 * One named build, with everything it does not state inherited from the common block.
 *
 * @remarks
 * The same settings as {@link BaseConfigurationInterface}, except that `esbuild` is required,
 * since a variant exists to produce an output and needs at least the options describing it.
 *
 * @example
 * ```ts
 * const esm: VariantConfigurationInterface = {
 *     esbuild: { format: 'esm', outdir: 'dist/esm' }
 * };
 * ```
 *
 * @see BaseConfigurationInterface
 * @since 3.0.0
 */

export interface VariantConfigurationInterface extends BaseConfigurationInterface {
    /**
     * Variants that must finish before this one starts.
     *
     * @remarks
     * Names another variant, or several, so a build that consumes the output of an earlier one runs after it rather
     * than beside it.
     *
     * @example
     * ```ts
     * { dependOn: 'types', esbuild: { outdir: 'dist' } }
     * ```
     *
     * @since 2.0.0
     */

    dependOn?: string | Array<string>;

    /**
     * esbuild options this variant builds under.
     *
     * @remarks
     * Required rather than optional, unlike on the common block, and merged over whatever `common` supplied.
     *
     * @example
     * ```ts
     * { esbuild: { format: 'cjs', outdir: 'dist/cjs' } }
     * ```
     *
     * @see EsbuildOptionsType
     * @since 3.0.0
     */

    esbuild: EsbuildOptionsType;
}

/**
 * A whole xBuild configuration, as a configuration file, exports it.
 *
 * @remarks
 * `variants` is what the build runs, one output per entry, while `common` is what each of them starts from.
 * A configuration with a single variant is the ordinary case, several being for a package that ships more than one
 * module format.
 *
 * @example
 * ```ts
 * const config: ConfigurationInterface = {
 *     common: { types: true, esbuild: { minify: true } },
 *     variants: {
 *         esm: { esbuild: { format: 'esm', outdir: 'dist/esm' } },
 *         cjs: { esbuild: { format: 'cjs', outdir: 'dist/cjs' } }
 *     }
 * };
 * ```
 *
 * @see ConfigurationService
 * @see VariantConfigurationInterface
 *
 * @since 3.0.0
 */

export interface ConfigurationInterface {
    /**
     * Settings every variant inherits.
     *
     * @remarks
     * Merged under each variant, so a variant naming the same setting wins and one that stays quiet takes this.
     *
     * @example
     * ```ts
     * { common: { types: true, esbuild: { minify: true } } }
     * ```
     *
     * @see BaseConfigurationInterface
     * @since 2.0.0
     */

    common?: BaseConfigurationInterface;

    /**
     * The builds to run, keyed by the name each is known by.
     *
     * @remarks
     * The key names the variant in logs, in `dependOn`, and on the `--build` flag that selects one.
     *
     * @example
     * ```ts
     * { variants: { esm: { esbuild: { format: 'esm' } } } }
     * ```
     *
     * @see VariantConfigurationInterface
     * @since 3.0.0
     */

    variants: Record<string, VariantConfigurationInterface>;
}

/**
 * A configuration with every top-level field optional.
 *
 * @remarks
 * What a partly filled configuration is typed as, the built-in defaults among them,
 * since those describe `common` alone and name no variants at all.
 *
 * @example
 * ```ts
 * const defaults: PartialConfigurationType = { common: { types: true } };
 * ```
 *
 * @see ConfigurationInterface
 * @since 3.0.0
 */

export type PartialConfigurationType = Partial<ConfigurationInterface>;
