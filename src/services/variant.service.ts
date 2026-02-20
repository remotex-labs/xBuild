/**
 * Import will remove at compile time
 */

import type { LifecycleProvider } from '@providers/lifecycle.provider';
import type { DiagnosticInterface } from '@typescript/typescript.module';
import type { VariantBuildInterface } from '@interfaces/configuration.interface';
import type { BuildOptions, OnStartResult, BuildResult, Message } from 'esbuild';
import type { UnsubscribeType } from '@observable/interfaces/observable.interface';
import type { ResultContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { ConfigSubscriptionInterface } from '@services/interfaces/variant-service.interface';
import type { CommonBuildInterface, LifecycleHooksInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { build } from 'esbuild';
import { writeFile, mkdir } from 'fs/promises';
import { TypesError } from '@errors/types.error';
import { xBuildError } from '@errors/xbuild.error';
import { inject } from '@symlinks/symlinks.module';
import { deepMerge } from '@components/object.component';
import { Typescript } from '@typescript/typescript.module';
import { analyzeDependencies } from '@services/transpiler.service';
import { relative, resolve, join } from '@components/path.component';
import { ConfigurationService } from '@services/configuration.service';
import { extractEntryPoints } from '@components/entry-points.component';
import { isBuildResultError } from '@providers/esbuild-messages.provider';

/**
 * Manages a single build “variant” (e.g. `dev`, `prod`) end-to-end.
 *
 * @remarks
 * A variant combines:
 * - Variant-specific configuration (esbuild options, hooks, define/banner/footer)
 * - Common configuration shared across variants
 *
 * Responsibilities:
 * - Merge and normalize configuration (`initializeConfig`)
 * - Register lifecycle hooks (core + user-defined)
 * - Keep a TypeScript service instance in sync (type-checking + declaration emission)
 * - Build using esbuild
 * - Hot-reload on configuration changes (temporarily deactivating builds during updates)
 *
 * @example
 * ```ts
 * const variant = new VariantService('production', lifecycle, variantConfig, { watch: true });
 *
 * // Build once
 * await variant.build();
 *
 * // Access computed dependency entry points (only meaningful when bundle=false)
 * console.log(Object.keys(variant.dependencies));
 *
 * // Cleanup
 * variant.dispose();
 * ```
 *
 * @since 2.0.0
 */

export class VariantService {
    /**
     * Dependency-to-entry-point map produced by {@link buildDependencyMap}.
     *
     * @remarks
     * This map is always refreshed before each build. When `esbuild.bundle === false`,
     * it is assigned to `esbuild.entryPoints` so that every discovered input becomes an entry point.
     *
     * Keys are output-like paths (relative to `rootDir`) **without** file extensions.
     * Values are source file paths.
     *
     * @example
     * ```ts
     * // Example shape:
     * // {
     * //   "index": "/abs/path/src/index.ts",
     * //   "utils/math": "/abs/path/src/utils/math.ts"
     * // }
     * console.log(variant.dependencies);
     * ```
     *
     * @since 2.0.0
     */

    private dependenciesFile: undefined | Record<string, string>;

    /**
     * Indicates whether this variant is currently active and should execute builds.
     *
     * @remarks
     * Set to `false` temporarily during configuration updates to prevent builds from running
     * with stale configuration. Re-enabled after configuration is successfully reloaded.
     *
     * @since 2.0.0
     */

    private active: boolean = true;

    /**
     * Path of the TypeScript configuration file currently in use.
     *
     * @remarks
     * Tracks the tsconfig file for this variant. When configuration changes and a different
     * tsconfig is specified, the old TypeScript instance is disposed and a new one is created.
     *
     * @since 2.0.0
     */

    private tsConfigPath: string;

    /**
     * TypeScript language service instance for type checking and declaration generation.
     *
     * @remarks
     * Manages the TypeScript compiler for this variant, providing type checking diagnostics
     * and declaration file emission. Recreated when tsconfig changes.
     *
     * @since 2.0.0
     */

    private typescriptModule: Typescript;

    /**
     * Unsubscribe function for configuration change subscription.
     *
     * @remarks
     * Called during disposal to stop listening to configuration updates and prevent memory leaks.
     *
     * @since 2.0.0
     */

    private readonly configUnsubscribe: UnsubscribeType;

    /**
     * Configuration service instance providing reactive configuration access.
     *
     * @remarks
     * Injected dependency for accessing and subscribing to build configuration changes.
     *
     * @since 2.0.0
     */

    private readonly configService = inject(ConfigurationService);

    /**
     * Creates a new variant service instance.
     *
     * @param name - Variant name (used for configuration lookup and hook identification)
     * @param lifecycle - Lifecycle provider used to register build hooks/plugins
     * @param buildConfig - Initial variant build configuration
     * @param argv - Optional CLI/extra arguments passed to dynamic config functions
     *
     * @remarks
     * During construction this service:
     * - Initializes the TypeScript module using `esbuild.tsconfig` (default: `"tsconfig.json"`)
     * - Merges variant configuration with common configuration
     * - Normalizes/expands entry points
     * - Registers core lifecycle hooks (`start`/`end`)
     * - Subscribes to configuration changes for hot-reload
     *
     * @example
     * ```ts
     * const variant = new VariantService(
     *   'dev',
     *   lifecycle,
     *   config,
     *   { watch: true }
     * );
     * ```
     *
     * @since 2.0.0
     */

    constructor(
        readonly name: string,
        private lifecycle: LifecycleProvider,
        private buildConfig: VariantBuildInterface,
        private argv: Record<string, unknown> = {}
    ) {
        if (!this.buildConfig?.esbuild) {
            throw new xBuildError(`Variant '${ this.name }' not found configuration`);
        }

        this.tsConfigPath = this.buildConfig.esbuild.tsconfig ?? 'tsconfig.json';
        this.typescriptModule = new Typescript(this.tsConfigPath);
        this.buildConfig = this.initializeConfig(
            this.getConfig(this.buildConfig, this.configService.getValue().common)!
        );

        this.typescriptModule.languageHostService.touchFiles(
            Object.values(<Record<string, string>> this.buildConfig.esbuild.entryPoints)
        );

        this.lifecycle.onEnd(this.end.bind(this), `${ this.name }-core`);
        this.lifecycle.onStart(this.start.bind(this), `${ this.name }-core`);

        this.configUnsubscribe = this.configService.select(config => ({
            variantConfig: config.variants?.[this.name],
            commonConfig: config.common
        })).subscribe(
            this.handleConfigChange.bind(this),
            error => {
                throw error;
            }
        );
    }

    /**
     * Provides access to the TypeScript language service instance for this variant.
     *
     * @returns The TypeScript module instance used for type checking and declaration generation
     *
     * @remarks
     * This getter exposes the variant's TypeScript language service, which provides:
     * - Type checking and diagnostics
     * - Declaration file generation
     * - File change tracking
     * - TypeScript compiler integration
     *
     * The TypeScript module is initialized during construction with the variant's `tsconfig.json`
     * configuration and is recreated when the TypeScript configuration file path changes during
     * hot-reload. The instance is disposed when the variant service is disposed.
     *
     * Use this getter to access TypeScript functionality externally, such as
     * - Manually triggering type checks
     * - Accessing diagnostics without building
     * - Integrating with IDE tooling
     * - Custom declaration file processing
     *
     * @example
     * ```ts
     * const service = new VariantService('production', lifecycle);
     * const typescript = service.typescript;
     *
     * // Check for type errors
     * const diagnostics = typescript.check();
     * console.log(`Found ${diagnostics.length} type errors`);
     *
     * // Emit declarations manually
     * await typescript.emit('types');
     * ```
     *
     * @see {@link dispose}
     * @see {@link Typescript}
     * @see {@link touchFiles}
     *
     * @since 2.0.0
     */

    get typescript(): Typescript {
        return this.typescriptModule;
    }

    /**
     * Provides access to the merged build configuration for this variant.
     *
     * @returns The complete variant build configuration including esbuild options, TypeScript settings, and lifecycle hooks
     *
     * @remarks
     * This getter exposes the variant's fully merged configuration, which combines:
     * - Common configuration shared across all variants
     * - Variant-specific configuration overrides
     * - Applied to define replacements
     * - Configured lifecycle hooks
     * - TypeScript and declaration settings
     *
     * The configuration is automatically updated when hot-reload detects changes to the
     * configuration file. The returned object reflects the current active configuration
     * used for builds.
     *
     * Configuration structure includes:
     * - `esbuild`: esbuild compiler options (entry points, output, format, minification)
     * - `types`: TypeScript type checking settings
     * - `declaration`: Declaration file generation settings
     * - `define`: Compile-time constant replacements
     * - `banner`: Text to prepend to output files
     * - `footer`: Text to append to output files
     * - `lifecycle`: Custom build lifecycle hooks
     *
     * Use this getter to:
     * - Inspect current build settings
     * - Debug configuration merging
     * - Access configuration in custom lifecycle hooks
     * - Validate variant settings
     *
     * @example
     * ```ts
     * const service = new VariantService('production', lifecycle);
     * const config = service.config;
     *
     * console.log(`Minification: ${config.esbuild.minify}`);
     * console.log(`Output format: ${config.esbuild.format}`);
     * console.log(`Type checking: ${config.types !== false}`);
     * ```
     *
     * @example
     * ```ts
     * // Access in lifecycle hook
     * lifecycle.onStart(async (context) => {
     *   const config = variantService.config;
     *   if (config.esbuild.minify) {
     *     console.log('Building minified output');
     *   }
     * });
     * ```
     *
     * @see {@link getConfig}
     * @see {@link handleConfigChange}
     * @see {@link VariantBuildInterface}
     *
     * @since 2.0.0
     */

    get config(): VariantBuildInterface {
        return this.buildConfig;
    }

    /**
     * Returns the latest dependency entry-point map computed for this variant.
     *
     * @remarks
     * Mainly useful when `esbuild.bundle === false`, because in that mode the build
     * rewrites `esbuild.entryPoints` to this map.
     *
     * @example
     * ```ts
     * await variant.build();
     * for (const [outPath, sourcePath] of Object.entries(variant.dependencies)) {
     *   console.log(outPath, '->', sourcePath);
     * }
     * ```
     *
     * @since 2.0.0
     */

    get dependencies(): Record<string, string> {
        return this.dependenciesFile ?? {};
    }

    /**
     * Disposes this variant service instance and releases resources.
     *
     * @remarks
     * Disposal performs two cleanup steps:
     * 1. Unsubscribes from configuration updates (stops hot-reload notifications)
     * 2. Releases the underlying TypeScript service resources for the current `tsconfig` path
     *
     * Call this when the variant is no longer needed to avoid keeping subscriptions alive and
     * to prevent TypeScript language service instances from lingering in memory.
     *
     * @example
     * ```ts
     * const variant = new VariantService('dev', lifecycle, config);
     *
     * // ... run builds, watch, etc. ...
     *
     * variant.dispose();
     * ```
     *
     * @since 2.0.0
     */

    dispose(): void {
        this.configUnsubscribe();
        this.typescriptModule.dispose(this.tsConfigPath);
    }

    /**
     * Notifies the TypeScript language service that files have been modified.
     *
     * @param files - Array of file paths that have been modified
     *
     * @remarks
     * This method updates the TypeScript language service's internal state to reflect
     * file changes, ensuring type checking and diagnostics remain accurate. Typically
     * called by file watchers when source files are modified.
     *
     * The TypeScript module will invalidate cached diagnostics for the touched files
     * and recalculate them on the next type check.
     *
     * @example
     * ```ts
     * // In a file watcher
     * watcher.on('change', (filePath) => {
     *   service.touchFiles([filePath]);
     * });
     * ```
     *
     * @see {@link Typescript.touchFiles}
     *
     * @since 2.0.0
     */

    touchFiles(files: Array<string>): void {
        this.typescriptModule.touchFiles(files);
    }

    /**
     * Performs TypeScript type checking for all files in the variant's dependency graph.
     *
     * @returns Array of diagnostic information containing errors, warnings, and suggestions
     *
     * @remarks
     * This method executes type checking on all source files discovered through dependency
     * analysis. It ensures the dependency map is built before checking, building it lazily
     * on the first invocation if not already available.
     *
     * The type checking process:
     * 1. Builds the dependency map if not already cached (first invocation only)
     * 2. Extracts all source file paths from the dependency map
     * 3. Passes the file list to the TypeScript module for semantic analysis
     * 4. Returns diagnostics for all type errors, warnings, and suggestions
     *
     * This method can be called independently of the build process to perform
     * type checking without compilation. It's also used internally by the `start`
     * lifecycle hook during builds when type checking is enabled.
     *
     * The dependency file map is cached after the first build, so subsequent
     * type checks reuse the same file list unless the variant is rebuilt or
     * dependencies change.
     *
     * @example
     * ```ts
     * const service = new VariantService('production', lifecycle, config);
     *
     * // Check types without building
     * const diagnostics = await service.check();
     *
     * if (diagnostics.length > 0) {
     *   console.error(`Found ${diagnostics.length} type issues`);
     *   diagnostics.forEach(d => {
     *     console.error(`${d.file}:${d.line}:${d.column} - ${d.message}`);
     *   });
     * }
     * ```
     *
     * @example
     * ```ts
     * // Used in CI pipeline
     * const errors = (await service.check()).filter(
     *   d => d.category === DiagnosticCategory.Error
     * );
     *
     * if (errors.length > 0) {
     *   process.exit(1);
     * }
     * ```
     *
     * @see {@link start}
     * @see {@link Typescript.check}
     * @see {@link buildDependencyMap}
     * @see {@link DiagnosticInterface}
     *
     * @since 2.0.0
     */

    async check(): Promise<DiagnosticInterface[]> {
        if(!this.dependenciesFile)
            this.dependenciesFile = await this.buildDependencyMap();

        return this.typescriptModule.check(Object.values(this.dependenciesFile!));
    }

    /**
     * Executes a build for this variant.
     *
     * @returns The esbuild {@link BuildResult}, or `undefined` if the variant is inactive.
     *
     * @remarks
     * High-level steps:
     * 1. Skip if inactive (used during configuration hot-reload)
     * 2. Apply banner/footer injections
     * 3. Compute dependency map
     * 4. If `bundle === false`, replace `entryPoints` with the computed dependency map
     * 5. Run esbuild
     * 6. Write `package.json` with the correct `"type"` for the output format
     *
     * @example
     * ```ts
     * const result = await variant.build();
     * if (result) {
     *   console.log('warnings:', result.warnings.length);
     * }
     * ```
     *
     * @since 2.0.0
     */

    async build(): Promise<BuildResult | undefined> {
        if (!this.active) return;
        this.applyInjections();

        this.dependenciesFile = await this.buildDependencyMap();
        if (this.buildConfig.esbuild.bundle === false) {
            this.buildConfig.esbuild.entryPoints = this.dependenciesFile;
        }

        try {
            const result = await build(this.buildConfig.esbuild);
            await this.packageTypeComponent();

            return result;
        } catch (error: unknown) {
            if (isBuildResultError(error)) {
                const errors = error.errors.filter(error => error.pluginName === '');
                if (errors.length > 0) throw error;

                return {
                    errors: error.errors as Array<Message>,
                    warnings: error.warnings as Array<Message>
                } as BuildResult;
            }

            // lazily add new support for new error
            throw error;
        }
    }

    /**
     * Merges variant-specific configuration with common configuration.
     *
     * @param config - Variant-specific build configuration
     * @param common - Common build configuration shared across variants
     * @returns Merged configuration, or null if variant config is undefined
     *
     * @remarks
     * This method performs a deep merge where variant-specific settings override
     * common settings. The merge is performed using the `deepMerge` utility, which
     * recursively combines nested objects and arrays.
     *
     * Merge priority (highest to lowest):
     * 1. Variant-specific configuration
     * 2. Common configuration
     * 3. Empty object (default base)
     *
     * If the variant configuration is undefined, it returns null to signal that the
     * variant doesn't exist.
     *
     * @example
     * ```ts
     * const common = { esbuild: { minify: false } };
     * const variant = { esbuild: { minify: true, sourcemap: true } };
     * const merged = getConfig(variant, common);
     * // Result: { esbuild: { minify: true, sourcemap: true } }
     * ```
     *
     * @see {@link deepMerge}
     *
     * @since 2.0.0
     */

    private getConfig(config?: VariantBuildInterface, common: CommonBuildInterface = {}): VariantBuildInterface | null {
        if (!config) return null;

        return deepMerge<VariantBuildInterface>(
            {} as VariantBuildInterface,
            common,
            config
        );
    }

    /**
     * Core start hook handler that runs type checking and declaration generation.
     *
     * @returns Start result containing any type errors and warnings
     *
     * @remarks
     * This private method is registered as an onStart hook during construction and executes
     * at the beginning of each build. It runs two tasks concurrently:
     * 1. **Type checking**: Validates TypeScript types and reports diagnostics
     * 2. **Declaration generation**: Emits .d.ts declaration files
     *
     * Both tasks run in parallel using `Promise.all` for optimal performance.
     *
     * Type checking behavior depends on the `types` configuration:
     * - If `types.failOnError` is false, type errors become warnings
     * - If `types.failOnError` is true (default), type errors fail the build
     *
     * Declaration generation behavior depends on the `declaration` configuration:
     * - If `declaration.bundle` is true (default), declarations are bundled
     * - If `declaration.bundle` is false, individual declarations are emitted
     * - Custom output directory can be specified with `declaration.outDir`
     *
     * @since 2.0.0
     */

    private async start(): Promise<OnStartResult | undefined> {
        const result: OnStartResult = { errors: [], warnings: [] };
        if (!this.buildConfig.types) return result;

        const diagnostics = this.typescriptModule.check(
            Object.values(this.dependenciesFile ?? {})
        );

        if (diagnostics.length === 0) return result;
        const buildOnError = typeof this.buildConfig.types === 'object' &&
            !this.buildConfig.types.failOnError;

        if (buildOnError) {
            const error = new TypesError('Type checking failed', diagnostics);
            result.warnings?.push({ detail: error, location: undefined });
        } else {
            const errors: Array<DiagnosticInterface> = [];
            const warnings: Array<DiagnosticInterface> = [];
            const error = new TypesError('Type checking failed', errors);
            const warning = new TypesError('Type checking failed', warnings);

            for (const d of diagnostics) {
                (d.category === ts.DiagnosticCategory.Error ? errors : warnings).push(d);
            }

            if(errors.length)
                result.errors?.push({ detail: error, location: undefined });

            if(warnings.length)
                result.warnings?.push({ detail: warning, location: undefined });
        }

        return result;
    }

    /**
     * Core end hook handler that generates declaration files after a successful build.
     *
     * @param context - The result context containing build results and metadata
     *
     * @returns Start result containing any declaration generation warnings, or undefined if build has errors
     *
     * @remarks
     * This private method is registered as an onEnd hook during construction and executes
     * at the end of each build. It performs declaration file generation only if the build is
     * completed successfully without errors.
     *
     * The method follows this execution flow:
     * 1. Checks if the build produced any errors
     * 2. Returns early (undefined) if errors exist, skipping declaration generation
     * 3. Creates a new result object for collecting warnings
     * 4. Executes declaration file emission
     * 5. Returns the result with any warnings from the emission process
     *
     * Declaration generation only runs for successful builds to avoid creating declaration
     * files for code that failed to compile. This ensures type definitions remain consistent
     * with the compiled JavaScript output.
     *
     * Any errors during declaration generation are captured as warnings and included in the
     * returned result, allowing the build to complete while reporting the issue.
     *
     * @example
     * ```ts
     * // Registered during construction
     * this.lifecycle.onEnd(this.end.bind(this), `${this.name}-core`);
     *
     * // Called automatically by lifecycle provider after build
     * // If build succeeded: generates declarations
     * // If build failed: skips declaration generation
     * ```
     *
     * @see {@link ResultContextInterface}
     * @see {@link start} for the corresponding start hook
     *
     * @since 2.0.0
     */

    private async end(context: ResultContextInterface): Promise<OnStartResult | undefined> {
        if (context.buildResult.errors?.length > 0) return;

        const result: OnStartResult = { errors: [], warnings: [] };
        if (!this.buildConfig.declaration) return;

        const decl = this.buildConfig.declaration;
        const shouldBundle = typeof decl === 'object' ? decl.bundle !== false : true;
        const outDir = typeof decl === 'object' ? decl.outDir : undefined;

        try {
            if (shouldBundle) {
                await this.typescriptModule.emitBundle(
                    <Record<string, string>> this.buildConfig.esbuild.entryPoints, outDir
                );
            } else {
                await this.typescriptModule.emit(outDir);
            }
        } catch (err) {
            result.warnings?.push({ detail: err, location: undefined });
        }

        return result;
    }

    /**
     * Registers lifecycle hooks from configuration with the lifecycle provider.
     *
     * @param hooks - Lifecycle hooks interface containing hook handlers
     *
     * @remarks
     * This method extracts individual hook handlers from the configuration and
     * registers them with the variant's lifecycle provider. Hooks are registered
     * using the default variant name identifier.
     *
     * Only defined hooks are registered; undefined hooks are skipped. This allows
     * partial hook configuration where only specific lifecycle stages need custom logic.
     *
     * Hook registration order:
     * 1. onStart
     * 2. onResolve
     * 3. onLoad
     * 4. onEnd
     * 5. onSuccess
     *
     * If no hooks are provided in the configuration, the method returns early
     * without registering anything.
     *
     * @example
     * ```ts
     * // In build configuration
     * {
     *   lifecycle: {
     *     onStart: async (context) => {
     *       console.log('Custom start hook');
     *     },
     *     onSuccess: async (context) => {
     *       console.log('Build succeeded!');
     *     }
     *   }
     * }
     * ```
     *
     * @see {@link LifecycleProvider.onStart}
     * @see {@link LifecycleProvider.onResolve}
     * @see {@link LifecycleProvider.onLoad}
     * @see {@link LifecycleProvider.onEnd}
     * @see {@link LifecycleProvider.onSuccess}
     *
     * @since 2.0.0
     */

    private registerConfigHooks(hooks?: LifecycleHooksInterface): void {
        if (!hooks) return;
        const { onStart, onResolve, onLoad, onEnd, onSuccess } = hooks;

        if (onStart) this.lifecycle.onStart(onStart);
        if (onResolve) this.lifecycle.onResolve(onResolve);
        if (onLoad) this.lifecycle.onLoad(onLoad);
        if (onEnd) this.lifecycle.onEnd(onEnd);
        if (onSuccess) this.lifecycle.onSuccess(onSuccess);
    }

    /**
     * Generates a `package.json` file with the appropriate `type` field
     * based on the format specified in the configuration.
     *
     * - If the format is `esm`, the `type` will be set to `"module"`.
     * - If the format is `cjs`, the `type` will be set to `"commonjs"`.
     *
     * The function will ensure that the specified output directory exists, and if it doesn't,
     * it will create the necessary directories before writing the `package.json` file.
     *
     * @throws Error - throw an error if there is a problem creating the directory or writing the file.
     *
     * @example
     * ```ts
     * const config = {
     *   esbuild: {
     *     format: 'esm'
     *   }
     * };
     * packageTypeComponent(config);
     * // This will create 'dist/package.json' with the content: {"type": "module"}
     * ```
     *
     * @since 2.0.0
     */

    private async packageTypeComponent(): Promise<void> {
        const outDir = this.buildConfig.esbuild.outdir ?? 'dist';
        const type = this.buildConfig.esbuild.format === 'esm' ? 'module' : 'commonjs';

        await mkdir(outDir, { recursive: true });
        await writeFile(join(outDir, 'package.json'), `{"type": "${ type }"}`);
    }

    /**
     * Validates and normalizes the merged variant configuration.
     *
     * @param config - Merged variant configuration (common + variant)
     * @returns The normalized configuration used internally for builds.
     *
     * @remarks
     * This method:
     * - Ensures required config fields exist (e.g. `esbuild.entryPoints`)
     * - Registers configured lifecycle hooks
     * - Normalizes `esbuild.tsconfig` (default: `"tsconfig.json"`)
     * - Expands entry points relative to `rootDir`
     * - Applies computed esbuild options (`define`, `logLevel`, and lifecycle plugin)
     *
     * @example
     * ```ts
     * // Called internally during construction and config hot-reload.
     * // You typically don't call this directly.
     * ```
     *
     * @since 2.0.0
     */

    private initializeConfig(config: VariantBuildInterface): VariantBuildInterface {
        if (!config) {
            throw new xBuildError(`Variant '${ this.name }' not found configuration`);
        }

        if (!config.esbuild.entryPoints) {
            throw new xBuildError('Entry points are required in esbuild configuration');
        }

        const defineFromConfig = config.define;
        const define: Record<string, string> | undefined = defineFromConfig
            ? Object.fromEntries(
                Object.entries(defineFromConfig).map(
                    ([ key, value ]) => [ key, JSON.stringify(value) ]
                )
            )
            : undefined;

        this.registerConfigHooks(config.lifecycle);
        config.esbuild.tsconfig ??= 'tsconfig.json';
        config.esbuild.entryPoints = extractEntryPoints(
            this.typescriptModule.config.options.rootDir ?? process.cwd(), config.esbuild.entryPoints
        );

        config.esbuild = Object.assign({}, config.esbuild, {
            define,
            logLevel: 'silent',
            plugins: [ this.lifecycle.create() ]
        }) as BuildOptions;

        return config;
    }

    /**
     * Handles configuration change events and updates variant settings.
     *
     * @param variantConfig - Updated variant-specific configuration
     * @param commonConfig - Updated common configuration
     *
     * @remarks
     * This method is called whenever the configuration service detects changes to the
     * variant's configuration. It performs a hot-reload of all variant settings without
     * requiring a restart.
     *
     * The reload process:
     * 1. Temporarily deactivates the variant (prevents builds during reload)
     * 2. Merges new variant and common configuration
     * 3. Validates that the variant still exists (returns if removed)
     * 4. Reactivates the variant
     * 5. Updates the build configuration
     * 6. Recreates TypeScript module if tsconfig changed
     * 7. Re-registers lifecycle hooks from a new configuration
     * 8. Reapplies define replacements and esbuild options
     * 9. Rebuilds entry points mapping
     *
     * TypeScript module recreation logic:
     * - Disposes old TypeScript instance if tsconfig path changed
     * - Creates new instance with updated tsconfig
     * - Preserves TypeScript instance if tsconfig unchanged
     *
     * This enables configuration changes to take effect immediately without stopping
     * watch mode or restarting the build process.
     *
     * @example
     * ```ts
     * // Configuration changes from:
     * { minify: false, tsconfig: 'tsconfig.json' }
     * // To:
     * { minify: true, tsconfig: 'tsconfig.prod.json' }
     * // TypeScript module is recreated with new tsconfig
     * // All other settings are updated
     * ```
     *
     * @see {@link getConfig}
     * @see {@link registerConfigHooks}
     *
     * @since 2.0.0
     */

    private async handleConfigChange({ variantConfig, commonConfig }: ConfigSubscriptionInterface): Promise<void> {
        this.active = false;
        const config = this.getConfig(variantConfig, commonConfig);
        if (!config) return;

        this.active = true;
        this.buildConfig = this.initializeConfig(config);

        if (config.esbuild.tsconfig && config.esbuild.tsconfig !== this.tsConfigPath) {
            this.typescriptModule.dispose(this.tsConfigPath);
            this.tsConfigPath = config.esbuild.tsconfig;
            this.typescriptModule = new Typescript(this.tsConfigPath);
        }
    }

    /**
     * Removes file extension from a path.
     *
     * @param filePath - Path with extension
     * @returns Path without extension
     *
     * @since 2.0.0
     */

    private stripExtension(filePath: string): string {
        const lastDotIndex = filePath.lastIndexOf('.');

        return lastDotIndex > 0 ? filePath.substring(0, lastDotIndex) : filePath;
    }

    /**
     * Analyzes build dependencies and maps all source files to their output paths.
     *
     * @returns Record mapping output paths (without extensions) to source file paths
     *
     * @remarks
     * This method performs the following steps:
     * - Analyzes the dependency graph using esbuild's metafile
     * - Extracts configured entry points
     * - Discovers all transitive dependencies from the build
     * - Maps each file to its relative output path based on rootDir
     *
     * Entry points are preserved as-is, while dependencies are mapped relative to the
     * TypeScript root directory with extensions removed for output path calculation.
     *
     * @example
     * ```ts
     * const fileMap = await this.buildDependencyMap();
     * // {
     * //   'index': 'src/index.ts',
     * //   'utils/helper': 'src/utils/helper.ts',
     * //   'components/button': 'src/components/button.ts'
     * // }
     * ```
     *
     * @since 2.0.0
     */

    private async buildDependencyMap(): Promise<Record<string, string>> {
        const { esbuild } = this.buildConfig;
        const { metafile } = await analyzeDependencies(esbuild.entryPoints, {
            loader: esbuild.loader,
            platform: esbuild.platform
        });

        const result: Record<string, string> = {};
        for (const file of Object.keys(metafile.inputs)) {
            const relativePath = relative(this.typescriptModule.config.options.rootDir!, resolve(file));
            const path = this.stripExtension(relativePath);
            result[path] = file;
        }

        return result;
    }

    /**
     * Injects banner or footer text into esbuild output configuration.
     *
     * @param type - Type of text block to inject ('banner' or 'footer')
     *
     * @remarks
     * This method processes banner or footer configuration and injects the resulting
     * text into esbuild options. The configuration can specify text for different
     * output types (js, CSS).
     *
     * Text can be specified in two ways:
     * - **Static string**: Used directly as the banner/footer text
     * - **Function**: Called with variant name and argv, returns the text
     *
     * The function form allows dynamic text generation based on build context.
     *
     * If no banner/footer is configured for this variant, the method returns early
     * without modifying esbuild options.
     *
     * @example
     * ```ts
     * // Static banner
     * {
     *   banner: {
     *     js: '// Copyright 2024'
     *   }
     * }
     * ```
     *
     * @example
     * ```ts
     * // Dynamic banner with function
     * {
     *   banner: {
     *     js: (variantName, argv) => `// Build: ${variantName} at ${new Date()}`
     *   }
     * }
     * ```
     *
     * @since 2.0.0
     */

    private injectTextBlock(type: 'banner' | 'footer'): void {
        const content = this.buildConfig[type];
        if (!content) return;

        const esbuild: BuildOptions = this.buildConfig.esbuild;
        esbuild[type] ??= {};

        for (const [ target, value ] of Object.entries(content)) {
            esbuild[type][target] = typeof value === 'function'
                ? value(this.name, this.argv)
                : value;
        }
    }

    /**
     * Applies banner and footer text injections before build execution.
     *
     * @remarks
     * This method injects custom text into the build output by calling `injectTextBlock`
     * for both 'banner' and 'footer' configuration options. Banners are prepended to
     * output files, while footers are appended.
     *
     * This is called at the start of each build to ensure injections reflect the
     * current configuration state.
     *
     * @see {@link injectTextBlock}
     *
     * @since 2.0.0
     */

    private applyInjections(): void {
        this.injectTextBlock('banner');
        this.injectTextBlock('footer');
    }
}
