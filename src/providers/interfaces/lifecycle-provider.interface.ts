/**
 * Import will remove at compile time
 */

import type { PluginBuild, OnStartResult, OnEndResult, OnResolveResult } from 'esbuild';
import type { OnLoadResult, Loader, OnLoadArgs, BuildResult, OnResolveArgs } from 'esbuild';

/**
 * Represents a value that may be synchronous, asynchronous, void, null, or the specified type.
 *
 * @template T - The actual value type when present
 *
 * @remarks
 * This utility type is used for hook handlers that may return values in multiple forms:
 * - Synchronous return: `T`, `void`, or `null`
 * - Asynchronous return: `Promise<T>`, `Promise<void>`, or `Promise<null>`
 *
 * This flexibility allows hooks to be implemented as sync or async functions and to optionally
 * return results. Handlers that don't need to return data can return `void` or `null`.
 *
 * @example
 * ```ts
 * // All valid implementations
 * const sync: MaybeVoidPromiseType<string> = 'result';
 * const voidSync: MaybeVoidPromiseType<string> = null;
 * const async: MaybeVoidPromiseType<string> = Promise.resolve('result');
 * const voidAsync: MaybeVoidPromiseType<string> = Promise.resolve(null);
 * ```
 *
 * @see {@link OnEndType}
 * @see {@link OnStartType}
 *
 * @since 2.0.0
 */

export type MaybeVoidPromiseType<T> = void | null | T | Promise<void | null | T>;

/**
 * Represents a value that may be synchronous, asynchronous, undefined, null, or the specified type.
 *
 * @template T - The actual value type when present
 *
 * @remarks
 * This utility type is used for hook handlers that may return values in multiple forms:
 * - Synchronous return: `T`, `undefined`, or `null`
 * - Asynchronous return: `Promise<T>`, `Promise<undefined>`, or `Promise<null>`
 *
 * Similar to {@link MaybeVoidPromiseType} but uses `undefined` instead of `void`, allowing handlers
 * to explicitly return nothing or optionally return results. This distinction is important for
 * hooks where the absence of a return value has semantic meaning (like allowing default behavior).
 *
 * @example
 * ```ts
 * // All valid implementations
 * const sync: MaybeUndefinedPromiseType<object> = { path: '/file.ts' };
 * const undefinedSync: MaybeUndefinedPromiseType<object> = undefined;
 * const async: MaybeUndefinedPromiseType<object> = Promise.resolve({ path: '/file.ts' });
 * const undefinedAsync: MaybeUndefinedPromiseType<object> = Promise.resolve(undefined);
 * ```
 *
 * @see {@link OnLoadType}
 * @see {@link OnResolveType}
 *
 * @since 2.0.0
 */

export type MaybeUndefinedPromiseType<T> = undefined | null | T | Promise<undefined | null | T>;

/**
 * Represents a transient build stage state shared across hook handlers during a single build.
 *
 * @remarks
 * This interface provides a flexible container for storing temporary data during the build lifecycle.
 * It's reset at the start of each build and is available to all hooks through the plugin context.
 *
 * The `startTime` property is always present and set when the build begins, allowing hooks to
 * calculate durations and timing information. Additional properties can be added dynamically
 * using the index signature to facilitate cross-handler communication.
 *
 * Common use cases:
 * - Storing build start time for duration calculations
 * - Passing data between different hook handlers
 * - Accumulating statistics during the build
 * - Caching computed values for reuse across hooks
 *
 * @example
 * ```ts
 * // In onStart hook
 * context.stage.startTime = new Date();
 * context.stage.fileCount = 0;
 *
 * // In onLoad hook
 * context.stage.fileCount++;
 *
 * // In onEnd hook
 * const duration = Date.now() - context.stage.startTime.getTime();
 * console.log(`Processed ${context.stage.fileCount} files in ${duration}ms`);
 * ```
 *
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export interface LifecycleStageInterface {

    /**
     * Timestamp when the build process started.
     *
     * @remarks
     * Set during the first `onStart` hook execution and available throughout the build lifecycle.
     * Used to calculate build duration and timing information.
     *
     * @since 2.0.0
     */

    startTime: Date;

    /**
     * Additional dynamic properties for cross-handler communication.
     *
     * @remarks
     * Handlers can store arbitrary data in the stage object using any string key.
     * This allows passing information between hooks during a single build.
     *
     * @since 2.0.0
     */

    [key: string]: unknown;
}

/**
 * Base context interface shared by all lifecycle hook handlers.
 * Provides access to plugin configuration, command-line arguments, and transient build state.
 *
 * @remarks
 * This context is initialized during the `onStart` phase and remains available throughout the
 * entire build lifecycle. All hook handlers receive a variant of this context, enabling:
 * - Access to command-line arguments and configuration
 * - Cross-handler communication through the stage object
 * - Consistent variant identification across hooks
 *
 * The context is immutable at the top level (variantName and argv don't change during a build),
 * but the stage object is mutable and reset between builds.
 *
 * @example
 * ```ts
 * // In onStart hook
 * const handler: OnStartType = async (context) => {
 *   console.log(`Variant ${context.variantName} starting`);
 *   context.stage.customData = { processed: 0 };
 * };
 * ```
 *
 * @see {@link LoadContextInterface}
 * @see {@link BuildContextInterface}
 * @see {@link ResultContextInterface}
 * @see {@link ResolveContextInterface}
 * @see {@link LifecycleStageInterface}
 *
 * @since 2.0.0
 */

export interface LifecycleContextInterface {
    /**
     * Command-line arguments and configuration options passed to the provider.
     *
     * @remarks
     * Contains all CLI options and flags passed when the provider was created.
     * Available to all handlers for accessing build-specific configuration like
     * debug flags, output paths, or custom settings.
     *
     * @example
     * ```ts
     * context.argv; // { debug: true, verbose: false, outdir: 'dist' }
     * ```
     *
     * @since 2.0.0
     */

    argv: Record<string, unknown>;

    /**
     * Transient state object for cross-handler communication during a single build.
     *
     * @remarks
     * Reset to contain only `startTime` at the beginning of each build. Handlers can store
     * and retrieve temporary data during the build lifecycle through this object.
     *
     * Common patterns:
     * - Accumulating statistics across multiple hooks
     * - Passing processed data between different hook types
     * - Caching expensive computations for reuse
     *
     * @example
     * ```ts
     * // Store data in onLoad
     * context.stage.transformedFiles = [];
     *
     * // Access in onEnd
     * console.log(`Transformed ${context.stage.transformedFiles.length} files`);
     * ```
     *
     * @see {@link LifecycleStageInterface}
     *
     * @since 2.0.0
     */

    stage: LifecycleStageInterface;

    /**
     * Identifier for the build variant or plugin instance.
     *
     * @remarks
     * Used for identification and logging. Same as the variant name passed to
     * the HooksProvider constructor or build configuration.
     *
     * @example
     * ```ts
     * context.variantName; // 'production' or 'development'
     * ```
     *
     * @since 2.0.0
     */

    variantName: string;
}

/**
 * Context interface for `onStart` hooks, providing access to the esbuild plugin build object.
 *
 * @remarks
 * This specialized context extends the base lifecycle context with the esbuild `PluginBuild`
 * object, giving start hooks access to build configuration, utilities, and the ability to
 * register additional esbuild hooks dynamically.
 *
 * Start hooks are the only lifecycle phase that receives the build object, as they execute
 * before file processing begins and may need to configure or inspect build settings.
 *
 * @example
 * ```ts
 * const handler: OnStartType = async (context) => {
 *   const { build, variantName, argv } = context;
 *   console.log(`Starting ${variantName} build`);
 *
 *   // Access build configuration
 *   console.log(`Platform: ${build.initialOptions.platform}`);
 *
 *   return { errors: [], warnings: [] };
 * };
 * ```
 *
 * @see {@link OnStartType}
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export interface BuildContextInterface extends LifecycleContextInterface {
    /**
     * The esbuild plugin build object providing build configuration and utilities.
     *
     * @remarks
     * Provides access to:
     * - `initialOptions`: Build configuration options
     * - `resolve`: Path resolution utilities
     * - Dynamic hook registration methods
     * - Build environment information
     *
     * Available only in `onStart` hooks, as later phases don't require build-level access.
     *
     * @example
     * ```ts
     * // Access initial options
     * const outdir = context.build.initialOptions.outdir;
     *
     * // Resolve a path
     * const resolved = await context.build.resolve('./module', {
     *   resolveDir: '/src'
     * });
     * ```
     *
     * @since 2.0.0
     */

    build: PluginBuild;
}

/**
 * Context interface for `onEnd` and `onSuccess` hooks, providing access to build results and duration.
 *
 * @remarks
 * This specialized context extends the base lifecycle context with the final build result
 * and calculated build duration, giving end hooks access to a build outcome, errors, warnings,
 * and metadata.
 *
 * The duration is automatically calculated from the start time in the stage object, providing
 * a convenient way to measure build performance without manual timestamp calculations.
 *
 * @example
 * ```ts
 * const handler: OnEndType = async (context) => {
 *   const { buildResult, duration, variantName } = context;
 *
 *   console.log(`${variantName} build completed in ${duration}ms`);
 *
 *   if (buildResult.errors.length > 0) {
 *     console.error(`Build failed with ${buildResult.errors.length} errors`);
 *   }
 *
 *   // Access metafile for dependency analysis
 *   if (buildResult.metafile) {
 *     console.log('Outputs:', Object.keys(buildResult.metafile.outputs));
 *   }
 * };
 * ```
 *
 * @see {@link OnEndType}
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export interface ResultContextInterface extends LifecycleContextInterface {
    /**
     * Build duration in milliseconds.
     *
     * @remarks
     * Automatically calculated as the time elapsed from `context.stage.startTime` to
     * when the build completed. Useful for performance monitoring and reporting.
     *
     * @example
     * ```ts
     * console.log(`Build took ${context.duration}ms`);
     * ```
     *
     * @since 2.0.0
     */

    duration: number;

    /**
     * The final build result from esbuild containing errors, warnings, and metadata.
     *
     * @remarks
     * Provides access to:
     * - `errors`: Array of build errors
     * - `warnings`: Array of build warnings
     * - `metafile`: Build metadata including inputs, outputs, and dependencies
     * - `outputFiles`: Generated file contents (if `write: false`)
     *
     * @example
     * ```ts
     * // Check for errors
     * if (context.buildResult.errors.length > 0) {
     *   // Handle build failure
     * }
     *
     * // Analyze dependencies
     * const inputs = context.buildResult.metafile?.inputs;
     * ```
     *
     * @since 2.0.0
     */

    buildResult: BuildResult;
}

/**
 * Context interface for `onResolve` hooks, providing access to resolution arguments.
 *
 * @remarks
 * This specialized context extends the base lifecycle context with esbuild's resolution
 * arguments, giving resolve hooks access to the import path, importer information, and
 * resolution context needed to implement custom module resolution logic.
 *
 * Resolve hooks use this context to determine how to resolve import paths, redirect imports,
 * or mark modules as external based on the resolution arguments.
 *
 * @example
 * ```ts
 * const handler: OnResolveType = async (context) => {
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
 *   // Mark node_modules as external in development
 *   if (variantName === 'development' && args.path.includes('node_modules')) {
 *     return { path: args.path, external: true };
 *   }
 *
 *   return undefined; // Use default resolution
 * };
 * ```
 *
 * @see {@link OnResolveType}
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export interface ResolveContextInterface extends LifecycleContextInterface {
    /**
     * Resolution arguments from esbuild containing the import path and resolution context.
     *
     * @remarks
     * Provides access to:
     * - `path`: The import path to resolve (e.g., './module', '\@/utils')
     * - `importer`: The file that contains this import
     * - `namespace`: The namespace of the importer
     * - `resolveDir`: The directory to resolve relative imports from
     * - `kind`: The kind of import (e.g., 'import-statement', 'require-call')
     * - `pluginData`: Data passed from previous plugins
     *
     * @example
     * ```ts
     * console.log(`Resolving ${context.args.path} from ${context.args.importer}`);
     *
     * if (context.args.kind === 'dynamic-import') {
     *   // Handle dynamic imports specially
     * }
     * ```
     *
     * @since 2.0.0
     */

    args: OnResolveArgs;
}

/**
 * Context interface for `onLoad` hooks, providing access to load arguments, current contents, and loader.
 *
 * @remarks
 * This specialized context extends the base lifecycle context with esbuild's load arguments,
 * the current file contents (potentially transformed by previous hooks), and the current loader
 * type. This enables load hooks to implement content transformations in a pipeline pattern.
 *
 * Load hooks receive the output of previous hooks through `contents` and `loader`, allowing
 * sequential transformations where each hook builds on the work of previous hooks.
 *
 * @example
 * ```ts
 * const handler: OnLoadType = async (context) => {
 *   const { contents, loader, args, variantName } = context;
 *
 *   // Transform .custom files to TypeScript
 *   if (args.path.endsWith('.custom')) {
 *     return {
 *       contents: transformCustomSyntax(contents.toString()),
 *       loader: 'ts'
 *     };
 *   }
 *
 *   // Add debugging in development
 *   if (variantName === 'development' && loader === 'ts') {
 *     return {
 *       contents: `console.log('Loading: ${args.path}');\n${contents}`,
 *       loader
 *     };
 *   }
 *
 *   return undefined; // Pass through unchanged
 * };
 * ```
 *
 * @see {@link OnLoadType}
 * @see {@link LifecycleContextInterface}
 *
 * @since 2.0.0
 */

export interface LoadContextInterface extends LifecycleContextInterface {
    /**
     * Load arguments from esbuild containing file path and namespace.
     *
     * @remarks
     * Provides access to:
     * - `path`: The absolute path to the file being loaded
     * - `namespace`: The namespace for this module
     * - `suffix`: Optional suffix for special handling
     * - `pluginData`: Data passed from resolve hooks or previous plugins
     *
     * @example
     * ```ts
     * console.log(`Loading ${context.args.path}`);
     *
     * if (context.args.namespace === 'virtual') {
     *   // Handle virtual modules
     * }
     * ```
     *
     * @since 2.0.0
     */

    args: OnLoadArgs;

    /**
     * The current loader type for this file.
     *
     * @remarks
     * Reflects any loader changes made by previous hooks in the pipeline. Can be:
     * - `'js'`, `'ts'`, `'jsx'`, `'tsx'`: JavaScript/TypeScript variants
     * - `'json'`, `'css'`, `'text'`: Special content types
     * - `'base64'`, `'binary'`, `'dataurl'`: Binary content encodings
     * - `'default'`: Let esbuild determine the loader
     * - `undefined`: No loader has been set yet
     *
     * Hooks can change the loader to affect how esbuild processes the contents.
     *
     * @example
     * ```ts
     * if (context.loader === 'json') {
     *   // Transform JSON before esbuild processes it
     * }
     * ```
     *
     * @since 2.0.0
     */

    loader: Loader | undefined;

    /**
     * The current file contents as string or binary data.
     *
     * @remarks
     * Contains the output of previous load hooks in the pipeline, or the initial file
     * contents if this is the first hook. Hooks can transform this content and return
     * new contents for further hooks to process.
     *
     * Content can be:
     * - `string`: Text content (source code, JSON, CSS, etc.)
     * - `Uint8Array`: Binary content (images, fonts, etc.)
     *
     * @example
     * ```ts
     * // Transform string contents
     * const transformed = context.contents.toString().replace(/old/g, 'new');
     *
     * // Check content type
     * if (typeof context.contents === 'string') {
     *   // Handle text
     * } else {
     *   // Handle binary
     * }
     * ```
     *
     * @since 2.0.0
     */

    contents: string | Uint8Array;
}

/**
 * Handler function signature for `onStart` hooks executed when a build begins.
 *
 * @param context - Build context containing the esbuild build object, arguments, and stage state
 *
 * @returns Optional result containing errors and warnings to report, or void/null if none
 *
 * @remarks
 * Start hooks are executed before any file processing occurs and receive a build context
 * with access to the esbuild `PluginBuild` object. They can perform initialization tasks
 * and return errors or warnings that will be aggregated with results from other start hooks.
 *
 * Return value semantics:
 * - Return `void` or `null` if the hook has nothing to report
 * - Return `OnStartResult` with errors/warnings arrays to report issues
 * - Can be synchronous or asynchronous (return a Promise)
 *
 * @example
 * ```ts
 * const onStart: OnStartType = async (context) => {
 *   console.log(`Starting ${context.variantName} build`);
 *   context.stage.startTime = new Date();
 *
 *   // Validate build configuration
 *   if (!context.build.initialOptions.outdir) {
 *     return {
 *       errors: [{
 *         text: 'Output directory not specified',
 *         location: null
 *       }]
 *     };
 *   }
 *
 *   return { errors: [], warnings: [] };
 * };
 * ```
 *
 * @see {@link MaybeVoidPromiseType}
 * @see {@link BuildContextInterface}
 * @see {@link LifecycleProvider.onStart}
 *
 * @since 2.0.0
 */

export type OnStartType = (context: BuildContextInterface) => MaybeVoidPromiseType<OnStartResult>;

/**
 * Handler function signature for `onEnd` and `onSuccess` hooks executed when a build completes.
 *
 * @param context - Result context containing the build result, duration, arguments, and stage state
 *
 * @returns Optional result containing additional errors and warnings to report, or void/null if none
 *
 * @remarks
 * End hooks are executed after all build operations are complete, regardless of success or failure.
 * They receive a result context with the final build outcome, calculated duration, and can perform
 * cleanup, logging, or post-processing tasks.
 *
 * Success hooks use the same signature but only execute when `context.buildResult.errors.length === 0`,
 * making them suitable for deployment or success-only operations.
 *
 * Return value semantics:
 * - Return `void` or `null` if the hook has nothing to report
 * - Return `OnEndResult` with errors/warnings arrays to add to build output
 * - Can be synchronous or asynchronous (return a Promise)
 *
 * @example
 * ```ts
 * const onEnd: OnEndType = async (context) => {
 *   console.log(`${context.variantName} build completed in ${context.duration}ms`);
 *
 *   if (context.buildResult.errors.length > 0) {
 *     console.error(`Build failed with ${context.buildResult.errors.length} errors`);
 *   } else {
 *     console.log('Build succeeded!');
 *   }
 *
 *   // Clean up temporary files
 *   await cleanupTempFiles(context.stage.tempDir);
 * };
 * ```
 *
 * @example
 * ```ts
 * const onSuccess: OnEndType = async (context) => {
 *   console.log('Deploying build artifacts...');
 *   await deploy(context.buildResult.metafile);
 * };
 * ```
 *
 * @see {@link MaybeVoidPromiseType}
 * @see {@link ResultContextInterface}
 * @see {@link LifecycleProvider.onEnd}
 * @see {@link LifecycleProvider.onSuccess}
 *
 * @since 2.0.0
 */

export type OnEndType = (context: ResultContextInterface) => MaybeVoidPromiseType<OnEndResult>;

/**
 * Handler function signature for `onResolve` hooks executed during module path resolution.
 *
 * @param context - Resolve context containing resolution arguments, variant name, and stage state
 *
 * @returns Optional resolution result to override default resolution, or undefined/null for default behavior
 *
 * @remarks
 * Resolve hooks are executed when esbuild needs to resolve import paths to file system locations.
 * They receive a resolve context with the import path, importer information, and can redirect imports,
 * implement custom resolution algorithms, or provide virtual modules.
 *
 * Return value semantics:
 * - Return `undefined` or `null` to allow default esbuild resolution
 * - Return `OnResolveResult` to override with custom resolution (path, namespace, external flag, etc.)
 * - Can be synchronous or asynchronous (return a Promise)
 *
 * Multiple resolve hooks can execute, and their results are merged, with later hooks able to
 * override properties set by earlier hooks.
 *
 * @example
 * ```ts
 * const onResolve: OnResolveType = async (context) => {
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
 *   // Mark dependencies as external in production
 *   if (variantName === 'production' && args.path.startsWith('lodash')) {
 *     return { path: args.path, external: true };
 *   }
 *
 *   // Allow default resolution
 *   return undefined;
 * };
 * ```
 *
 * @see {@link ResolveContextInterface}
 * @see {@link MaybeUndefinedPromiseType}
 * @see {@link LifecycleProvider.onResolve}
 *
 * @since 2.0.0
 */

export type OnResolveType = (context: ResolveContextInterface) => MaybeUndefinedPromiseType<OnResolveResult>;

/**
 * Handler function signature for `onLoad` hooks executed when loading file contents.
 *
 * @param context - Load context containing current contents, loader, load arguments, and stage state
 *
 * @returns Optional load result to transform contents or change loader, or undefined/null for no changes
 *
 * @remarks
 * Load hooks are executed when esbuild loads file contents and can transform the contents,
 * change the loader type, or inject additional code. Multiple load hooks execute in a pipeline
 * pattern where each hook receives the transformed output of previous hooks through the context.
 *
 * Return value semantics:
 * - Return `undefined` or `null` to pass contents unchanged to the next hook
 * - Return `OnLoadResult` with `contents` to transform file contents
 * - Return `OnLoadResult` with `loader` to change the loader type
 * - Can be synchronous or asynchronous (return a Promise)
 *
 * The `context.contents` property receives the output of previous hooks, and `context.loader`
 * reflects any loader changes made by previous hooks.
 *
 * @example
 * ```ts
 * const onLoad: OnLoadType = async (context) => {
 *   const { contents, loader, args, variantName } = context;
 *
 *   // Transform .custom files to TypeScript
 *   if (args.path.endsWith('.custom')) {
 *     return {
 *       contents: transformCustomSyntax(contents.toString()),
 *       loader: 'ts'
 *     };
 *   }
 *
 *   // Inject environment variables in development
 *   if (variantName === 'development' && loader === 'js') {
 *     return {
 *       contents: `const ENV = '${variantName}';\n${contents}`,
 *       loader
 *     };
 *   }
 *
 *   // Pass through unchanged
 *   return undefined;
 * };
 * ```
 *
 * @see {@link LoadContextInterface}
 * @see {@link LifecycleProvider.onLoad}
 * @see {@link MaybeUndefinedPromiseType}
 *
 * @since 2.0.0
 */

export type OnLoadType = (context: LoadContextInterface) => MaybeUndefinedPromiseType<OnLoadResult>;
