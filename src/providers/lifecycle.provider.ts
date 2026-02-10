/**
 * Type imports (removed at compile time)
 */

import type { PluginBuild, Plugin, OnStartResult, OnEndResult } from 'esbuild';
import type { OnEndType, OnLoadType, OnStartType } from './interfaces/lifecycle-provider.interface';
import type { BuildResult, OnResolveResult, OnResolveArgs, OnLoadResult, OnLoadArgs } from 'esbuild';
import type { OnResolveType, LifecycleContextInterface } from './interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import { readFile } from 'fs/promises';
import { inject } from '@symlinks/symlinks.module';
import { resolve } from '@components/path.component';
import { FilesModel } from '@typescript/models/files.model';

/**
 * Manages lifecycle hooks for esbuild plugins with support for build stages and hook execution coordination.
 * Provides a centralized system for registering and executing hooks during different phases of the build process,
 * including resolution, loading, start, end, and success stages.
 *
 * @remarks
 * This provider implements a hook-based architecture that allows multiple handlers to be registered
 * for each build lifecycle stage. Hooks are stored in maps keyed by name, allowing for organized
 * registration and execution of build-time logic.
 *
 * The lifecycle stages are executed in the following order:
 * 1. **onStart**: Executed when the build begins, before any file processing
 * 2. **onResolve**: Executed during module resolution for each import
 * 3. **onLoad**: Executed when loading file contents for each module
 * 4. **onEnd**: Executed when the build completes (success or failure)
 * 5. **onSuccess**: Executed only when the build completes without errors
 *
 * Hook execution strategy:
 * - Start and end hooks aggregate errors and warnings from all handlers
 * - Resolve hooks merge results from multiple handlers
 * - Load hooks apply transformations sequentially (pipeline pattern)
 * - All hooks receive a specialized context object appropriate for their lifecycle stage
 *
 * @example
 * ```ts
 * const provider = new LifecycleProvider('my-plugin', { debug: true });
 *
 * provider.onStart(async (context) => {
 *   console.log('Build starting...');
 *   return { warnings: [] };
 * });
 *
 * provider.onLoad(async (context) => {
 *   // Transform TypeScript files
 *   if (context.args.path.endsWith('.ts')) {
 *     return { contents: transformCode(context.contents), loader: 'ts' };
 *   }
 * });
 *
 * const plugin = provider.create();
 * ```
 *
 * @see {@link FilesModel}
 * @see {@link LoadContextInterface}
 * @see {@link BuildContextInterface}
 * @see {@link ResultContextInterface}
 * @see {@link ResolveContextInterface}
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export class LifecycleProvider {
    /**
     * File model for accessing TypeScript language service snapshots and file content.
     * @since 2.0.0
     */

    private filesModel: FilesModel = inject(FilesModel);

    /**
     * Registered handlers to execute when the build completes, regardless of success or failure.
     * @since 2.0.0
     */

    private readonly endHooks = new Map<string, OnEndType>();

    /**
     * Registered handlers to execute when loading file contents during module processing.
     * @since 2.0.0
     */

    private readonly loadHooks = new Map<string, OnLoadType>();

    /**
     * Registered handlers to execute when the build process begins.
     * @since 2.0.0
     */

    private readonly startHooks = new Map<string, OnStartType>();

    /**
     * Registered handlers to execute when the build completes successfully without errors.
     * @since 2.0.0
     */

    private readonly successHooks = new Map<string, OnEndType>();

    /**
     * Registered handlers to execute during module path resolution.
     * @since 2.0.0
     */

    private readonly resolveHooks = new Map<string, OnResolveType>();

    /**
     * Creates a new lifecycle provider instance with the specified variant name and configuration.
     *
     * @param variantName - The variant name used for identification and included in hook contexts
     * @param argv - Command-line arguments and configuration options passed to hook handlers
     *
     * @remarks
     * The constructor initializes empty hook maps for each lifecycle stage. The `variantName` parameter
     * is used as the default identifier when registering hooks without explicit names and is
     * included in the context passed to all handlers as `variantName`.
     *
     * The `argv` configuration is stored and made available to all hooks through their context objects,
     * allowing build-time behavior to be customized based on command-line flags or configuration.
     *
     * @example
     * ```ts
     * const provider = new LifecycleProvider('production', {
     *   watch: false,
     *   sourcemap: true,
     *   minify: true
     * });
     * ```
     *
     * @since 2.0.0
     */

    constructor(protected variantName: string, protected argv: Record<string, unknown>) {
    }

    /**
     * Registers a handler to execute when the build process begins.
     *
     * @param handler - Optional callback function to execute at build start
     * @param name - Optional identifier for this hook, defaults to the variant name
     *
     * @remarks
     * Start hooks are executed before any file processing occurs and receive a build context
     * containing the esbuild `PluginBuild` object, variant name, arguments, and stage state.
     * They can return errors and warnings that will be aggregated with results from other start hooks.
     *
     * If no handler is provided, this method does nothing (allowing conditional registration).
     * Multiple start hooks can be registered with different names and will all execute in
     * registration order.
     *
     * Common use cases:
     * - Initialization and setup tasks
     * - Validation of build configuration
     * - Cleaning output directories
     * - Logging build start time
     *
     * @example
     * ```ts
     * provider.onStart(async (context) => {
     *   console.log(`${context.variantName} build started at ${context.stage.startTime}`);
     *   return { warnings: [], errors: [] };
     * });
     * ```
     *
     * @see {@link executeStartHooks}
     * @see {@link BuildContextInterface}
     *
     * @since 2.0.0
     */

    onStart(handler?: OnStartType, name: string = this.variantName): void {
        if (!handler) return;
        this.startHooks.set(name, handler);
    }

    /**
     * Registers a handler to execute when the build completes, regardless of success or failure.
     *
     * @param handler - Optional callback function to execute at build end
     * @param name - Optional identifier for this hook, defaults to the variant name
     *
     * @remarks
     * End hooks are executed after all build operations are complete and receive a result context
     * containing the final build result, calculated duration, variant name, arguments, and stage state.
     * They can return additional errors and warnings to append to the build output.
     *
     * If no handler is provided, this method does nothing. Multiple end hooks execute in registration
     * order, and all results are aggregated.
     *
     * Common use cases:
     * - Cleanup and resource disposal
     * - Logging build completion and duration
     * - Generating build reports or statistics
     * - Post-processing output files
     *
     * @example
     * ```ts
     * provider.onEnd(async (context) => {
     *   console.log(`${context.variantName} build completed in ${context.duration}ms`);
     *   return { warnings: [], errors: [] };
     * });
     * ```
     *
     * @see {@link onSuccess}
     * @see {@link executeEndHooks}
     * @see {@link ResultContextInterface}
     *
     * @since 2.0.0
     */

    onEnd(handler?: OnEndType, name: string = this.variantName): void {
        if (!handler) return;
        this.endHooks.set(name, handler);
    }

    /**
     * Registers a handler to execute when the build completes successfully without errors.
     *
     * @param handler - Optional callback function to execute on successful build
     * @param name - Optional identifier for this hook, defaults to the variant name
     *
     * @remarks
     * Success hooks are a specialized subset of end hooks that only execute when the build
     * completes with zero errors. They receive a result context containing the build result,
     * duration, and another state, and are guaranteed to run only after successful builds.
     *
     * If no handler is provided, this method does nothing. Success hooks execute after all
     * regular end hooks have completed.
     *
     * Common use cases:
     * - Deploying build artifacts
     * - Running post-build validation
     * - Updating deployment status
     * - Sending success notifications
     *
     * @example
     * ```ts
     * provider.onSuccess(async (context) => {
     *   console.log('Build succeeded! Deploying...');
     *   await deploy(context.buildResult.metafile);
     * });
     * ```
     *
     * @see {@link onEnd}
     * @see {@link executeEndHooks}
     * @see {@link ResultContextInterface}
     *
     * @since 2.0.0
     */

    onSuccess(handler?: OnEndType, name: string = this.variantName): void {
        if (!handler) return;
        this.successHooks.set(name, handler);
    }

    /**
     * Registers a handler to execute during module path resolution.
     *
     * @param handler - Optional callback function to execute during resolution
     * @param name - Optional identifier for this hook, defaults to the variant name
     *
     * @remarks
     * Resolve hooks are executed when esbuild needs to resolve import paths to file system locations.
     * They receive a resolve context containing the resolution arguments, variant name, and stage state.
     * Hooks can return modified resolution results or redirect imports.
     *
     * If no handler is provided, this method does nothing. Multiple resolve hooks can execute, and
     * their results are merged, with later hooks potentially overriding earlier ones.
     *
     * Common use cases:
     * - Implementing custom module resolution algorithms
     * - Redirecting imports to alternative locations
     * - Handling path aliases and mappings
     * - Resolving virtual modules
     *
     * @example
     * ```ts
     * provider.onResolve(async (context) => {
     *   if (context.args.path.startsWith('@/')) {
     *     return { path: resolve('src', context.args.path.slice(2)) };
     *   }
     * });
     * ```
     *
     * @see {@link executeResolveHooks}
     * @see {@link ResolveContextInterface}
     *
     * @since 2.0.0
     */

    onResolve(handler?: OnResolveType, name: string = this.variantName): void {
        if (!handler) return;
        this.resolveHooks.set(name, handler);
    }

    /**
     * Registers a handler to execute when loading file contents during module processing.
     *
     * @param handler - Optional callback function to execute during file loading
     * @param name - Optional identifier for this hook, defaults to the variant name
     *
     * @remarks
     * Load hooks are executed when esbuild loads file contents and receive a load context containing
     * the current contents (potentially transformed by previous hooks), loader type, load arguments,
     * variant name, and stage state. Hooks can transform the contents and change the loader,
     * with transformations applied sequentially in a pipeline pattern.
     *
     * If no handler is provided, this method does nothing. Multiple load hooks execute in
     * registration order, with each hook receiving the transformed output of previous hooks
     * through the context.
     *
     * Common use cases:
     * - Transforming file contents (transpilation, minification)
     * - Injecting code or imports
     * - Applying preprocessors
     * - Changing file loader types
     *
     * @example
     * ```ts
     * provider.onLoad(async (context) => {
     *   if (context.args.path.endsWith('.custom')) {
     *     return {
     *       contents: transformCustomSyntax(context.contents),
     *       loader: 'ts'
     *     };
     *   }
     * });
     * ```
     *
     * @see {@link executeLoadHooks}
     * @see {@link LoadContextInterface}
     *
     * @since 2.0.0
     */

    onLoad(handler?: OnLoadType, name: string = this.variantName): void {
        if (!handler) return;
        this.loadHooks.set(name, handler);
    }

    /**
     * Clears all registered hooks from all lifecycle stages.
     *
     * @remarks
     * This method removes all registered handlers for start, end, success, resolve, and load hooks.
     * It's typically used when resetting the provider state or preparing for a new build configuration.
     *
     * After calling this method, the provider has no registered hooks and will not execute any
     * handlers until new ones are registered.
     *
     * @example
     * ```ts
     * provider.onStart(startHandler);
     * provider.onEnd(endHandler);
     *
     * // Remove all hooks
     * provider.clearAll();
     *
     * // Provider now has no registered hooks
     * ```
     *
     * @since 2.0.0
     */

    clearAll(): void {
        this.endHooks.clear();
        this.loadHooks.clear();
        this.startHooks.clear();
        this.successHooks.clear();
        this.resolveHooks.clear();
    }

    /**
     * Creates an esbuild plugin instance with all registered hooks configured.
     *
     * @returns Configured esbuild plugin object ready for use in build configuration
     *
     * @remarks
     * This method generates an esbuild plugin that wires up all registered hooks to the
     * appropriate esbuild lifecycle events. The plugin setup function:
     * - Initializes a base lifecycle context with variant name, arguments, and start time
     * - Enables metafile generation for build metadata
     * - Registers onStart handler if any start hooks exist
     * - Registers onEnd handler if any end or success hooks exist
     * - Registers onResolve handler with catch-all filter if any resolve hooks exist
     * - Registers onLoad handler with catch-all filter if any load hooks exist
     *
     * Each hook receives a specialized context appropriate for its lifecycle stage:
     * - Start hooks receive `BuildContextInterface` with the build object
     * - End/Success hooks receive `ResultContextInterface` with build result and duration
     * - Resolve hooks receive `ResolveContextInterface` with resolution arguments
     * - Load hooks receive `LoadContextInterface` with contents, loader, and load arguments
     *
     * The returned plugin uses the provider's name and delegates hook execution to
     * the internal execution methods.
     *
     * @example
     * ```ts
     * const provider = new LifecycleProvider('production', {});
     * provider.onStart(startHandler);
     * provider.onLoad(loadHandler);
     *
     * const plugin = provider.create();
     *
     * await esbuild.build({
     *   entryPoints: ['src/index.ts'],
     *   plugins: [plugin]
     * });
     * ```
     *
     * @see {@link executeEndHooks}
     * @see {@link executeLoadHooks}
     * @see {@link executeStartHooks}
     * @see {@link executeResolveHooks}
     *
     * @since 2.0.0
     */

    create(): Plugin {
        return {
            name: this.variantName,
            setup: (build: PluginBuild): void => {
                const context: LifecycleContextInterface = {
                    argv: this.argv,
                    variantName: this.variantName,
                    stage: {
                        startTime: new Date()
                    }
                };

                build.initialOptions.metafile = true;
                if (this.startHooks.size > 0)
                    build.onStart(async () => this.executeStartHooks(build, context));

                if (this.endHooks.size > 0 || this.successHooks.size > 0)
                    build.onEnd(async (result) => this.executeEndHooks(result, context));

                if (this.resolveHooks.size > 0)
                    build.onResolve({ filter: /.*/ }, async (args) => this.executeResolveHooks(args, context));

                if (this.loadHooks.size > 0)
                    build.onLoad({ filter: /.*/ }, async (args) => this.executeLoadHooks(args, context));
            }
        };
    }

    /**
     * Executes all registered start hooks and aggregates their results.
     *
     * @param build - The esbuild plugin build object
     * @param context - Base lifecycle context containing variant name, arguments, and stage state
     * @returns Aggregated result containing all errors and warnings from start hooks
     *
     * @remarks
     * This method resets the start time in the stage object, then executes all registered
     * start hooks in order. Each hook receives a build context that includes the esbuild
     * build object along with the base lifecycle context.
     *
     * Results from all hooks are aggregated:
     * - Errors from all hooks are combined into a single array
     * - Warnings from all hooks are combined into a single array
     *
     * The context object is passed through to later lifecycle stages for consistent
     * state management across the build.
     *
     * @see {@link onStart}
     * @see {@link BuildContextInterface}
     *
     * @since 2.0.0
     */

    private async executeStartHooks(build: PluginBuild, context: LifecycleContextInterface): Promise<OnStartResult> {
        context.stage.startTime = new Date();
        const result: Required<OnStartResult> = {
            errors: [],
            warnings: []
        };

        for (const hook of this.startHooks.values()) {
            const hookResult = await hook({ build, ...context });
            if (hookResult) {
                if (hookResult.errors) result.errors.push(...hookResult.errors);
                if (hookResult.warnings) result.warnings.push(...hookResult.warnings);
            }
        }

        return result;
    }

    /**
     * Executes all registered end hooks and success hooks, aggregating their results.
     *
     * @param buildResult - The final build result from esbuild
     * @param context - Base lifecycle context containing variant name, arguments, and stage state
     * @returns Aggregated result containing all errors and warnings from end hooks
     *
     * @remarks
     * This method calculates the build duration from the start time and executes hooks in two phases:
     * 1. **End hooks**: Execute for all builds with a result context containing build result and duration,
     *    errors and warnings are aggregated
     * 2. **Success hooks**: Execute only if `buildResult.errors.length === 0` with the same result context
     *
     * Success hooks do not contribute to the returned result object, as they execute after
     * aggregation is complete. They are primarily used for side effects like deployment or
     * notification rather than modifying the build result.
     *
     * @see {@link onEnd}
     * @see {@link onSuccess}
     * @see {@link ResultContextInterface}
     *
     * @since 2.0.0
     */

    private async executeEndHooks(buildResult: BuildResult, context: LifecycleContextInterface): Promise<OnEndResult> {
        const result: Required<OnEndResult> = {
            errors: [],
            warnings: []
        };

        const duration = Date.now() - context.stage.startTime.getTime();
        for (const hook of this.endHooks.values()) {
            const hookResult = await hook({ buildResult, duration, ...context });
            if (hookResult) {
                if (hookResult.errors) result.errors.push(...hookResult.errors);
                if (hookResult.warnings) result.warnings.push(...hookResult.warnings);
            }
        }

        if (buildResult.errors.length === 0) {
            for (const hook of this.successHooks.values()) {
                await hook({ buildResult, duration, ...context });
            }
        }

        return result;
    }

    /**
     * Executes all registered resolve hooks and merges their results.
     *
     * @param args - The resolution arguments from esbuild
     * @param context - Base lifecycle context containing variant name, arguments, and stage state
     * @returns Merged resolution result from all hooks, or `null` if no hooks returned results
     *
     * @remarks
     * This method executes all resolve hooks in registration order, passing each hook a resolve
     * context that includes the resolution arguments along with the base lifecycle context.
     * Results are merged using object spreading, meaning later hooks can override properties
     * set by earlier hooks.
     *
     * If no hooks return results, this method returns `null` to allow esbuild's default
     * resolution to proceed. If any hook returns a result, that result becomes the base
     * for later merging.
     *
     * @see {@link onResolve}
     * @see {@link ResolveContextInterface}
     *
     * @since 2.0.0
     */

    private async executeResolveHooks(args: OnResolveArgs, context: LifecycleContextInterface): Promise<OnResolveResult | null> {
        let result: OnResolveResult | undefined;

        for (const hook of this.resolveHooks.values()) {
            const hookResult = await hook({ args, ...context });
            if (!hookResult) continue;

            if (!result) {
                result = hookResult;
            } else {
                result = { ...result, ...hookResult };
            }
        }

        return result ?? null;
    }

    /**
     * Executes all registered load hooks in sequence, applying content transformations as a pipeline.
     *
     * @param args - The load arguments from esbuild containing file path and namespace
     * @param context - Base lifecycle context containing variant name, arguments, and stage state
     * @returns Load result with final transformed contents and loader type
     *
     * @remarks
     * This method implements a transformation pipeline where:
     * 1. Initial contents are loaded from a TypeScript snapshot or file system
     * 2. Each load hook receives a load context with current contents, loader, and arguments
     * 3. Hooks can transform contents and change the loader
     * 4. Each hook's output becomes the input for the next hook's context
     *
     * Content loading priority:
     * - First attempts to load from TypeScript language service snapshot (if available)
     * - Falls back to reading the file from disk using `fs/promises`
     *
     * The loader starts as `'default'` and can be changed by any hook in the pipeline.
     * The final contents and loader are returned to esbuild for processing.
     *
     * @example
     * ```ts
     * // Hook 1: Load custom syntax
     * // Hook 2: Transform to TypeScript
     * // Hook 3: Add imports
     * // Result: Fully transformed TypeScript ready for compilation
     * ```
     *
     * @see {@link onLoad}
     * @see {@link LoadContextInterface}
     * @see {@link FilesModel.getSnapshot}
     *
     * @since 2.0.0
     */

    private async executeLoadHooks(args: OnLoadArgs, context: LifecycleContextInterface): Promise<OnLoadResult | null> {
        let contents: string | Uint8Array;
        let loader: OnLoadResult['loader'] = 'default';
        const result: Required<OnEndResult> = {
            errors: [],
            warnings: []
        };

        const filePath = resolve(args.path);
        const snapshotObject = this.filesModel.getSnapshot(filePath);

        if (snapshotObject && snapshotObject.contentSnapshot) {
            contents = snapshotObject.contentSnapshot.text;
        } else {
            contents = await readFile(filePath, 'utf8');
        }

        for (const hook of this.loadHooks.values()) {
            const hookResult = await hook({ contents, loader, args, ...context });
            if (hookResult) {
                if (hookResult.contents !== undefined) contents = hookResult.contents;
                if (hookResult.loader) loader = hookResult.loader;
                if (hookResult.errors) result.errors.push(...hookResult.errors);
                if (hookResult.warnings) result.warnings.push(...hookResult.warnings);
            }
        }

        return { contents, loader, ...result };
    }
}
