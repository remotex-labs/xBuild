/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BuildResultType } from '@services/interfaces/transpiler-service.interface';
import type { OnResolveArgs, OnResolveResult, OnStartResult, PluginBuild } from 'esbuild';
import type { MaybeUndefinedPromiseType, MaybeVoidPromiseType } from '@interfaces/types.interface';
import type { LogLevelType, LogOverridesType } from '@providers/interfaces/log-provider.interface';
import type { BuildOptions, Loader, Message, OnLoadArgs, OnLoadResult, PartialMessage } from 'esbuild';

/**
 * The messages a build has collected, filed under the level each was reported at.
 *
 * @remarks
 * Keyed by every level but `silent`, since a message reported at `silent` is dropped rather than kept.
 * Each bucket holds esbuild messages in the order they arrived,
 * so a reporter reads the level it cares about instead of filtering the rest out itself.
 *
 * @example
 * ```ts
 * const logs: LifecycleLogsType = { debug: [], info: [], warning: [], error: [] };
 * logs.error.length; // 0 - nothing has failed yet
 * ```
 *
 * @see LogLevelType
 * @see PartialMessage
 *
 * @since 3.0.0
 */

export type LifecycleLogsType = Record<Exclude<LogLevelType, 'silent'>, Array<PartialMessage>>;

/**
 * The scratch state the hooks of a single build share.
 *
 * @remarks
 * Reset at the start of every build, with the time it began stamped and its two sets empty,
 * so nothing carries over from the build before it.
 * The index signature is what lets one hook leave a value behind for a later one to read.
 *
 * @example
 * ```ts
 * context.stage.startTime;      // when this build began
 * context.stage.loaded = 12;    // read back in a later hook
 * ```
 *
 * @see LifecycleContextInterface
 * @since 2.0.0
 */

export interface LifecycleStageInterface {
    /**
     * When the build began.
     *
     * @remarks
     * Stamped as the build starts and left alone afterward,
     * so a hook needing an elapsed time subtracts it rather than timing the build itself.
     *
     * @example
     * ```ts
     * Date.now() - context.stage.startTime.getTime(); // 1284
     * ```
     *
     * @since 2.0.0
     */

    startTime: Date;

    /**
     * The names of the macro bindings in this build are to drop.
     *
     * @remarks
     * What {@link analyzeMacros} collected from the build's inputs, left here for the stages that run after it,
     * so a hook rewriting a source reads the set rather than analyzing the file for itself.
     * Empty when no input declares a conditional macro.
     *
     * @example
     * ```ts
     * context.stage.dropped.has('$$dev'); // true - its flag resolved to 'false'
     * ```
     *
     * @see analyzeMacros
     * @since 3.0.0
     */

    dropped: Set<string>;

    /**
     * The inputs this build reaches, as the dependency scan named them.
     *
     * @remarks
     * The setup stage collects them from a scan of the entry points with the plugins stripped,
     * so a hook needing the whole input list reads the set rather than walking the graph itself.
     * {@link analyzeMacros} reads the same set,
     * which is what resolves a conditional binding against every file the build reaches.
     * Filled for a bundled build and an unbundled one alike, and empty until the setup stage fills it.
     *
     * @example
     * ```ts
     * context.stage.reachableFiles.has('src/index.ts'); // true
     * ```
     *
     * @see analyzeMacros
     * @since 3.0.0
     */

    reachableFiles: Set<string>;

    /**
     * Any other value a hook chooses to leave on the stage.
     *
     * @remarks
     * Typed as `unknown`, so whatever reads a key back narrows it before use.
     *
     * @example
     * ```ts
     * context.stage.loaded = 12;
     * context.stage.loaded as number; // 12
     * ```
     *
     * @since 2.0.0
     */

    [key: string]: unknown;
}

/**
 * An esbuild build result, widened with the levels esbuild does not report on one.
 *
 * @remarks
 * esbuild returns `errors` and `warnings` alone.
 * The two fields beside them carry the messages collected at the quieter levels,
 * so an end hook sees everything the build said and not only what failed it.
 *
 * @example
 * ```ts
 * const result: BuildResultInterface = { ...buildResult, info: [], debugs: [] };
 * result.errors.length; // 0
 * result.debugs.length; // 4
 * ```
 *
 * @see BuildResultType
 * @see EndContextInterface
 *
 * @since 3.0.0
 */

export interface BuildResultInterface extends BuildResultType {
    /**
     * The messages this build reported at the `info` level.
     *
     * @remarks
     * Carries no fault, so a reader printing a build summary shows these without treating the build as broken.
     *
     * @example
     * ```ts
     * result.info.length; // 3
     * ```
     *
     * @since 3.0.0
     */

    info: Array<Message>;

    /**
     * The messages this build reported at the `debug` level.
     *
     * @remarks
     * The quietest level, kept for a run asking to see it and ignored by everything else.
     *
     * @example
     * ```ts
     * result.debugs.map(message => message.text); // [ 'resolved src/index.ts' ]
     * ```
     *
     * @since 3.0.0
     */

    debugs: Array<Message>;
}

/**
 * What every hook of a build is handed, whichever stage it runs in.
 *
 * @remarks
 * One object for the whole build, so a value a hook writes onto `stage` is still there for the next one.
 * Everything beside `stage` describes the build itself:
 * which variant it is, the options it runs under, the arguments that started it, and what it has reported so far.
 *
 * @example
 * ```ts
 * const lifecycle: LifecycleHooksInterface = {
 *     onStart: ({ context }) => {
 *         context.variantName;   // 'esm'
 *         context.stage.count = 0;
 *     }
 * };
 * ```
 *
 * @see LifecycleHooksInterface
 * @see LifecycleStageInterface
 *
 * @since 3.0.0
 */

export interface LifecycleContextInterface {
    /**
     * The arguments the build was started with.
     *
     * @remarks
     * The parsed command line, so a hook follows a flag without reading `process.argv` itself.
     *
     * @example
     * ```ts
     * context.argv; // { watch: true, build: 'esm' }
     * ```
     *
     * @since 2.0.0
     */

    argv: Record<string, unknown>;

    /**
     * The name of the variant being built.
     *
     * @remarks
     * The key the variant is written under in the configuration,
     * which is also what labels its messages and what the `--build` flag selects.
     *
     * @example
     * ```ts
     * context.variantName; // 'esm'
     * ```
     *
     * @since 2.0.0
     */

    variantName: string;

    /**
     * The esbuild options this build runs under.
     *
     * @remarks
     * The common block and the variant are already merged,
     * so it reads as what esbuild was given rather than as what the configuration file wrote.
     *
     * @example
     * ```ts
     * context.options.format; // 'esm'
     * context.options.outdir; // 'dist/esm'
     * ```
     *
     * @since 2.2.0
     */

    options: BuildOptions;

    /**
     * The messages this build has collected so far.
     *
     * @remarks
     * Filled as the build runs, so a hook reading it early sees only what has been reported up to that point.
     *
     * @example
     * ```ts
     * context.logs.warning.length; // 2
     * context.logs.error.length;   // 0 - nothing has failed yet
     * ```
     *
     * @see LifecycleLogsType
     * @since 3.0.0
     */

    logs: LifecycleLogsType;

    /**
     * The scratch state this build's hooks share.
     *
     * @remarks
     * The one part of the context a hook is meant to write to, and the only one reset between builds.
     *
     * @example
     * ```ts
     * context.stage.startTime; // when this build began
     * ```
     *
     * @see LifecycleStageInterface
     * @since 2.0.0
     */

    stage: LifecycleStageInterface;

    /**
     * The level each esbuild message is reported at, keyed by its message id or by a pattern matching one.
     *
     * @remarks
     * Lifts or lowers one message without moving the level everything else is reported at,
     * and `silent` drops it rather than filing it under a bucket.
     * The table is the one the configuration declared, read as written rather than in a form prepared for the build,
     * so a hook inspecting it sees the keys a reader of the configuration file would.
     * Each key is matched against a message id once per build and the outcome held,
     * so an entry added while a build runs governs only the ids that the build has yet to report.
     *
     * @example
     * ```ts
     * context.overrides['unsupported-require-call']; // 'silent'
     * ```
     *
     * @see LogOverridesType
     * @since 3.0.0
     */

    overrides: LogOverridesType;
}

/**
 * What an `onStart` hook is handed.
 *
 * @remarks
 * Adds esbuild itself to the shared context, so a start hook can transform or build something of its own
 * before the run it belongs to reads a file.
 * It is the only stage given esbuild, since the ones after it run while the build is already under way.
 *
 * @example
 * ```ts
 * const onStart: LifecycleHooksInterface['onStart'] = async ({ esbuild, context }) => {
 *     const out = await esbuild.transform('let a = 1', { minify: true });
 *     out.code; // 'let a=1;\n'
 * };
 * ```
 *
 * @see LifecycleContextInterface
 * @since 3.0.0
 */

export interface StartContextInterface {
    /**
     * The esbuild module driving this build.
     *
     * @remarks
     * The instance the build resolved, so a hook calling `transform` or `build` on it works against
     * the same version rather than the one it imported for itself.
     *
     * @example
     * ```ts
     * const out = await esbuild.transform('let a = 1', { minify: true });
     * out.code; // 'let a=1;\n'
     * ```
     *
     * @since 3.0.0
     */

    esbuild: PluginBuild['esbuild'];

    /**
     * The context shared by every hook of this build.
     *
     * @remarks
     * Already populated when a start hook runs, `stage` carrying the time the build began
     * along with what the setup stage left on it.
     *
     * @example
     * ```ts
     * context.variantName; // 'esm'
     * ```
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    context: LifecycleContextInterface;
}

/**
 * What an `onEnd` or an `onSuccess` hook is handed.
 *
 * @remarks
 * Adds the finished result and the time it took to the shared context.
 * `onEnd` receives it. However, the build turned out `onSuccess` only when nothing failed,
 * so a hook reading `buildResult.errors` is guarding the first case rather than the second.
 *
 * @example
 * ```ts
 * const onEnd: LifecycleHooksInterface['onEnd'] = ({ duration, buildResult }) => {
 *     `${ buildResult.errors.length } errors in ${ duration }ms`; // '0 errors in 1284ms'
 * };
 * ```
 *
 * @see BuildResultInterface
 * @see LifecycleContextInterface
 *
 * @since 3.0.0
 */

export interface EndContextInterface {
    /**
     * The context shared by every hook of this build.
     *
     * @remarks
     * Carries whatever the earlier stages left on `stage`, which is how an end hook reaches what they counted.
     *
     * @example
     * ```ts
     * context.stage.loaded; // 12
     * ```
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    context: LifecycleContextInterface;

    /**
     * How long the build took, in milliseconds.
     *
     * @remarks
     * Measured from `context.stage.startTime` to the moment the build finished,
     * so a hook reports the figure rather than timing the build itself.
     *
     * @example
     * ```ts
     * duration; // 1284
     * ```
     *
     * @since 3.0.0
     */

    duration: number;

    /**
     * The finished build, with every level of message it produced.
     *
     * @remarks
     * esbuild's own result, widened with the quieter levels it does not return on one.
     *
     * @example
     * ```ts
     * buildResult.errors.length;   // 0
     * buildResult.warnings.length; // 2
     * ```
     *
     * @see BuildResultInterface
     * @since 3.0.0
     */

    buildResult: BuildResultInterface;
}

/**
 * What an `onLoad` hook is handed.
 *
 * @remarks
 * Carries the contents and the loader as they stand at this point in the chain,
 * so a hook returning a new pair of hands it to the hook after it rather than straight back to esbuild.
 * Returning nothing leaves both as they are.
 *
 * @example
 * ```ts
 * const onLoad: LifecycleHooksInterface['onLoad'] = ({ args, contents, loader }) => {
 *     args.path;                                 // '/src/index.ts'
 *     return { contents: contents.trim(), loader };
 * };
 * ```
 *
 * @see LifecycleContextInterface
 * @since 3.0.0
 */

export interface LoadContextInterface {
    /**
     * The file esbuild is loading.
     *
     * @remarks
     * Names the path and the namespace it is loaded under, along with anything a resolve hook attached to it.
     *
     * @example
     * ```ts
     * args.path;      // '/src/index.ts'
     * args.namespace; // 'file'
     * ```
     *
     * @since 2.0.0
     */

    args: OnLoadArgs;

    /**
     * The loader the contents are to be read with.
     *
     * @remarks
     * `undefined` until something in the chain names one,
     * after which esbuild reads the contents as that language instead of inferring it from the extension.
     *
     * @example
     * ```ts
     * loader; // undefined - esbuild picks one from the extension
     * ```
     *
     * @since 2.0.0
     */

    loader: Loader | undefined;

    /**
     * The context shared by every hook of this build.
     *
     * @remarks
     * The same object on every file loaded, which is what makes `stage` a place to count them.
     *
     * @example
     * ```ts
     * context.variantName; // 'esm'
     * ```
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    context: LifecycleContextInterface;

    /**
     * The source as it stands at this point in the chain.
     *
     * @remarks
     * The file as it was read for the first hook, and whatever the hook before returned for the ones after it.
     *
     * @example
     * ```ts
     * contents.includes('export default'); // true
     * ```
     *
     * @since 3.0.0
     */

    contents: string;
}

/**
 * What an `onResolve` hook is handed.
 *
 * @remarks
 * Carries the import as it was written and the file that wrote it,
 * which is what a hook needs to point a path elsewhere, mark it externally, or move it into a namespace of its own.
 * Returning nothing leaves the path to esbuild.
 *
 * @example
 * ```ts
 * const onResolve: LifecycleHooksInterface['onResolve'] = ({ args }) => {
 *     if (!args.path.startsWith('node:')) return undefined;
 *
 *     return { path: args.path, external: true }; // left as an import in the output
 * };
 * ```
 *
 * @see LifecycleContextInterface
 * @since 3.0.0
 */

export interface ResolveContextInterface {
    /**
     * The import being resolved.
     *
     * @remarks
     * Names the path as written, the file importing it, the directory a relative path resolves from,
     * and the kind of import it came from.
     *
     * @example
     * ```ts
     * args.path;     // './utils'
     * args.importer; // '/src/index.ts'
     * ```
     *
     * @since 2.0.0
     */

    args: OnResolveArgs;

    /**
     * The context shared by every hook of this build.
     *
     * @remarks
     * The same object on every import resolved, so a hook deciding by variant reads `variantName` off it.
     *
     * @example
     * ```ts
     * context.variantName; // 'esm'
     * ```
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    context: LifecycleContextInterface;
}

/**
 * A build starting or finishing, tagged with which of the two it is.
 *
 * @remarks
 * Discriminated on `type`, so narrowing on it gives the fields of the matching stage.
 * The two per-build stages alone are in the union,
 * since load and resolve fire once per file and have nothing to say about the build as a whole.
 *
 * @example
 * ```ts
 * const event: LifecycleEventsType = { type: 'end', context, duration: 1284, buildResult };
 * event.type === 'end' && event.duration; // 1284
 * ```
 *
 * @see EndContextInterface
 * @see StartContextInterface
 *
 * @since 3.0.0
 */

export type LifecycleEventsType =
    | EndContextInterface & { type: 'end' }
    | StartContextInterface & { type: 'start' };

/**
 * The hooks a configuration attaches to a build.
 *
 * @remarks
 * Every hook is optional, and each runs at one point of the build:
 * `onStart` before any file is read, `onResolve` as each import is resolved, `onLoad` as each file is loaded,
 * and `onEnd` once the build has finished.
 * `onSuccess` takes the same context as `onEnd` and runs only when the build produced no errors.
 *
 * @example
 * ```ts
 * const lifecycle: LifecycleHooksInterface = {
 *     onStart: ({ context }) => {
 *         context.stage.loaded = 0;
 *     },
 *     onLoad: ({ context, contents, loader }) => ({
 *         contents: contents.replaceAll('__DEV__', 'false'),
 *         loader
 *     }),
 *     onEnd: ({ duration }) => {
 *         `done in ${ duration }ms`; // 'done in 1284ms'
 *     }
 * };
 * ```
 *
 * @see LifecycleContextInterface
 * @since 3.0.0
 */

export interface LifecycleHooksInterface {
    /**
     * Runs once the build has finished. However, it turned out.
     *
     * @remarks
     * The place to report on a build or clean up after it, since it is handed the result and the elapsed time.
     * Work that only makes sense when nothing failed belongs on `onSuccess` instead.
     *
     * @example
     * ```ts
     * onEnd: ({ duration, buildResult }) => {
     *     `${ buildResult.errors.length } errors in ${ duration }ms`; // '0 errors in 1284ms'
     * }
     * ```
     *
     * @see EndContextInterface
     * @since 3.0.0
     */

    onEnd?: (options: EndContextInterface) => MaybeVoidPromiseType<void>;

    /**
     * Runs once the build has finished with no errors.
     *
     * @remarks
     * The same context as `onEnd`, narrowed to the case where nothing failed,
     * so a hook publishing or deploying the output does not check `buildResult.errors` for itself.
     *
     * @example
     * ```ts
     * onSuccess: async ({ context }) => {
     *     await publish(context.options.outdir); // 'dist/esm'
     * }
     * ```
     *
     * @see EndContextInterface
     * @since 3.0.0
     */

    onSuccess?: (options: EndContextInterface) => MaybeVoidPromiseType<void>;

    /**
     * Runs before the build reads its first file.
     *
     * @remarks
     * The place to prepare whatever the later stages read, since it runs once and before anything is resolved.
     * Returning an `OnStartResult` reports errors or warnings against the build instead of throwing at it.
     *
     * @example
     * ```ts
     * onStart: ({ context }) => {
     *     if (context.options.outdir) return undefined;
     *
     *     return { errors: [{ text: 'no outdir' }] }; // the build reports it and stops
     * }
     * ```
     *
     * @see StartContextInterface
     * @since 3.0.0
     */

    onStart?: (options: StartContextInterface) => MaybeVoidPromiseType<OnStartResult>;

    /**
     * Runs as each file is read, before esbuild parses it.
     *
     * @remarks
     * Handed the contents and the loader as they stand, and may return a new pair,
     * which is how a hook rewrites a source or teaches the build an extension it does not know.
     * Returning nothing leaves both untouched.
     *
     * @example
     * ```ts
     * onLoad: ({ contents, loader }) => ({
     *     contents: contents.replaceAll('__DEV__', 'false'), // the next hook sees the replaced source
     *     loader
     * })
     * ```
     *
     * @see LoadContextInterface
     * @since 3.0.0
     */

    onLoad?: (options: LoadContextInterface) => MaybeUndefinedPromiseType<OnLoadResult>;

    /**
     * Runs as each import is resolved, before esbuild looks for it on disk.
     *
     * @remarks
     * Returning a path takes the resolution over, whether to redirect it, mark it externally,
     * or move it into a namespace the build serves itself.
     * Returning nothing leaves esbuild to resolve it.
     *
     * @example
     * ```ts
     * onResolve: ({ args }) => args.path.startsWith('node:')
     *     ? { path: args.path, external: true } // left as an import in the output
     *     : undefined
     * ```
     *
     * @see ResolveContextInterface
     * @since 3.0.0
     */

    onResolve?: (options: ResolveContextInterface) => MaybeUndefinedPromiseType<OnResolveResult>;
}

/**
 * A named set of lifecycle hooks, packaged so several can stand beside one another on one build.
 *
 * @remarks
 * The hooks of {@link LifecycleHooksInterface}, with a name to report them under and two of its own.
 * `onSetup` runs before every build of the variant,
 * and it is the one place a plugin changes the options a build receives.
 * `onDispose` runs once as the variant goes away.
 * Reach for a plugin where the hooks are shared between builds or projects and want naming,
 * and for `lifecycle` where they belong to a single configuration.
 *
 * @example
 * ```ts
 * const timing: LifecyclePluginInterface = {
 *     name: 'timing',
 *     onSetup: ({ options }) => {
 *         options.minify = false; // this build runs unminified
 *     },
 *     onEnd: ({ duration }) => {
 *         `done in ${ duration }ms`; // 'done in 1284ms'
 *     }
 * };
 * ```
 *
 * @see LifecycleHooksInterface
 * @see LifecycleContextInterface
 *
 * @since 3.0.0
 */

export interface LifecyclePluginInterface extends LifecycleHooksInterface {
    /**
     * The name this plugin is known by.
     *
     * @remarks
     * Labels the plugin wherever a build reports it,
     * so a message coming out of one set of hooks names the set it came from.
     *
     * @example
     * ```ts
     * plugin.name; // 'timing'
     * ```
     *
     * @since 3.0.0
     */

    name: string;

    /**
     * Runs before each build of the variant.
     *
     * @remarks
     * Handed the context that the rest of the build's hooks share, while it is still open to change,
     * so writing to `options` here decides the options esbuild receives.
     * It runs on every build rather than once, which is what lets a watch cycle rebuild under different options.
     * A hook that shapes the build belongs here, and one that only runs at its start belongs on `onStart`.
     * Returning a promise holds the build until it settles.
     *
     * @example
     * ```ts
     * onSetup: ({ options, stage }) => {
     *     options.minify = false; // this build runs unminified
     *     stage.loaded = 0;       // every later hook of this build reads it back
     * }
     * ```
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    onSetup?: (setup: LifecycleContextInterface) => MaybeVoidPromiseType;
}
