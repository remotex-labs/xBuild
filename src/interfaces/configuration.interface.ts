/**
 * Import will remove at compile time
 */

import type { BuildOptions } from 'esbuild';
import type { OnStartType, OnEndType } from '@providers/interfaces/lifecycle-provider.interface';
import type { OnLoadType, OnResolveType } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Recursively makes all properties of a type optional.
 *
 * @remarks
 * This utility type behaves like TypeScript’s built-in {@link Partial} type,
 * but applies recursively to all nested object properties.
 *
 * It is commonly used for:
 * - Partial configuration overrides
 * - Patch / update objects
 * - Programmatic configuration merging
 * - Build variant and preset definitions
 *
 * This type only affects compile-time type checking and has no runtime impact.
 *
 * ⚠️ **Important limitations**:
 * - Arrays and functions are treated as objects and will also be recursively
 *   transformed. If this is undesirable, a more specialized deep-partial
 *   implementation should be used.
 * - Intended for configuration and data-shaping use cases, not strict domain models.
 *
 * @example
 * ```ts
 * interface Config {
 *   server: {
 *     host: string;
 *     port: number;
 *   };
 *   features: {
 *     experimental: boolean;
 *   };
 * }
 *
 * const override: DeepPartialType<Config> = {
 *   server: {
 *     port: 8080
 *   }
 * };
 * ```
 *
 * @template T - The type to recursively make optional.
 *
 * @since 2.0.0
 */

export type DeepPartialType<T> = {
    [K in keyof T]?: T[K] extends object
        ? DeepPartialType<T[K]> : T[K];
};

/**
 * Represents code that can be injected into build output as a banner or footer.
 * Can be a static string or a function that generates code dynamically based on build context.
 *
 * @remarks
 * This type provides flexibility for injecting code at the top (banner) or bottom (footer) of
 * bundled output files. The function form receives the plugin name and command-line arguments,
 * allowing for context-aware code generation.
 *
 * Common use cases:
 * - Static banners: Copyright notices, license headers, version information
 * - Dynamic banners: Build timestamps, environment-specific code, conditional imports
 * - Footer code: Analytics snippets, polyfills, initialization scripts
 *
 * When using the function form, the generated string is cached per build variant to avoid
 * regenerating the same code multiple times.
 *
 * @example
 * ```ts
 * // Static banner
 * const banner: InjectableCodeType = '\/* Copyright 2024 *\/';
 *
 * // Dynamic banner
 * const banner: InjectableCodeType = (name, argv) => {
 *   const version = argv.version || '1.0.0';
 *   return `\/* Built by ${name} v${version} at ${new Date().toISOString()} *\/`;
 * };
 * ```
 *
 * @see {@link BaseBuildDefinitionInterface.banner}
 * @see {@link BaseBuildDefinitionInterface.footer}
 *
 * @since 2.0.0
 */

export type InjectableCodeType = string | ((name: string, argv: Record<string, unknown>) => string);

/**
 * Defines lifecycle hook handlers for build process stages.
 * Allows registration of custom logic during resolution, loading, build start, build end, and success.
 *
 * @remarks
 * This interface groups all available lifecycle hooks in a single configuration object.
 * All hooks are optional, allowing selective registration of only necessary handlers.
 *
 * Hook execution order during a build:
 * 1. `onStart` - Before any file processing
 * 2. `onResolve` - During import path resolution
 * 3. `onLoad` - When loading file contents
 * 4. `onEnd` - After build completes (success or failure)
 * 5. `onSuccess` - After a build completes successfully
 *
 * Each hook receives a specialized context object appropriate for its lifecycle stage, providing
 * access to build configuration, variant information, and cross-hook communication through the
 * shared stage object.
 *
 * @example
 * ```ts
 * const hooks: LifecycleHooksInterface = {
 *   onStart: async (context) => {
 *     console.log(`${context.variantName} build starting...`);
 *   },
 *   onLoad: async (context) => {
 *     if (context.args.path.endsWith('.custom')) {
 *       return { contents: transform(context.contents), loader: 'ts' };
 *     }
 *   },
 *   onSuccess: async (context) => {
 *     console.log(`Build succeeded in ${context.duration}ms!`);
 *   }
 * };
 * ```
 *
 * @see {@link OnEndType}
 * @see {@link OnLoadType}
 * @see {@link OnStartType}
 * @see {@link OnResolveType}
 *
 * @since 2.0.0
 */

export interface LifecycleHooksInterface {
    /**
     * Hook handler executed when the build completes, regardless of success or failure.
     *
     * @remarks
     * Called after all build operations finish with a result context containing the build result,
     * calculated duration, variant name, arguments, and stage state. Useful for cleanup, logging,
     * reporting, and post-processing.
     *
     * The handler receives `ResultContextInterface` providing access to:
     * - `buildResult`: Final build outcome with errors and warnings
     * - `duration`: Build duration in milliseconds
     * - `variantName`: Build variant identifier
     * - `argv`: Command-line arguments and configuration
     * - `stage`: Shared state object for cross-hook communication
     *
     * @example
     * ```ts
     * onEnd: async (context) => {
     *   const { buildResult, duration, variantName } = context;
     *   console.log(`${variantName} completed in ${duration}ms`);
     *   if (buildResult.errors.length > 0) {
     *     // Handle errors
     *   }
     * }
     * ```
     *
     * @see {@link ResultContextInterface}
     *
     * @since 2.0.0
     */

    onEnd?: OnEndType;

    /**
     * Hook handler executed when loading file contents during module processing.
     *
     * @remarks
     * Called for each file being processed with a load context containing the current file contents
     * (potentially transformed by previous hooks), loader type, load arguments, variant name, and
     * stage state. Can transform contents and change the loader type. Multiple handlers execute in
     * a pipeline pattern where each receives the output of previous hooks.
     *
     * The handler receives `LoadContextInterface` providing access to:
     * - `contents`: Current file contents (string or binary)
     * - `loader`: Current loader type (e.g., 'ts', 'js', 'json')
     * - `args`: Load arguments including file path and namespace
     * - `variantName`: Build variant identifier
     * - `argv`: Command-line arguments and configuration
     * - `stage`: Shared state object for cross-hook communication
     *
     * @example
     * ```ts
     * onLoad: async (context) => {
     *   const { contents, args, variantName } = context;
     *   if (args.path.endsWith('.custom')) {
     *     return {
     *       contents: transform(contents.toString()),
     *       loader: 'ts'
     *     };
     *   }
     * }
     * ```
     *
     * @see {@link LoadContextInterface}
     *
     * @since 2.0.0
     */

    onLoad?: OnLoadType;

    /**
     * Hook handler executed when the build process begins.
     *
     * @remarks
     * Called before any file processing starts with a build context containing the esbuild build object,
     * variant name, arguments, and stage state. Useful for initialization, validation, and setup tasks.
     *
     * The handler receives `BuildContextInterface` providing access to:
     * - `build`: esbuild plugin build object with configuration and utilities
     * - `variantName`: Build variant identifier
     * - `argv`: Command-line arguments and configuration
     * - `stage`: Shared state object for cross-hook communication
     *
     * @example
     * ```ts
     * onStart: async (context) => {
     *   const { build, variantName, stage } = context;
     *   console.log(`Starting ${variantName} build`);
     *   stage.startTime = new Date();
     *
     *   // Validate configuration
     *   if (!build.initialOptions.outdir) {
     *     return { errors: [{ text: 'Output directory required' }] };
     *   }
     * }
     * ```
     *
     * @see {@link BuildContextInterface}
     *
     * @since 2.0.0
     */

    onStart?: OnStartType;

    /**
     * Hook handler executed when the build completes successfully without errors.
     *
     * @remarks
     * Only called when `buildResult.errors.length === 0`, after all regular end hooks have completed.
     * Receives the same result context as end hooks, containing build result, duration, variant name,
     * arguments, and stage state. Useful for deployment, success notifications, and success-only operations.
     *
     * The handler receives `ResultContextInterface` providing access to:
     * - `buildResult`: Final build outcome (guaranteed to have zero errors)
     * - `duration`: Build duration in milliseconds
     * - `variantName`: Build variant identifier
     * - `argv`: Command-line arguments and configuration
     * - `stage`: Shared state object for cross-hook communication
     *
     * @example
     * ```ts
     * onSuccess: async (context) => {
     *   const { buildResult, duration, variantName } = context;
     *   console.log(`${variantName} succeeded in ${duration}ms!`);
     *   await deploy(buildResult.metafile);
     * }
     * ```
     *
     * @see {@link ResultContextInterface}
     *
     * @since 2.0.0
     */

    onSuccess?: OnEndType;

    /**
     * Hook handler executed during module path resolution.
     *
     * @remarks
     * Called when resolving import paths to file system locations with a resolve context containing
     * the resolution arguments, variant name, and stage state. Can redirect imports, mark modules as
     * external, or implement custom resolution logic. Multiple handlers execute, and their results are
     * merged, with later hooks able to override earlier ones.
     *
     * The handler receives `ResolveContextInterface` providing access to:
     * - `args`: Resolution arguments including import path and importer info
     * - `variantName`: Build variant identifier
     * - `argv`: Command-line arguments and configuration
     * - `stage`: Shared state object for cross-hook communication
     *
     * @example
     * ```ts
     * onResolve: async (context) => {
     *   const { args, variantName } = context;
     *
     *   // Redirect '@/' imports to 'src/'
     *   if (args.path.startsWith('@/')) {
     *     return {
     *       path: resolve('src', args.path.slice(2)),
     *       namespace: 'file'
     *     };
     *   }
     *
     *   // Mark as external in production
     *   if (variantName === 'production' && args.path.includes('node_modules')) {
     *     return { path: args.path, external: true };
     *   }
     * }
     * ```
     *
     * @see {@link ResolveContextInterface}
     *
     * @since 2.0.0
     */

    onResolve?: OnResolveType;
}

/**
 * Configuration options for TypeScript declaration file generation.
 *
 * @remarks
 * Controls how and where TypeScript declaration files (`.d.ts`) are generated during the build.
 * These options work in conjunction with the TypeScript compiler to produce type definitions
 * for bundled code.
 *
 * When `bundle` is true, declarations from multiple source files are combined into a single
 * declaration file per entry point. When false, individual declaration files are generated
 * for each source file.
 *
 * @example
 * ```ts
 * // Generate bundled declarations in custom directory
 * const options: DeclarationOptionsInterface = {
 *   outDir: 'types',
 *   bundle: true
 * };
 * ```
 *
 * @see {@link BaseBuildDefinitionInterface.declaration}
 *
 * @since 2.0.0
 */

export interface DeclarationOptionsInterface {
    /**
     * Output directory for generated declaration files.
     *
     * @remarks
     * Specifies where `.d.ts` files should be written. If not provided, uses the TypeScript
     * compiler's `declarationDir` or `outDir` from `tsconfig.json`.
     *
     * @example
     * ```ts
     * outDir: 'dist/types'
     * ```
     *
     * @since 2.0.0
     */

    outDir?: string;

    /**
     * Whether to bundle declarations into a single file per entry point.
     *
     * @remarks
     * When true, combines all declarations from imported modules into a single `.d.ts` file.
     * When false, generates individual declaration files mirroring the source structure.
     *
     * Bundling is useful for library distribution as it provides a single type definition file
     * that consumers can reference.
     *
     * @example
     * ```ts
     * bundle: true  // Produces single bundled .d.ts
     * bundle: false // Produces multiple .d.ts files
     * ```
     *
     * @since 2.0.0
     */

    bundle?: boolean;
}

/**
 * Configuration options for TypeScript type checking during builds.
 *
 * @remarks
 * Controls how TypeScript type checking is performed and whether type errors should fail the build.
 * Type checking runs in parallel with the esbuild compilation process for better performance.
 *
 * @example
 * ```ts
 * // Fail build on type errors
 * const options: TypeCheckOptionsInterface = {
 *   failOnError: true
 * };
 * ```
 *
 * @see {@link BaseBuildDefinitionInterface.types}
 *
 * @since 2.0.0
 */

export interface TypeCheckOptionsInterface {
    /**
     * Whether to fail the build when TypeScript errors are detected.
     *
     * @remarks
     * When true, any TypeScript errors will cause the build to fail with a non-zero exit code.
     * When false, errors are logged, but the build continues and succeeds.
     *
     * Useful in CI/CD pipelines where type safety must be enforced before deployment.
     *
     * @example
     * ```ts
     * failOnError: true  // Build fails on type errors
     * failOnError: false // Type errors logged, but build continues
     * ```
     *
     * @since 2.0.0
     */

    failOnError?: boolean;
}

/**
 * Base configuration shared across all build definitions, including common and variant builds.
 * Provides common settings for hooks, type checking, code injection, and declaration generation.
 *
 * @remarks
 * This interface defines the foundation for build configuration that applies to both common
 * settings and individual build variants. Properties defined here can be overridden at the
 * variant level for customization.
 *
 * Configuration inheritance:
 * - Common build settings apply to all variants
 * - Variant settings override common settings
 * - Objects like `define` are merged (variant takes precedence)
 * - Arrays and primitives replace common values
 *
 * @example
 * ```ts
 * const base: BaseBuildDefinitionInterface = {
 *   types: { failOnError: true },
 *   declaration: { bundle: true, outDir: 'types' },
 *   define: { 'process.env.NODE_ENV': '"production"' },
 *   banner: 'const x = "test"',
 *   hooks: {
 *     onSuccess: async () => console.log('Build complete!')
 *   }
 * };
 * ```
 *
 * @see {@link CommonBuildInterface}
 * @see {@link VariantBuildInterface}
 * @see {@link BuildConfigInterface}
 *
 * @since 2.0.0
 */

export interface BaseBuildDefinitionInterface {
    /**
     * Lifecycle hook handlers for build process stages.
     *
     * @remarks
     * Registers custom handlers for various build lifecycle events including start, resolve,
     * load, end, and success stages. All hooks are optional.
     *
     * @see {@link LifecycleHooksInterface}
     *
     * @since 2.0.0
     */

    lifecycle?: LifecycleHooksInterface;

    /**
     * TypeScript type checking configuration.
     *
     * @remarks
     * Controls whether and how TypeScript type checking is performed during builds.
     * - `true`: Enable type checking with default options
     * - `false` or omitted: Disable type checking
     * - Object: Enable with specific options like `failOnError`
     *
     * @example
     * ```ts
     * types: true                      // Enable with default
     * types: { failOnError: true }     // Enable and fail on errors
     * types: false                     // Disable
     * ```
     *
     * @see {@link TypeCheckOptionsInterface}
     *
     * @since 2.0.0
     */

    types?: boolean | TypeCheckOptionsInterface;

    /**
     * Global constants to replace during bundling.
     *
     * @remarks
     * Defines key-value pairs for constant replacement during the build. Keys are identifiers
     * or property access expressions, values are JSON-stringified replacements.
     *
     * Commonly used for environment variables, feature flags, and build-time constants.
     *
     * @example
     * ```ts
     * define: {
     *   'process.env.NODE_ENV': '"production"',
     *   'DEBUG': 'false',
     *   'VERSION': '"1.2.3"'
     * }
     * ```
     *
     * @since 2.0.0
     */

    define?: Record<string, unknown>;

    /**
     * Code to inject at the beginning of each output file.
     *
     * @remarks
     * Can be a static string or a function that generates code based on build context.
     * Commonly used for copyright notices, license headers, or polyfill imports.
     *
     * @example
     * ```ts
     * banner: 'const x = "test"'
     * banner: (name, argv) => `const x = "Built: ${new Date().toISOString()}"`
     * ```
     *
     * @see {@link InjectableCodeType}
     *
     * @since 2.0.0
     */

    banner?: { [key: string]: InjectableCodeType };

    /**
     * Code to inject at the end of each output file.
     *
     * @remarks
     * Can be a static string or a function that generates code based on build context.
     * Commonly used for initialization code, analytics, or polyfills.
     *
     * @example
     * ```ts
     * footer: '// End of bundle'
     * footer: (name, argv) => `console.log('Loaded ${name}');`
     * ```
     *
     * @see {@link InjectableCodeType}
     *
     * @since 2.0.0
     */

    footer?: { [key: string]: InjectableCodeType };

    /**
     * TypeScript declaration file generation configuration.
     *
     * @remarks
     * Controls whether and how TypeScript declaration files are generated.
     * - `true`: Generate declarations with default options
     * - `false` or omitted: Do not generate declarations
     * - Object: Generate with specific options like `outDir` and `bundle`
     *
     * @example
     * ```ts
     * declaration: true                              // Generate with default
     * declaration: { outDir: 'types', bundle: true } // Generate bundled in custom dir
     * declaration: false                             // Disable
     * ```
     *
     * @see {@link DeclarationOptionsInterface}
     *
     * @since 2.0.0
     */

    declaration?: boolean | DeclarationOptionsInterface;
}

/**
 * Build configuration for a specific build variant including esbuild settings and entry points.
 * Extends base configuration with variant-specific esbuild options and required entry points.
 *
 * @remarks
 * A variant represents a distinct build target with its own entry points and esbuild configuration.
 * Variants inherit settings from the common configuration but can override any property.
 *
 * The `esbuild` property excludes fields that are managed by the build system:
 * - `plugins`: Managed by the hook provider
 * - `define`, `banner`, `footer`: Managed by base configuration
 * - `entryPoints`: Required at variant level (non-nullable)
 *
 * Multiple variants enable building different outputs from the same codebase, such as
 * - Different module formats (ESM, CJS)
 * - Different targets (Node.js, browser)
 * - Different bundles (main, worker, tests)
 *
 * @example
 * ```ts
 * const variant: VariantBuildInterface = {
 *   esbuild: {
 *     entryPoints: ['src/index.ts'],
 *     outdir: 'dist/esm',
 *     format: 'esm',
 *     target: 'es2020'
 *   },
 *   types: true,
 *   declaration: { bundle: true, outDir: 'dist/types' }
 * };
 * ```
 *
 * @see {@link VariantsType}
 * @see {@link CommonBuildInterface}
 * @see {@link BaseBuildDefinitionInterface}
 *
 * @since 2.0.0
 */

export interface VariantBuildInterface extends BaseBuildDefinitionInterface {
    /**
     * Esbuild-specific configuration for this variant including entry points.
     *
     * @remarks
     * Contains all esbuild options except those managed by the build system.
     * The `entryPoints` field is required and must be non-empty to define what to build.
     *
     * Common options include:
     * - `format`: Output format (esm, cjs, iife)
     * - `outdir` or `outfile`: Output location
     * - `target`: ECMAScript target version
     * - `platform`: Target platform (browser, node, neutral)
     * - `minify`: Whether to minify output
     * - `sourcemap`: Whether to generate source maps
     *
     * @example
     * ```ts
     * esbuild: {
     *   entryPoints: ['src/index.ts', 'src/worker.ts'],
     *   outdir: 'dist',
     *   format: 'esm',
     *   target: 'es2020',
     *   minify: true,
     *   sourcemap: true
     * }
     * ```
     *
     * @since 2.0.0
     */

    esbuild: Omit<
        BuildOptions,
        'plugins' | 'define' | 'banner' | 'footer'
    >;
}

/**
 * Shared configuration applied to all build variants.
 * Extends base configuration with esbuild settings but without entry points.
 *
 * @remarks
 * Common configuration provides default settings that apply to all variants unless overridden.
 * This reduces duplication when multiple variants share similar settings.
 *
 * The `esbuild` property excludes managed fields and `entryPoints` (which must be variant-specific).
 * Settings defined here are merged with variant-specific settings, with variants taking precedence.
 *
 * Typical use cases:
 * - Shared compiler options (target, platform)
 * - Common minification and sourcemap settings
 * - Shared external dependencies
 * - Default output configuration
 *
 * @example
 * ```ts
 * const common: CommonBuildInterface = {
 *   esbuild: {
 *     target: 'es2020',
 *     platform: 'node',
 *     sourcemap: true,
 *     external: ['react', 'react-dom']
 *   },
 *   types: { failOnError: true },
 *   declaration: true
 * };
 * ```
 *
 * @see {@link BaseBuildDefinitionInterface}
 * @see {@link VariantBuildInterface}
 * @see {@link BuildConfigInterface}
 *
 * @since 2.0.0
 */

export interface CommonBuildInterface extends BaseBuildDefinitionInterface {
    /**
     * Shared esbuild configuration for all variants.
     *
     * @remarks
     * Contains esbuild options that apply to all variants by default. Variants can override
     * any of these settings with their own specific values.
     *
     * Excludes managed fields and `entryPoints` since entry points must be variant-specific.
     *
     * @example
     * ```ts
     * esbuild: {
     *   platform: 'node',
     *   target: 'node18',
     *   external: ['typescript']
     * }
     * ```
     *
     * @since 2.0.0
     */

    esbuild?: Omit<
        BuildOptions,
        'plugins' | 'define' | 'banner' | 'footer'
    >
}

/**
 * Maps variant names to their build configurations.
 * Allows defining multiple build targets with different entry points and settings.
 *
 * @remarks
 * This type represents a collection of named build variants. Each key is a user-defined
 * variant name (e.g., 'esm', 'cjs', 'browser'), and each value is the complete build
 * configuration for that variant.
 *
 * Variant names are used for:
 * - CLI targeting specific builds
 * - Build output organization
 * - Logging and error reporting
 * - Parallel build coordination
 *
 * @example
 * ```ts
 * const variants: VariantsType = {
 *   esm: {
 *     esbuild: {
 *       entryPoints: ['src/index.ts'],
 *       format: 'esm',
 *       outdir: 'dist/esm'
 *     }
 *   },
 *   cjs: {
 *     esbuild: {
 *       entryPoints: ['src/index.ts'],
 *       format: 'cjs',
 *       outdir: 'dist/cjs'
 *     }
 *   }
 * };
 * ```
 *
 * @see {@link VariantBuildInterface}
 * @see {@link BuildConfigInterface}
 *
 * @since 2.0.0
 */

export type VariantsType = {
    [variantName: string]: VariantBuildInterface;
};

/**
 * Complete build configuration including common settings, variants, and CLI options.
 * Serves as the root configuration object for the entire build system.
 *
 * @remarks
 * This interface defines the complete structure of the build configuration file. It includes:
 * - Optional common settings shared across all variants
 * - Required variants mapping defining all build targets
 * - Optional verbose logging flag
 * - Optional custom command-line argument definitions
 *
 * The configuration is typically exported from a `build.config.ts` or similar file and
 * loaded by the build system at startup.
 *
 * Configuration resolution:
 * 1. Load the configuration file
 * 2. Parse command-line arguments using `userArgv` definitions
 * 3. Merge common settings with each variant
 * 4. Execute builds for all or selected variants
 *
 * @example
 * ```ts
 * const config: BuildConfigInterface = {
 *   verbose: true,
 *   common: {
 *     esbuild: {
 *       platform: 'node',
 *       target: 'node18'
 *     },
 *     types: true
 *   },
 *   variants: {
 *     esm: {
 *       esbuild: {
 *         entryPoints: ['src/index.ts'],
 *         format: 'esm',
 *         outdir: 'dist/esm'
 *       }
 *     },
 *     cjs: {
 *       esbuild: {
 *         entryPoints: ['src/index.ts'],
 *         format: 'cjs',
 *         outdir: 'dist/cjs'
 *       }
 *     }
 *   },
 *   userArgv: {
 *     watch: { type: 'boolean', description: 'Watch for changes' }
 *   }
 * };
 * ```
 *
 * @see {@link VariantsType}
 * @see {@link CommonBuildInterface}
 * @see {@link PartialBuildConfigType}
 *
 * @since 2.0.0
 */

export interface BuildConfigInterface {
    /**
     * Shared configuration applied to all build variants.
     *
     * @remarks
     * Optional common settings that are merged with each variant's configuration.
     * Variants can override these settings with their own specific values.
     *
     * @see {@link CommonBuildInterface}
     *
     * @since 2.0.0
     */

    common?: CommonBuildInterface;

    /**
     * Enable verbose logging output during builds.
     *
     * @remarks
     * When true, outputs detailed build information including file processing,
     * hook execution, and timing information. Useful for debugging build issues.
     *
     * @example
     * ```ts
     * verbose: true  // Detailed output
     * verbose: false // Minimal output
     * ```
     *
     * @since 2.0.0
     */

    verbose?: boolean;

    /**
     * Build variant definitions mapping names to configurations.
     *
     * @remarks
     * Required field defining all build targets. At least one variant must be defined.
     * Each variant specifies its own entry points and can override common settings.
     *
     * @see {@link VariantsType}
     *
     * @since 2.0.0
     */

    variants: VariantsType;
}

/**
 * Partial build configuration for incremental or programmatic configuration building.
 * Allows omitting variants and userArgv while making other fields optional.
 *
 * @remarks
 * This type is useful when building configuration programmatically or when providing
 * configuration fragments that will be merged with a base configuration. It makes
 * all properties optional except `variants` and `userArgv` which are completely omitted.
 *
 * Common use cases:
 * - Configuration presets or templates
 * - Programmatic configuration generation
 * - Configuration merging utilities
 * - Partial overrides in build scripts
 *
 * @example
 * ```ts
 * const preset: PartialBuildConfigType = {
 *   verbose: true,
 *   common: {
 *     types: { failOnError: true },
 *     declaration: true
 *   }
 * };
 *
 * // Merge with full config
 * const fullConfig: BuildConfigInterface = {
 *   ...preset,
 *   variants: { ... }
 * };
 * ```
 *
 * @see {@link BuildConfigInterface}
 *
 * @since 2.0.0
 */

export type PartialBuildConfigType = Partial<BuildConfigInterface>;
