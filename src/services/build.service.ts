/**
 * Import will remove at compile time
 */

import type { OnLoadResult, Message, PartialMessage } from 'esbuild';
import type { BuildContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { OnEndType, OnStartType } from '@providers/interfaces/lifecycle-provider.interface';
import type { ResultContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { BuildResultInterface } from '@providers/interfaces/esbuild-messages-provider.interface';
import type { BuildConfigInterface, PartialBuildConfigType } from '@interfaces/configuration.interface';
import type { DiagnosticInterface } from '@typescript/services/interfaces/typescript-service.interface';

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
     *
     * @remarks
     * The reload process:
     * 1. Replaces configuration if provided
     * 2. Compares new variant names with existing ones
     * 3. Disposes variants no longer in configuration
     * 4. Creates new variants from the updated configuration
     * 5. Existing variants with matching names continue unchanged
     *
     * This is useful for hot-reloading configuration files without restarting the build process.
     *
     * @example
     * ```ts
     * // Add a new staging variant
     * buildService.reload({
     *   variants: {
     *     ...buildService.config.variants,
     *     staging: { esbuild: { minify: true } }
     *   }
     * });
     * ```
     *
     * @since 2.0.0
     */

    reload(config?: PartialBuildConfigType): void {
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

        for(const variant of Object.values(this.variants)) {
            result[variant.name] = await variant.check();
        }

        return result;
    }

    /**
     * Executes the build process for all or specific variants.
     *
     * @param names - Optional array of variant names to build (builds all if omitted)
     *
     * @returns Promise resolving to a map of variant names to their enhanced build results
     *
     * @throws AggregateError - When any variant build fails, containing all error details
     *
     * @remarks
     * The build process:
     * 1. Filters variants if specific names are provided
     * 2. Builds all variants in parallel
     * 3. Collects results and errors from each variant
     * 4. Enhances build results with additional metadata
     * 5. Aggregates errors if any builds failed
     * 6. Throws AggregateError if errors occurred
     *
     * **Error handling**:
     * - Build failures don't stop other variants from building
     * - All errors are collected and thrown together after all builds are complete
     * - Supports both esbuild errors and generic JavaScript errors
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
     * @example Handle individual variant errors
     * ```ts
     * try {
     *   await buildService.build();
     * } catch (error) {
     *   if (error instanceof AggregateError) {
     *     console.error(`${error.errors.length} variants failed`);
     *   }
     * }
     * ```
     *
     * @see {@link enhancedBuildResult}
     * @see {@link BuildResultInterface}
     * @see {@link VariantService.build}
     *
     * @since 2.0.0
     */

    async build(names?: Array<string>): Promise<Record<string, BuildResultInterface>> {
        const errorList: Array<Error> = [];
        const results: Record<string, BuildResultInterface> = {};
        const buildPromises = Object.entries(this.variants).map(async ([ variantName, variantInstance ]) => {
            if(names && !names.includes(variantName)) return;

            try {
                const result = await variantInstance.build();
                if(result) results[variantName] = enhancedBuildResult(result);
            } catch(error) {
                if (isBuildResultError(error) || error instanceof AggregateError) {
                    const result = enhancedBuildResult({
                        errors: error.errors as Array<Message>
                    });

                    errorList.push(...result.errors);
                } else if(error instanceof Error) {
                    errorList.push(error);
                } else {
                    errorList.push(new Error(String(error)));
                }
            }
        });

        await Promise.allSettled(buildPromises);
        if(errorList.length) throw new AggregateError(errorList, 'Build failed');

        return results;
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
        if(this.onEndCallback) this.onEndCallback(context);
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
            if(this.onStartCallback) this.onStartCallback(context);

            return result;
        } catch(error) {
            const errors: Array<PartialMessage> = [];
            if(error instanceof AggregateError) {
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
        if(!this.config.variants)
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
}
