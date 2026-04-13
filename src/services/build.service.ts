/**
 * Import will remove at compile time
 */

import type { OnLoadResult, Message, PartialMessage } from 'esbuild';
import type { BuildConfigInterface } from '@interfaces/configuration.interface';
import type { BuildContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { OnEndType, OnStartType } from '@providers/interfaces/lifecycle-provider.interface';
import type { ResultContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { BuildResultInterface } from '@providers/interfaces/esbuild-messages-provider.interface';
import type { DiagnosticInterface } from '@typescript/services/interfaces/typescript-service.interface';
import type { ReloadOptionsInterface, BuildTreeInterface } from '@services/interfaces/build-service.interface';

/**
 * Imports
 */

import { xBuildError } from '@errors/xbuild.error';
import { inject } from '@symlinks/symlinks.module';
import { VariantService } from '@services/variant.service';
import { LifecycleProvider } from '@providers/lifecycle.provider';
import { transformerDirective } from '@directives/macros.directive';
import { analyzeMacroMetadata } from '@directives/analyze.directive';
import { ConfigurationService } from '@services/configuration.service';
import { LanguageHostService } from '@typescript/services/hosts.service';
import { enhancedBuildResult, isBuildResultError } from '@providers/esbuild-messages.provider';

/**
 * Orchestrates the build process across multiple variants with lifecycle management and configuration.
 *
 * @remarks
 * The `BuildService` is the primary service for managing multi-variant builds in xBuild.
 * It handles configuration changes, variant lifecycle, type checking, and build execution
 * with support for hot reloading and file watching.
 *
 * **Key responsibilities**:
 * - Manages multiple build variants (e.g., production, development, testing)
 * - Provides reactive configuration updates through subscription system
 * - Coordinates lifecycle hooks (onStart, onEnd) across all variants
 * - Handles macro transformation and directive processing
 * - Supports incremental builds and file touch notifications
 * - Aggregates build results and type checking diagnostics
 *
 * **Architecture**:
 * Each variant is managed by a {@link VariantService} instance with its own:
 * - esbuild configuration and context
 * - TypeScript language service
 * - Lifecycle provider for hooks and plugins
 * - Build state and watch mode support
 *
 * The service uses a subscription pattern to react to configuration changes,
 * automatically creating new variants or disposing removed ones.
 *
 * @example Basic usage
 * ```ts
 * const buildService = new BuildService({
 *   variants: {
 *     production: {
 *       esbuild: { minify: true, sourcemap: false }
 *     },
 *     development: {
 *       esbuild: { minify: false, sourcemap: true }
 *     }
 *   }
 * });
 *
 * // Build all variants
 * const results = await buildService.build();
 * console.log(results.production.errors);
 * ```
 *
 * @example With lifecycle hooks
 * ```ts
 * const buildService = new BuildService(config);
 *
 * buildService.onStart = (context) => {
 *   console.log(`Building variant: ${context.variantName}`);
 * };
 *
 * buildService.onEnd = (context) => {
 *   console.log(`Completed ${context.variantName}: ${context.result.errors.length} errors`);
 * };
 *
 * await buildService.build();
 * ```
 *
 * @example Configuration reload
 * ```ts
 * const buildService = new BuildService(initialConfig);
 *
 * // Reload with new configuration
 * buildService.reload({
 *   variants: {
 *     production: { esbuild: { target: 'es2020' } },
 *     staging: { esbuild: { minify: true } }
 *   }
 * });
 * // Old variants disposed, new ones created
 * ```
 *
 * @example Type checking
 * ```ts
 * const buildService = new BuildService(config);
 * const diagnostics = await buildService.typeChack();
 *
 * for (const [variant, errors] of Object.entries(diagnostics)) {
 *   console.log(`${variant}: ${errors.length} type errors`);
 * }
 * ```
 *
 * @see {@link VariantService} for individual variant management
 * @see {@link ConfigurationService} for configuration handling
 * @see {@link LifecycleProvider} for hook management
 *
 * @since 2.0.0
 */

export class BuildService {
    /**
     * Callback invoked when a build completes for any variant.
     *
     * @remarks
     * Set via the `onEnd` setter. Called after each variant's build finishes,
     * providing access to build results, errors, warnings, and metadata.
     *
     * @since 2.0.0
     */

    private onEndCallback?: OnEndType;

    /**
     * Callback invoked when a build starts for any variant.
     *
     * @remarks
     * Set via the `onStart` setter. Called before each variant's build begins,
     * after macro metadata analysis completes.
     *
     * @since 2.0.0
     */

    private onStartCallback?: OnStartType;

    /**
     * Map of variant names to their service instances.
     *
     * @remarks
     * Contains all active build variants. Variants are created during construction
     * and updated when configuration changes via {@link reload} or {@link setConfiguration}.
     *
     * @since 2.0.0
     */

    private variants: { [variant: string]: VariantService } = {};

    /**
     * Configuration service managing build settings and variant definitions.
     *
     * @remarks
     * Injected singleton that provides reactive configuration updates through
     * its subscription system. Changes trigger automatic variant recreation.
     *
     * @since 2.0.0
     */

    private readonly configuration: ConfigurationService<BuildConfigInterface> = inject(ConfigurationService);

    /**
     * Creates a new BuildService instance with optional configuration and command-line arguments.
     *
     * @param argv - Command-line arguments passed to variant services (default: empty object)
     *
     * @remarks
     * The constructor:
     * 1. Accepts optional initial configuration
     * 2. Stores command-line arguments for variant initialization
     * 3. Subscribes to configuration changes via {@link parseVariants}
     * 4. Automatically creates variants defined in the configuration
     *
     * Configuration can be provided later via {@link reload} or {@link setConfiguration}
     * if not supplied during construction.
     *
     * @since 2.0.0
     */

    constructor(private argv: Record<string, unknown> = {}) {
        this.configuration.subscribe(this.parseVariants.bind(this));
    }

    /**
     * Gets the current complete build configuration.
     *
     * @returns The active build configuration including all variants and common settings
     *
     * @remarks
     * Retrieves the immutable snapshot of the current configuration from the
     * configuration service. Changes to the returned object do not affect
     * the actual configuration - use {@link setConfiguration} or {@link reload} instead.
     *
     * @since 2.0.0
     */

    get config(): BuildConfigInterface {
        return this.configuration.getValue();
    }

    /**
     * Sets the callback to invoke when any variant build completes.
     *
     * @param callback - Function receiving the result context with build output and metadata
     *
     * @remarks
     * The callback receives a {@link ResultContextInterface} containing:
     * - Variant name
     * - Build result (errors, warnings, outputs)
     * - Metadata files and outputs
     * - Timestamp and duration
     *
     * Called after the build finishes but before promises resolve.
     *
     * @example
     * ```ts
     * buildService.onEnd = (context) => {
     *   const { variantName, result } = context;
     *   console.log(`✓ ${variantName}: ${result.errors.length} errors`);
     * };
     * ```
     *
     * @since 2.0.0
     */

    set onEnd(callback: OnEndType) {
        this.onEndCallback = callback;
    }

    /**
     * Sets the callback to invoke when any variant build starts.
     *
     * @param callback - Function receiving the build context with file and variant information
     *
     * @remarks
     * The callback receives a {@link BuildContextInterface} containing:
     * - Variant name
     * - File path being processed
     * - Build stage and metadata
     * - Loader type
     *
     * Called after macro analysis but before transformation begins.
     *
     * @example
     * ```ts
     * buildService.onStart = (context) => {
     *   console.log(`Building ${context.args.path} for ${context.variantName}`);
     * };
     * ```
     *
     * @since 2.0.0
     */

    set onStart(callback: OnStartType) {
        this.onStartCallback = callback;
    }

    /**
     * Reloads the build configuration and updates variants accordingly.
     *
     * @param config - Optional new configuration to replace the current one
     * @param clearCache - Whether to clear cached files and TypeScript language service state before reloading
     *
     * @remarks
     * The reload process:
     * 1. Optionally clears cached file state and TypeScript language service data
     * 2. Replaces configuration if provided
     * 3. Compares new variant names with existing ones
     * 4. Disposes variants no longer in configuration
     * 5. Creates new variants from the updated configuration
     * 6. Existing variants with matching names continue unchanged
     *
     * This is useful for hot-reloading configuration files without restarting the build process.
     *
     * @example
     * ```ts
     * // Reload with a new staging variant
     * buildService.reload({
     *   config: {
     *     variants: {
     *       ...buildService.config.variants,
     *       staging: { esbuild: { minify: true } }
     *     }
     *   }
     * });
     * ```
     *
     * @example
     * ```ts
     * // Reload and clear cached file/type-checking state first
     * buildService.reload({
     *   clearCache: true
     * });
     * ```
     *
     * @since 2.3.0
     */

    reload({ config, clearCache = false }: ReloadOptionsInterface = {}): void {
        if (clearCache) LanguageHostService.reload();
        if (config) this.configuration.reload(config);
        this.disposeVariants(this.compareKeys(this.config.variants, this.variants));
        this.parseVariants();
    }

    /**
     * Notifies all variants that specific files have been modified.
     *
     * @param files - Array of file paths that have changed
     *
     * @remarks
     * Propagates file change notifications to all variant services, triggering
     * incremental rebuilds in watch mode. Each variant's watch service handles
     * the actual rebuild logic.
     *
     * Typically used by file watchers or development servers to trigger hot reloads.
     *
     * @example
     * ```ts
     * // File watcher integration
     * watcher.on('change', (changedFiles) => {
     *   buildService.touchFiles(changedFiles);
     * });
     * ```
     *
     * @see {@link VariantService.touchFiles}
     *
     * @since 2.0.0
     */

    touchFiles(files: Array<string>): void {
        for (const instance of Object.values(this.variants)) {
            instance.touchFiles(files);
        }
    }

    /**
     * Partially updates the build configuration without replacing it entirely.
     *
     * @param config - Partial configuration to merge with the current configuration
     *
     * @remarks
     * Performs a shallow merge of the provided configuration with the current one.
     * Use {@link reload} for deep configuration replacement or variant restructuring.
     *
     * Common use cases:
     * - Toggling minification
     * - Updating define constants
     * - Modifying common build options
     *
     * @example
     * ```ts
     * // Enable minification for all variants
     * buildService.setConfiguration({
     *   common: { esbuild: { minify: true } }
     * });
     * ```
     *
     * @see {@link reload} for full configuration replacement
     *
     * @since 2.0.0
     */

    setConfiguration(config: Partial<BuildConfigInterface>): void {
        this.configuration.patch(config);
    }

    /**
     * Performs TypeScript type checking across all variants.
     *
     * @returns Promise resolving to a map of variant names to their diagnostic results
     *
     * @remarks
     * Runs the TypeScript compiler's diagnostic checker for each variant in parallel.
     * Returns all type errors, warnings, and suggestions without failing the build.
     *
     * **Note**: Method name has a typo - should be `typeCheck` but kept for backward compatibility.
     *
     * Useful for:
     * - Pre-build validation
     * - CI/CD type checking pipelines
     * - IDE integration and diagnostics display
     *
     * @example
     * ```ts
     * const diagnostics = await buildService.typeChack();
     *
     * for (const [variant, errors] of Object.entries(diagnostics)) {
     *   if (errors.length > 0) {
     *     console.error(`${variant} has ${errors.length} type errors`);
     *     errors.forEach(err => console.error(err.messageText));
     *   }
     * }
     * ```
     *
     * @see {@link DiagnosticInterface}
     * @see {@link VariantService.check}
     *
     * @since 2.0.0
     */

    async typeChack(): Promise<Record<string, DiagnosticInterface[]>> {
        const result: Record<string, Array<DiagnosticInterface>> = {};

        for (const variant of Object.values(this.variants)) {
            result[variant.name] = await variant.check();
        }

        return result;
    }

    /**
     * Executes the build process for all or specific variants,
     * respecting `dependOn` ordering and running independent variants in parallel.
     *
     * @param names - Optional array of variant names to build (builds all if omitted)
     *
     * @returns Promise resolving to a map of variant names to their enhanced build results
     *
     * @throws xBuildError - When a circular dependency is detected before any build starts
     * @throws AggregateError - When any variant build fails, containing all error details
     *
     * @remarks
     * The build process:
     * 1. Validates the dependency graph — throws immediately on circular deps
     * 2. Launches all requested variants concurrently
     * 3. Each variant awaits its `dependOn` dependencies before running
     * 4. Collects results and errors from each variant without stopping others
     * 5. Enhances build results with additional metadata
     * 6. Throws AggregateError if any builds failed
     *
     * **Dependency resolution**:
     * - `dependOn` variants always finish before the dependent variant starts
     * - A shared dependency (e.g. two variants both depending on `types`) builds
     *   only once — subsequent dependents await the same running promise
     * - Independent variants run fully in parallel
     *
     * **Error handling**:
     * - Build failures don't stop other variants from building
     * - All errors are collected into {@link BuildTreeInterface.errors} and thrown
     *   together after all builds complete
     * - Supports both esbuild-specific errors and generic JavaScript errors
     *
     * **Result enhancement**:
     * Build results are processed by {@link enhancedBuildResult} to provide
     * structured error and warning information.
     *
     * @example Build all variants
     * ```ts
     * try {
     *   const results = await buildService.build();
     *   console.log(`Built ${Object.keys(results).length} variants`);
     * } catch (error) {
     *   if (error instanceof AggregateError) {
     *     error.errors.forEach(err => console.error(err.message));
     *   }
     * }
     * ```
     *
     * @example Build specific variants
     * ```ts
     * const results = await buildService.build(['production', 'staging']);
     * // Only production and staging variants are built
     * ```
     *
     * @example With dependency ordering
     * ```ts
     * // Given: main dependOn shared, shared dependOn types
     * // Build order: types → shared → main (dependencies first)
     * const results = await buildService.build();
     * ```
     *
     * @see {@link buildVariant} for per-variant execution and caching logic
     * @see {@link BuildTreeInterface}
     * @see {@link enhancedBuildResult}
     * @see {@link BuildResultInterface}
     * @see {@link VariantService.build}
     * @see {@link validateDependencies} for circular dependency detection
     *
     * @since 2.4.0
     */

    async build(names?: Array<string>): Promise<Record<string, BuildResultInterface>> {
        const ctx: BuildTreeInterface = {
            cache: new Map(),
            errors: [],
            results: {}
        };

        this.validateDependencies(names);

        const targets = names ?? Object.keys(this.variants);
        await Promise.all(targets.map(name => this.buildVariant(name, ctx)));

        if (ctx.errors.length) throw new AggregateError(ctx.errors, 'Build failed');

        return ctx.results;
    }

    /**
     * Triggers the onEnd callback when a variant build completes.
     *
     * @param context - The result context containing build output and metadata
     *
     * @remarks
     * Internal handler that safely invokes the user-provided onEnd callback if set.
     * Called by variant lifecycle providers after each build finishes.
     *
     * @since 2.0.0
     */

    private onEndTrigger(context: ResultContextInterface): void {
        if (this.onEndCallback) this.onEndCallback(context);
    }

    /**
     * Triggers the onStart callback and performs macro analysis before a variant build starts.
     *
     * @param context - The build context containing file and variant information
     *
     * @returns Promise resolving to the load result after macro metadata analysis
     *
     * @throws Error - Propagates errors from macro analysis that aren't AggregateErrors
     *
     * @remarks
     * Internal handler that:
     * 1. Analyzes macro metadata for the file being built
     * 2. Invokes the user-provided onStart callback if set
     * 3. Returns the analysis result to the build pipeline
     * 4. Converts AggregateErrors to esbuild-compatible error format
     *
     * The macro analysis prepares directive information ($$ifdef, $$inline, etc.)
     * that will be used during the transformation phase.
     *
     * @see {@link analyzeMacroMetadata}
     *
     * @since 2.0.0
     */

    private async onStartTrigger(context: BuildContextInterface): Promise<OnLoadResult> {
        try {
            const result = await analyzeMacroMetadata(this.variants[context.variantName], context);
            if (this.onStartCallback) this.onStartCallback(context);

            return result;
        } catch (error) {
            const errors: Array<PartialMessage> = [];
            if (error instanceof AggregateError) {
                for (const err of error.errors) {
                    errors.push({
                        detail: err,
                        text: err.message
                    });
                }

                return { errors };
            }

            throw error;
        }
    }

    /**
     * Disposes and removes variants by name.
     *
     * @param dispose - Array of variant names to dispose
     *
     * @remarks
     * Cleanly shuts down variant services and removes them from the internal map.
     * Called during configuration reload to remove variants no longer in config.
     *
     * Each variant's dispose method:
     * - Stops watch mode if active
     * - Cleans up esbuild contexts
     * - Releases TypeScript language service resources
     *
     * @since 2.0.0
     */

    private disposeVariants(dispose: Array<string>): void {
        if (dispose.length) {
            for (const variant of dispose) {
                this.variants[variant].dispose();
                delete this.variants[variant];
            }
        }
    }

    /**
     * Compares two objects and returns keys present in the second but not the first.
     *
     * @param obj1 - Reference object (usually new configuration)
     * @param obj2 - Comparison object (usually existing variants)
     *
     * @returns Array of keys present in obj2 but missing in obj1
     *
     * @remarks
     * Used to identify variants that should be disposed during configuration reload.
     * If a variant exists in the service but not in the new configuration, it's removed.
     *
     * @since 2.0.0
     */

    private compareKeys(obj1: object, obj2: object): Array<string> {
        const keys2 = Object.keys(obj2);
        const onlyInObj2 = keys2.filter(key => !(key in obj1));

        return [ ...onlyInObj2 ];
    }

    /**
     * Creates variant service instances from the current configuration.
     *
     * @throws xBuildError - When no variants are defined in the configuration
     *
     * @remarks
     * Invoked by the configuration subscription whenever configuration changes.
     * For each variant in the configuration:
     * 1. Skips if the variant already exists (prevents recreation)
     * 2. Creates a new LifecycleProvider with hooks
     * 3. Attaches onStart and onEnd listeners
     * 4. Creates VariantService with configuration
     * 5. Registers macro transformer directive
     *
     * The lifecycle hooks enable:
     * - Build start/end notifications
     * - Macro analysis and transformation
     * - Custom plugin integration
     *
     * @see {@link VariantService}
     * @see {@link LifecycleProvider}
     * @see {@link transformerDirective}
     *
     * @since 2.0.0
     */

    private parseVariants(): void {
        if (!this.config.variants)
            throw new xBuildError('Variants are not defined in the configuration');

        for (const name of Object.keys(this.config.variants)) {
            if (this.variants[name]) continue;
            const lifecycle = new LifecycleProvider(name, this.argv);
            lifecycle.onEnd(this.onEndTrigger.bind(this), 'build-service');
            lifecycle.onStart(this.onStartTrigger.bind(this), 'build-service');
            this.variants[name] = new VariantService(name, lifecycle, this.config.variants[name], this.argv);
            lifecycle.onLoad(transformerDirective.bind({}, this.variants[name]), 'build-service');
        }
    }

    /**
     * Returns the normalized `dependOn` list for a variant.
     *
     * @param variantName - The variant to look up
     *
     * @returns Array of dependency variant names, empty if none defined
     *
     * @remarks
     * Normalizes the `dependOn` field from the variant configuration into
     * a consistent array form, since the field accepts either a single
     * string or an array of strings.
     *
     * @see {@link buildVariant}
     * @see {@link validateDependencies}
     *
     * @since 2.4.0
     */

    private getDependOn(variantName: string): Array<string> {
        const { dependOn } = this.config.variants?.[variantName] ?? {};
        if (!dependOn) return [];

        return Array.isArray(dependOn) ? dependOn : [ dependOn ];
    }

    /**
     * Validates the dependency graph for all or specific variants before building starts.
     *
     * @param names - Optional subset of variant names to validate (validates all if omitted)
     *
     * @throws xBuildError - When a circular dependency is detected, with the full cycle
     * path included in the message (e.g. `Circular dependency detected: main → shared → main`)
     *
     * @remarks
     * Performs a depth-first traversal of the dependency graph using two sets:
     * - `visited` — variants fully processed, skipped on revisit
     * - `inStack` — variants in the current traversal path, used to detect cycles
     *
     * Dependencies that exist in `dependOn` but have no matching variant instance
     * in {@link variants} are silently skipped.
     *
     * Called by {@link build} before any variant starts, ensuring the entire
     * graph is valid before any work begins.
     *
     * @see {@link build}
     * @see {@link getDependOn}
     *
     * @since 2.4.0
     */

    private validateDependencies(names?: Array<string>): void {
        const visited = new Set<string>();
        const inStack = new Set<string>();

        const visit = (name: string, chain: Array<string>): void => {
            if (inStack.has(name))
                throw new xBuildError(`Circular dependency detected: ${ [ ...chain, name ].join(' → ') }`);
            if (visited.has(name)) return;

            inStack.add(name);
            for (const dep of this.getDependOn(name)) {
                if (this.variants[dep]) visit(dep, [ ...chain, name ]);
            }
            inStack.delete(name);
            visited.add(name);
        };

        for (const name of (names ?? Object.keys(this.variants))) visit(name, []);
    }

    /**
     * Executes the build for a single variant after all its dependencies resolve.
     *
     * @param name - Variant name to build
     * @param ctx - Isolated build context for this {@link build} invocation
     *
     * @remarks
     * Called exclusively by {@link buildVariant} after the promise is registered
     * in {@link BuildTreeInterface.cache}, preventing re-entry.
     *
     * Awaits all `dependOn` dependencies concurrently via `Promise.all` before
     * running the variant. Dependencies missing from {@link variants} are silently skipped.
     *
     * Errors are pushed into {@link BuildTreeInterface.errors} rather than thrown,
     * so all variants attempt to build even if a sibling fails. Handles both
     * esbuild-specific errors via {@link isBuildResultError} and generic JavaScript errors.
     *
     * @see {@link buildVariant}
     * @see {@link getDependOn}
     * @see {@link isBuildResultError}
     * @see {@link BuildTreeInterface}
     * @see {@link enhancedBuildResult}
     *
     * @since 2.4.0
     */

    private async executeBuild(name: string, ctx: BuildTreeInterface): Promise<void> {
        const deps = this.getDependOn(name).filter(dep => this.variants[dep]);
        await Promise.all(deps.map(dep => this.buildVariant(dep, ctx)));

        const instance = this.variants[name];
        if (!instance) return;

        try {
            const result = await instance.build();
            if (result) ctx.results[name] = enhancedBuildResult(result);
        } catch (error) {
            if (isBuildResultError(error) || error instanceof AggregateError) {
                ctx.errors.push(
                    ...enhancedBuildResult({ errors: error.errors as Array<Message> }).errors
                );
            } else {
                ctx.errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    /**
     * Builds a single variant, first awaiting any `dependOn` dependencies.
     *
     * @param name - Variant name to build
     * @param ctx - Isolated build context for this {@link build} invocation,
     * carrying the promise cache, error list, and results map
     *
     * @returns Promise that resolves when the variant and all its dependencies finish
     *
     * @remarks
     * Stores its promise in {@link BuildTreeInterface.cache} on first call so any
     * subsequent caller depending on the same variant awaits the already-running
     * promise rather than triggering a duplicate build.
     *
     * Delegates actual execution to {@link executeBuild} after registering the promise,
     * ensuring the cache is populated before any async work begins.
     *
     * @see {@link build}
     * @see {@link executeBuild}
     * @see {@link BuildTreeInterface}
     *
     * @since 2.4.0
     */

    private buildVariant(name: string, ctx: BuildTreeInterface): Promise<void> {
        const cached = ctx.cache.get(name);
        if (cached) return cached;

        const promise = this.executeBuild(name, ctx);
        ctx.cache.set(name, promise);

        return promise;
    }
}
