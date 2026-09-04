/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PartialMessage, Loader } from 'esbuild';
import type { OnResolveArgs, OnResolveResult } from 'esbuild';
import type { OnStartResult, OnLoadArgs, OnLoadResult } from 'esbuild';
import type { DiagnosticInterface } from '@typescript/typescript.module';
import type { Subject, UnsubscribeType } from '@remotex-labs/xobservable';
import type { BuildOptions, Plugin, PluginBuild, BuildResult } from 'esbuild';
import type { LifecycleContextInterface } from '@interfaces/lifecycle.interface';
import type { LogLevelType } from '@providers/interfaces/log-provider.interface';
import type { VariantConfigurationInterface } from '@interfaces/configuration.interface';
import type { BuildResultType } from '@services/interfaces/transpiler-service.interface';
import type { CallType, HandleType } from '@services/interfaces/variant-service.interface';
import type { LifecycleEventsType, BuildResultInterface } from '@interfaces/lifecycle.interface';
import type { LifecyclePluginInterface, LifecycleLogsType } from '@interfaces/lifecycle.interface';
import type { VariantSubscriptionInterface } from '@services/interfaces/variant-service.interface';

/**
 * Imports
 */

import { parseSync } from 'oxc-parser';
import { relative } from '@remotex-labs/xmap';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { xBuildError } from '@errors/xbuild.error';
import { collectLogs } from '@providers/log.provider';
import { Typescript } from '@typescript/typescript.module';
import { errorToMessage } from '@providers/message.provider';
import { analyzeMacros } from '@directives/analyze.directive';
import { transformMacros } from '@directives/macros.directive';
import { resolveSource } from '@components/transformer.component';
import { deepMerge, stringify } from '@components/object.component';
import { ConfigurationService } from '@services/configuration.service';
import { extractEntryPoints } from '@components/entry-points.component';
import { TextBlocks, DiagnosticLevels } from '@constants/variant.constant';
import { buildFiles, analyzeDependencies } from '@services/transpiler.service';

/**
 * Runs one named variant of a build, from the configuration it watches to the result it reports.
 *
 * @remarks
 * One instance per entry in `variants`, kept in a static registry under that name and reused by every build,
 * so a watch cycle rebuilds through the same variant rather than replacing it each time.
 * The instance follows the configuration it was named in:
 * it re-reads its settings whenever they change and disposes of itself once the configuration drops its entry.
 * A build runs as a single esbuild plugin, which is what gives the configured hooks their place in the run.
 *
 * @example
 * ```ts
 * const variant = new VariantService('esm', events$, { watch: true });
 * const result = await variant.build();
 *
 * result.errors.length; // 0
 * variant.dispose();
 * ```
 *
 * @see LifecyclePluginInterface
 * @see VariantConfigurationInterface
 *
 * @since 3.0.0
 */

export class VariantService {
    /**
     * The file model every variant reads its sources through.
     *
     * @remarks
     * Held on the class rather than the instance, so one cache of snapshots serves every variant,
     * which is what keeps two variants of the same project from reading the same file twice.
     *
     * @since 3.0.0
     */

    private static readonly filesModel: FilesModel = inject(FilesModel);

    /**
     * The live variants, keyed by the name each was constructed under.
     *
     * @remarks
     * What {@link VariantService.has} and {@link VariantService.get} read,
     * and what {@link VariantService.dispose} removes an entry from,
     * so a name a disposed variant held is free for a later configuration to claim.
     *
     * @since 3.0.0
     */

    private static readonly instances = new Map<string, VariantService>();

    /**
     * The handle that ends this variant's configuration subscription.
     *
     * @remarks
     * Called as the variant is disposed,
     * so one the configuration has dropped stops reacting to a configuration it no longer belongs to.
     *
     * @since 3.0.0
     */

    private readonly configUnsubscribe: UnsubscribeType;

    /**
     * The hook sets these variant dispatches to, in the order they run.
     *
     * @remarks
     * Rebuilt on every configuration change as the declared plugins followed by the variant's own `lifecycle` set,
     * so a shared plugin runs ahead of the hooks a variant adds for itself.
     * The `lifecycle` set is given the variant's name, which is what lets its messages be credited as a plugin's.
     *
     * @since 3.0.0
     */

    private hooks: Array<LifecyclePluginInterface> = [];

    /**
     * Whether this variant has been torn down.
     *
     * @remarks
     * Guards {@link VariantService.build},
     * so a variant the configuration dropped reports rather than building against settings that are gone.
     *
     * @since 3.0.0
     */

    private isDisposed = false;

    /**
     * The TypeScript module this variant checks and emits through.
     *
     * @remarks
     * Replaced whenever the configuration changes, since a different `tsconfig` needs a program of its own,
     * and the one it replaces is disposed of only after the swap.
     * Populated by the subscription the constructor opens rather than by the constructor itself.
     *
     * @since 3.0.0
     */

    private typescriptModule!: Typescript;

    /**
     * The merged settings this variant builds under.
     *
     * @remarks
     * The common block with the variant merged over it, so a read here needs no further merging.
     * Populated by the subscription the constructor opens rather than by the constructor itself.
     *
     * @see VariantConfigurationInterface
     * @since 3.0.0
     */

    private buildConfig!: VariantConfigurationInterface;

    /**
     * Registers a variant under its name and starts following the configuration.
     *
     * @param name - Name the configuration declares this variant under, readable afterward
     * @param events$ - Subject the variant reports its start and end on
     * @param argv - Parsed command line the build was started with, empty when the caller passes none
     *
     * @remarks
     * The variant is usable as soon as it is constructed, since the subscription it opens delivers the settings
     * before the constructor returns.
     * An error in the subscription reports is rethrown rather than collected
     * because a variant that cannot read its configuration has nothing to build.
     *
     * @example
     * ```ts
     * const variant = new VariantService('esm', events$, { watch: true });
     * variant.name; // 'esm'
     * ```
     *
     * @since 3.0.0
     */

    constructor(readonly name: string, private events$: Subject<LifecycleEventsType>, private argv: Record<string, unknown> = {}) {
        VariantService.instances.set(name, this);
        this.configUnsubscribe = inject(ConfigurationService).select(config => ({
            common: config.common,
            variant: config.variants?.[this.name]
        })).subscribe(this.handleConfigChange.bind(this), error => {
            throw error;
        });
    }

    /**
     * Reports whether a variant is already registered under a name.
     *
     * @param name - Name to look for
     * @returns `true` when a live variant holds that name
     *
     * @remarks
     * What keeps a second variant from being constructed for a name that already has one,
     * so re-reading a configuration adds the entries it gained without disturbing the ones it kept.
     *
     * @example
     * ```ts
     * VariantService.has('esm'); // true
     * VariantService.has('umd'); // false - never constructed, or disposed since
     * ```
     *
     * @since 3.0.0
     */

    static has(name: string): boolean {
        return VariantService.instances.has(name);
    }

    /**
     * Returns every variant currently registered.
     *
     * @returns An iterator over the live variants, in the order they were constructed
     *
     * @remarks
     * Walks the registry itself rather than a copy of it,
     * so a variant that disposes of itself part way through a walk is not visited afterward.
     *
     * @example
     * ```ts
     * for (const variant of VariantService.get()) variant.name; // 'esm', then 'cjs'
     * ```
     *
     * @since 3.0.0
     */

    static get(): MapIterator<VariantService> {
        return VariantService.instances.values();
    }

    /**
     * Type-checks the variant's sources without building them.
     *
     * @returns The diagnostics TypeScript reported, empty when it found nothing to report
     *
     * @remarks
     * A dependency scan of the variant's entry points settles which files the check covers,
     * so it reports against what this variant builds rather than against every file the project holds.
     * The scan runs with the plugins stripped, which keeps it out of the variant's own hooks.
     * Reaches the TypeScript module directly, so nothing is emitted and no message is filed against a build.
     * A run wanting the diagnostics reported as build messages builds instead and reads them off the result.
     *
     * @example
     * ```ts
     * const diagnostics = await variant.check();
     * diagnostics.length; // 2
     * ```
     *
     * @see DiagnosticInterface
     * @since 3.0.0
     */

    async check(): Promise<DiagnosticInterface[]> {
        const { metafile } = await analyzeDependencies({ ...this.buildConfig.esbuild, plugins: undefined });

        return this.typescriptModule.check(new Set(Object.keys(metafile.inputs)));
    }

    /**
     * Runs one build of this variant.
     *
     * @returns The finished build, carrying every message the run reported at every level
     * @throws xBuildError - When the variant has already been disposed
     *
     * @remarks
     * esbuild runs at `silent` with no log limit, so every message reaches the result through the plugin
     * instead of the console, and nothing is dropped for being the hundredth of its kind.
     * A build that fails resolves to an empty esbuild result rather than rejecting,
     * since what went wrong is already in the logs the plugin collected.
     *
     * @example
     * ```ts
     * const result = await variant.build();
     * result.errors.length;   // 0
     * result.warnings.length; // 2
     * ```
     *
     * @see BuildResultInterface
     * @since 3.0.0
     */

    async build(): Promise<BuildResultInterface> {
        if (this.isDisposed) throw new xBuildError(`Variant ${ this.name } is disposed`);

        const logs: LifecycleLogsType = { info: [], debug: [], error: [], warning: [] };
        const result = await buildFiles({
            ...this.buildConfig.esbuild,
            plugins: [ this.lifecycle(logs) ],
            logLimit: 0,
            logLevel: 'silent'
        }).catch(() => <BuildResult> {});

        return this.toResult(result, logs);
    }

    /**
     * Tears the variant down and frees its name.
     *
     * @remarks
     * Ends the configuration subscription, disposes the TypeScript module, and drops the variant from the registry,
     * so the name is free for a later configuration to claim.
     * The instance stays marked as disposed, which is what makes a later build report rather than run.
     *
     * @example
     * ```ts
     * variant.dispose();
     * VariantService.has('esm'); // false
     * await variant.build();     // throws - the variant is disposed
     * ```
     *
     * @since 3.0.0
     */

    dispose(): void {
        this.isDisposed = true;
        this.configUnsubscribe?.();
        this.typescriptModule?.dispose?.();
        VariantService.instances.delete(this.name);
    }

    /**
     * Disposes the variant at the end of a `using` block.
     *
     * @remarks
     * Defers to {@link VariantService.dispose}, so a variant held by a `using` declaration is torn down
     * when the block ends rather than waiting for a caller to remember.
     *
     * @example
     * ```ts
     * using variant = new VariantService('esm', events$);
     * await variant.build(); // disposed as the block ends
     * ```
     *
     * @see VariantService.dispose
     * @since 3.0.0
     */

    [Symbol.dispose](): void {
        this.dispose();
    }

    /**
     * Files a batch of messages under a level, credited to a plugin.
     *
     * @param logs - Buckets the messages are appended to
     * @param messages - Messages to file, absent where the stage produced none
     * @param level - Level a message takes when no override claims it
     * @param name - Plugin to credit the messages to, left as reported when omitted
     *
     * @remarks
     * An absent or empty batch is skipped, so nothing walks a list with nothing in it.
     * The variant's own override table is what decides each message's level,
     * which is how a configuration re-levels or silences one without the stage knowing.
     *
     * @since 3.0.0
     */

    private collect(logs: LifecycleLogsType, messages: Array<PartialMessage> | undefined, level: LogLevelType, name?: string): void {
        if (messages?.length) collectLogs(logs, this.buildConfig.logOverride!, messages, level, name);
    }

    /**
     * Records a thrown value as an error on the build.
     *
     * @param logs - Buckets the error is appended to
     * @param error - Value that was thrown, of any shape
     * @param name - Plugin to credit the error to, the variant itself by default
     *
     * @remarks
     * A value that is not an `Error` is wrapped in one first, so the message carries a text either way.
     * The error goes straight to the bucket rather than through the override table,
     * since a failure a stage could not handle is not something a configuration silences.
     *
     * @since 3.0.0
     */

    private fail(logs: LifecycleLogsType, error: unknown, name: string = this.name): void {
        logs.error.push(errorToMessage(error instanceof Error ? error : new Error(String(error)), '', name));
    }

    /**
     * Widens an esbuild result with the levels esbuild does not report on one.
     *
     * @param result - Result esbuild returned, empty when the build threw
     * @param logs - Messages the run collected, at every level
     * @returns The same result, carrying the quieter levels beside the two esbuild reports
     *
     * @remarks
     * Assigns onto the result rather than copying it, so the returned object is the one esbuild produced.
     * The error and warning buckets replace esbuild's own instead of joining them,
     * because the logs already hold those messages along with whatever the hooks added.
     *
     * @see BuildResultInterface
     * @since 3.0.0
     */

    private toResult(result: BuildResult, logs: LifecycleLogsType): BuildResultInterface {
        return Object.assign(<BuildResultType> result, {
            info: logs.info,
            debugs: logs.debug,
            errors: logs.error,
            warnings: logs.warning
        }) as BuildResultInterface;
    }

    /**
     * Runs one call against every hook in order and collects what each reports.
     *
     * @typeParam T - Result the call produces for a hook that answers
     *
     * @param logs - Buckets each hook's messages are filed under
     * @param call - Invocation to run against a hook, returning its result or nothing
     * @param handle - Decides whether a result ends the walk, never ending it by default
     * @returns The result that ended the walk, or `undefined` when no result ended it
     *
     * @remarks
     * Each hook's errors and warnings are filed under that hook's own name,
     * so a message reads as the plugin that raised it rather than as the variant.
     * A hook that throws is recorded against its name, and the walk carries on,
     * which keeps one broken plugin from taking the rest of the stage with it.
     * A hook returning nothing is passed over without its result being inspected.
     *
     * @see LifecyclePluginInterface
     * @since 3.0.0
     */

    private async dispatch<T>(logs: LifecycleLogsType, call: CallType, handle: HandleType<T> = () => false): Promise<T | undefined> {
        for (const hook of this.hooks) {
            try {
                const result = <T & OnStartResult | undefined> await call(hook);
                if (!result) continue;

                this.collect(logs, result.errors, 'error', hook.name);
                this.collect(logs, result.warnings, 'warning', hook.name);
                if (handle(result)) return result;
            } catch (error) {
                this.fail(logs, error, hook.name);
            }
        }
    }

    /**
     * Emits the declaration files for this build.
     *
     * @param context - Context of the build being emitted for, read for its resolved options
     *
     * @remarks
     * Written to the directory `declaration` names, falling back to the build's own `outdir` when it names none.
     * A bundled build emits through `emitBundle` so each entry point becomes one declaration,
     * while an unbundled one emits file by file.
     *
     * @see DeclarationOptionsInterface
     * @since 3.0.0
     */

    private async declarations(context: LifecycleContextInterface): Promise<void> {
        const { declaration } = this.buildConfig;
        const entryPoints = <Record<string, string>> context.options.entryPoints;
        const outdir = (typeof declaration === 'object' ? declaration.outDir : undefined) ?? context.options.outdir;

        if (context.options.bundle) await this.typescriptModule.emitBundle(entryPoints, outdir);
        else await this.typescriptModule.emit(entryPoints, outdir);
    }

    /**
     * Re-reads the variant's settings whenever the configuration changes.
     *
     * @param change - The common block and this variant's entry, as the configuration now stands
     *
     * @remarks
     * A change carrying no entry for this variant means the configuration dropped it,
     * so the variant disposes of itself instead of rebuilding its settings.
     * The common block is merged under the variant, entry points are resolved,
     * and the TypeScript module is swapped before the one it replaces is disposed of,
     * so a failure part-way through does not leave the variant without a module.
     * The hook list is rebuilt with the declared plugins ahead of the variant's own `lifecycle` set.
     *
     * @see VariantSubscriptionInterface
     * @since 3.0.0
     */

    private handleConfigChange({ common, variant }: VariantSubscriptionInterface): void {
        if (!variant) return this.dispose();

        const previous = this.typescriptModule;
        const config = deepMerge(<VariantConfigurationInterface> {}, common ?? {}, variant);

        this.typescriptModule = inject(Typescript, config.esbuild.tsconfig);
        config.esbuild.entryPoints = extractEntryPoints(config.esbuild.entryPoints);
        config.logOverride ??= {};
        previous?.dispose();

        this.buildConfig = config;
        this.hooks = [ ...config.plugins ?? [], { name: this.name, ...config.lifecycle }];
    }

    /**
     * Writes one text block into the esbuild options.
     *
     * @param options - Options the block is written onto, modified in place
     * @param type - Block to write, one of `banner`, `footer`, or `define`
     *
     * @remarks
     * A value written as a function is called with the variant's name and the arguments the build was started with,
     * so an injected value can carry something the configuration file cannot know.
     * A value resolving to `null` or `undefined` is left out rather than written as text,
     * which is how a definition can decline to apply to a given variant.
     *
     * @see TextBlocks
     * @since 3.0.0
     */

    private injectTextBlock(options: BuildOptions, type: 'banner' | 'footer' | 'define'): void {
        const source = this.buildConfig[type];
        if (!source) return;

        const target = options[type] ??= {};
        for (const [ key, value ] of Object.entries(source)) {
            const content = typeof value === 'function' ? value(this.name, this.argv) : value;
            if (content !== undefined && content !== null) target[key] = stringify(content);
        }
    }

    /**
     * Files the TypeScript diagnostics as messages on the build.
     *
     * @param context - Context shared by every hook of this build, read for the files the build reaches
     *
     * @remarks
     * The check is handed the set the setup stage collected,
     * so a build reports against its own inputs without scanning for them a second time.
     * Each diagnostic carries its code as `ts-<code>`, so an override claims one by that id.
     * The code, category, and text also travel whole on the message's `detail`,
     * so a reporter reads the diagnostic itself rather than parsing it back out of the message text.
     * The level comes from the diagnostic's category, and a category the table does not reach is filed as `debug`.
     * Where `types.failOnError` is off, an error is filed as a warning instead,
     * so the build reports it and still emits.
     *
     * @see DiagnosticLevels
     * @see TypeCheckOptionsInterface
     *
     * @since 3.0.0
     */

    private diagnostics({ logs, stage: { reachableFiles } }: LifecycleContextInterface): void {
        const types = this.buildConfig.types;
        const failOnError = typeof types === 'object' ? types.failOnError : true;

        for (const { category, code, message: text, file, line, column } of this.typescriptModule.check(reachableFiles)) {
            const message: PartialMessage = { text };
            if (code !== undefined) message.id = `ts-${ code }`;
            if (file) message.location = { file, line, column };

            const level = <LogLevelType> (DiagnosticLevels[category] ?? 'debug');
            message.detail = { code, category, message: text };

            this.collect(logs, [ message ], level === 'error' && !failOnError ? 'warning' : level, 'typescript');
        }
    }

    /**
     * Runs the start stage of a build.
     *
     * @param context - Context shared by every hook of this build
     * @param esbuild - The esbuild module driving the build, handed to each start hook
     * @returns The errors collected so far, which is what fails the build when any were
     *
     * @remarks
     * The start hooks run first, and the sources are type-checked only where nothing has failed yet,
     * since diagnostics against a build that already broke report noise rather than a cause.
     * The error bucket comes back rather than the hooks' own results,
     * so esbuild stops on anything the stage collected, whichever hook raised it.
     *
     * @see StartContextInterface
     * @since 3.0.0
     */

    private async start(context: LifecycleContextInterface, esbuild: PluginBuild['esbuild']): Promise<OnStartResult> {
        const { logs } = context;
        await this.dispatch(logs, hook => hook.onStart?.({ context, esbuild }));
        if (this.buildConfig.types && logs.error.length < 1) this.diagnostics(context);

        return { errors: logs.error };
    }

    /**
     * Resolves one import through the hooks.
     *
     * @param context - Context shared by every hook of this build
     * @param args - The import being resolved, as esbuild described it
     * @returns The first result a hook returned, or the errors collected so far when none claimed the path
     *
     * @remarks
     * The first hook to return anything settles the path, and the rest are not consulted,
     * which is how esbuild itself behaves across plugins.
     * Where no hook claims the import, esbuild is left to resolve it.
     *
     * @see ResolveContextInterface
     * @since 3.0.0
     */

    private async resolve(context: LifecycleContextInterface, args: OnResolveArgs): Promise<OnResolveResult | undefined | null> {
        const result = await this.dispatch<OnResolveResult>(
            context.logs, hook => hook.onResolve?.({ context, args }), () => true
        );

        return result ?? { errors: context.logs.error };
    }

    /**
     * Loads one file and runs it through the hooks.
     *
     * @param context - Context shared by every hook of this build
     * @param args - The file esbuild is loading, as it described it
     * @returns The contents and loader the chain settled on, with the messages left to the variant's own logs
     *
     * @remarks
     * The file is read from the shared model, then rewritten so its imports resolve where the build is unbundled,
     * and its macros are transformed either way.
     * A failure in any of that is recorded, and the file still goes on to the hooks.
     * Each hook is handed what the one before it returned, so the list reads as a chain rather than a race,
     * and every hook is consulted rather than the first that answers.
     * The result carries no messages of its own, since the stage filed them under the variant's levels already.
     *
     * @see LoadContextInterface
     * @since 3.0.0
     */

    private async load(context: LifecycleContextInterface, args: OnLoadArgs): Promise<OnLoadResult | undefined | null> {
        const path = VariantService.filesModel.resolve(args.path);

        let loader: Loader = 'default';
        let contents = VariantService.filesModel.touch(path).snapshot?.text ?? '';

        try {
            const parsed = parseSync(path, contents, { sourceType: 'module' });
            contents = await transformMacros(parsed, path, contents, context);

            if (!context.options.bundle) {
                const parsed = parseSync(path, contents, { sourceType: 'module' });
                contents = resolveSource(parsed, path, contents, this.typescriptModule);
            }
        } catch (error) {
            this.fail(context.logs, error);
        }

        let merged: OnLoadResult = {};
        await this.dispatch<OnLoadResult>(context.logs,
            hook => hook.onLoad?.({ context, contents, loader, args }),
            result => {
                merged = { ...merged, ...result };
                loader = result.loader ?? loader;

                if (result.contents !== undefined)
                    contents = typeof result.contents === 'string' ? result.contents : Buffer.from(result.contents).toString();

                return false;
            }
        );

        return { ...merged, contents, loader, errors: [], warnings: [] };
    }

    /**
     * Closes a build out and reports it.
     *
     * @param context - Context shared by every hook of this build
     * @param buildResult - The result esbuild produced for the run
     *
     * @remarks
     * Only the messages esbuild raised itself are collected here,
     * since one carrying a plugin name was already filed when its hook returned it.
     * Declarations are emitted only where nothing failed, so a broken build does not leave stale types behind.
     * `onSuccess` runs ahead of `onEnd` and only on a result with no errors,
     * after which the end event is reported whatever the outcome.
     *
     * @see EndContextInterface
     * @since 3.0.0
     */

    private async end(context: LifecycleContextInterface, buildResult: BuildResult): Promise<void> {
        this.collect(context.logs, buildResult.errors.filter(message => !message.pluginName), 'error');
        this.collect(context.logs, buildResult.warnings.filter(message => !message.pluginName), 'warning');

        const event = {
            context,
            duration: Date.now() - context.stage.startTime.getTime(),
            buildResult: this.toResult(buildResult, context.logs)
        };

        if (context.logs.error.length < 1) {
            try {
                if (this.buildConfig.declaration) await this.declarations(context);
            } catch (error) {
                errorToMessage(error as Error, '', this.name);
            }
        }

        await this.dispatch(context.logs, async hook => {
            if (event.buildResult.errors.length < 1) await hook.onSuccess?.(event);
            await hook.onEnd?.(event);
        });

        this.events$.next({ ...event, type: 'end' });
    }

    /**
     * Prepares the build's options before esbuild reads them.
     *
     * @param context - Context shared by every hook of this build
     * @param build - The esbuild plugin build whose initial options are being shaped
     *
     * @remarks
     * Injects the text blocks, records the files the build reaches on the stage,
     * and replaces the entry points with the dependency map where the build is unbundled.
     * The macro scan reads that same set,
     * so the bindings the run is to drop come from every input the build reaches rather than from the entry points.
     * A failure that already carries esbuild's own messages is left alone rather than reported twice,
     * while anything else is recorded against the variant.
     * The setup hooks run last, so a plugin changing an option overrides what this stage settled.
     *
     * @see isEsbuildError
     * @since 3.0.0
     */

    private async setup(context: LifecycleContextInterface, build: PluginBuild): Promise<void> {
        const options = build.initialOptions;

        try {
            for (const block of TextBlocks) this.injectTextBlock(options, block);

            const files = await this.buildDependencyMap();
            context.stage.reachableFiles = new Set(Object.values(files));
            if (!options.bundle) options.entryPoints = files;
            context.stage.dropped = analyzeMacros(context.stage.reachableFiles, options.define ?? {});
        } catch (error) {
            this.fail(context.logs, error, '');
        }

        await this.dispatch(context.logs, hook => hook.onSetup?.(context));
    }

    /**
     * Maps every input the build reaches to the output name it takes.
     *
     * @returns The inputs, keyed by their path below the root directory with the extension dropped
     *
     * @remarks
     * The scan runs with the plugins stripped, so it does not re-enter this variant's own hooks
     * and cannot recurse into the build it is preparing.
     * Each path is made relative to the root directory and loses its extension,
     * which is what gives an unbundled build one output per input rather than one bundle.
     *
     * @since 3.0.0
     */

    private async buildDependencyMap(): Promise<Record<string, string>> {
        const rootDir = this.typescriptModule.config.options.rootDir!;
        const { metafile } = await analyzeDependencies({ ...this.buildConfig.esbuild, plugins: undefined });

        return Object.fromEntries(Object.keys(metafile.inputs).map(file => {
            const path = relative(rootDir, VariantService.filesModel.resolve(file));
            const dot = path.lastIndexOf('.');

            return [ dot > 0 ? path.slice(0, dot) : path, file ];
        }));
    }

    /**
     * Builds the esbuild plugin this variant runs as.
     *
     * @param logs - Buckets every stage of the run files its messages under
     * @returns The plugin, named after the variant
     *
     * @remarks
     * The context is created once per build and handed to every stage,
     * which is what makes `stage` a place one hook leaves a value for a later one.
     * Its two sets start empty, and setup fills them before the first hook reads one.
     * The four esbuild callbacks are registered before setup runs,
     * so a hook changing an option during setup is still ahead of the first file being read.
     * The plugin carries the variant's name, so message esbuild attributes to it read as the variant.
     *
     * @see LifecycleContextInterface
     * @since 3.0.0
     */

    private lifecycle(logs: LifecycleLogsType): Plugin {
        return {
            name: this.name,
            setup: async (build: PluginBuild): Promise<void> => {
                const context: LifecycleContextInterface = {
                    logs,
                    argv: this.argv,
                    options: build.initialOptions,
                    overrides: this.buildConfig.logOverride!,
                    variantName: this.name,
                    stage: {
                        startTime: new Date(),
                        dropped: new Set<string>(),
                        reachableFiles: new Set<string>()
                    }
                };

                build.onEnd(this.end.bind(this, context));
                build.onStart(this.start.bind(this, context, build.esbuild));
                build.onLoad({ filter: /.*/ }, this.load.bind(this, context));
                build.onResolve({ filter: /.*/ }, this.resolve.bind(this, context));
                await this.setup(context, build);

                this.events$.next({ context, esbuild: build.esbuild, type: 'start' });
            }
        };
    }
}
