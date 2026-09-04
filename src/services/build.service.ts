/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Message } from 'esbuild';
import type { DeepPartialType } from '@interfaces/types.interface';
import type { ConfigurationInterface } from '@interfaces/configuration.interface';
import type { BuildResultInterface, LifecycleEventsType } from '@interfaces/lifecycle.interface';
import type { DiagnosticInterface } from '@typescript/services/interfaces/typescript-service.interface';

/**
 * Imports
 */

import { inject } from '@remotex-labs/xinject';
import { xBuildError } from '@errors/xbuild.error';
import { Subject } from '@remotex-labs/xobservable';
import { VariantService } from '@services/variant.service';
import { ConfigurationService } from '@services/configuration.service';
import { TypescriptService } from '@typescript/services/typescript.service';

/**
 * Runs a whole configuration - every variant it declares, in the order their dependencies allow.
 *
 * @remarks
 * Owns the configuration for a run and the event stream the variants report on,
 * while each variant owns the build it runs.
 * A variant is constructed for every entry the configuration declares and reused from then on,
 * so re-reading an edited configuration adds what it gained and leaves the rest running.
 *
 * @example
 * ```ts
 * const build = new BuildService(config, { watch: true });
 * build.subscribe(event => event.type); // 'start', then 'end'
 *
 * const results = await build.build();
 * results.length; // 2 - one per variant
 * ```
 *
 * @see VariantService
 * @see ConfigurationInterface
 *
 * @since 3.0.0
 */

export class BuildService {
    /**
     * The stream every variant reports its start and end on.
     *
     * @remarks
     * Handed to each variant as it is constructed, so one stream carries the whole run
     * rather than a reader subscribing to each variant in turn.
     * Kept private and reached through `pipe` and `subscribe`,
     * which is what keeps a reader from pushing an event of its own onto it.
     *
     * @see LifecycleEventsType
     * @since 3.0.0
     */

    private readonly events$ = new Subject<LifecycleEventsType>();

    /**
     * The configuration service this run reads and writes through.
     *
     * @remarks
     * The injected instance rather than one of its own, and the same instance every variant selects from,
     * so a change written here reaches the variants without being handed to them.
     *
     * @see ConfigurationService
     * @since 3.0.0
     */

    private readonly config$ = inject(ConfigurationService);

    /**
     * Applies a configuration and constructs a variant for every entry it declares.
     *
     * @param config - Configuration to run, merged over whatever the service already holds
     * @param argv - Parsed command line the build was started with, empty when the caller passes none
     *
     * @remarks
     * The configuration is patched rather than put in place of what is there,
     * so the built-in defaults survive underneath what a configuration file states.
     * The subscription that follows is called at once with the merged configuration,
     * which is what constructs the variants before the constructor returns,
     * and it keeps them current with every later change.
     *
     * @example
     * ```ts
     * const build = new BuildService({ logLevel: 'warning', variants: { esm } }, { watch: true });
     * ```
     *
     * @see ConfigurationService.patch
     * @since 3.0.0
     */

    constructor(config: ConfigurationInterface, private argv: Record<string, unknown> = {}) {
        this.config$.patch(config);
        this.config$.subscribe(this.parseVariants.bind(this));
    }

    /**
     * The event stream's `pipe`, bound to the stream.
     *
     * @remarks
     * Hands out the operator chain without handing out the subject,
     * so a reader composes on the run's events and cannot report one of its own.
     *
     * @example
     * ```ts
     * const ended = build.pipe(filter(event => event.type === 'end'));
     * ended.subscribe(report);
     * ```
     *
     * @see BuildService.subscribe
     * @since 3.0.0
     */

    get pipe(): typeof this.events$.pipe {
        return this.events$.pipe.bind(this.events$);
    }

    /**
     * The event stream's `subscribe`, bound to the stream.
     *
     * @remarks
     * The plain way to watch a run, for a reader wanting every event rather than a filtered view.
     * Answers with the handle that ends the subscription, as the stream's own `subscribe` does.
     *
     * @example
     * ```ts
     * const unsubscribe = build.subscribe(event => event.type); // 'start', then 'end'
     * unsubscribe();
     * ```
     *
     * @see BuildService.pipe
     * @since 3.0.0
     */

    get subscribe(): typeof this.events$.subscribe {
        return this.events$.subscribe.bind(this.events$);
    }

    /**
     * Starts the configuration again from the one this service was constructed with.
     *
     * @param config - Configuration to apply over the initial one
     *
     * @remarks
     * Reloads rather than patches, so whatever accumulated since construction is dropped,
     * and only the initial configuration survives underneath.
     * That is what re-reading an edited file wants, since patching a list would extend it rather than replace it.
     * Assigning is also what ends a variant,
     * since one the new configuration no longer declares disposes of itself as the change reaches it.
     *
     * @example
     * ```ts
     * build.configuration = { common: { esbuild: { minify: false } } };
     * ```
     *
     * @see ConfigurationService.reload
     * @since 3.0.0
     */

    set configuration(config: DeepPartialType<ConfigurationInterface>) {
        this.config$.reload(config);
    }

    /**
     * Builds the variants named, or every variant the configuration declares, in the order `dependOn` asks for.
     *
     * @param names - Variants to build, building every variant the configuration declares when omitted
     * @returns One result per variant asked for, in the order they were named
     * @throws xBuildError - When a `dependOn` chain closes on itself, or names a variant that does not exist
     *
     * @remarks
     * Naming variants builds those and whatever they wait for, leaving everything else alone.
     * A name no variant answers to is passed over rather than reported as an error,
     * so a list naming nothing this configuration declares builds nothing at all.
     * A dependency built along the way reports on the event stream like any other build
     * while staying out of the results, which carry the variants that were asked for.
     * The whole graph is wired before any variant runs, and every variant waits on the same gate,
     * so a chain that turns out to be broken builds nothing at all rather than part of the output.
     * A variant that several others depend on is built once and its result shared,
     * since the graph is walked through a cache keyed by name.
     * A build that fails does not reject here - its errors arrive on its own result.
     * A dependency counts as failed where it produced no output, whether it threw or only reported errors.
     * The variant waiting on it is skipped rather than built,
     * and the result {@link skipped} shapes carries no output either, so its own dependents skip in turn.
     *
     * @example
     * ```ts
     * const results = await build.build();
     * results.length; // 2 - the types variant first, then the bundle that depends on it
     *
     * const [ app ] = await build.build([ 'app' ]); // types builds too, since app waits for it
     * await build.build([ 'umd' ]);                 // [] - no variant answers to the name
     * ```
     *
     * @see BuildResultInterface
     * @since 3.0.0
     */

    async build(names?: Array<string>): Promise<Array<BuildResultInterface>> {
        const variants = new Map(Array.from(VariantService.get(), variant => [ variant.name, variant ] as const));
        const cache = new Map<string, Promise<BuildResultInterface>>();
        const start = Promise.withResolvers<void>();

        const run = (name: string, path: Array<string> = []): Promise<BuildResultInterface> => {
            if (path.includes(name))
                throw new xBuildError(`Circular dependency detected: ${ [ ...path, name ].join(' → ') }`);
            if (!variants.has(name))
                throw new xBuildError(`Variant "${ path.at(-1) }" depends on "${ name }", which is not a variant`);

            if (!cache.has(name)) {
                const dependOn = this.getDependOn(name);

                cache.set(name, Promise
                    .all([ start.promise, ...dependOn.map(dependency => run(dependency, [ ...path, name ])) ])
                    .then(([ , ...results ]) => {
                        const failed = dependOn.filter((_, index) => Object.keys(results[index]?.metafile?.outputs ?? {}).length < 1);
                        if (failed.length) return this.skipped(name, failed);

                        return variants.get(name)!.build();
                    })
                );
            }

            return cache.get(name)!;
        };

        const results = Array.from(names?.filter(name => variants.has(name)) ?? variants.keys(), name => run(name));
        start.resolve();

        return Promise.all(results);
    }

    /**
     * Type-checks the variants named, or every variant the configuration declares, without building any of them.
     *
     * @param names - Variants to check, checking every variant the configuration declares when omitted
     * @returns The diagnostics each variant reported, keyed by the variant's name
     *
     * @remarks
     * The variants are checked one at a time rather than together,
     * since every variant carries a TypeScript program of its own.
     * A variant that checks clean is present with an empty list rather than left out,
     * so a reader tells a clean variant from one that was never checked.
     * Only the variants named are checked, dependencies among them or not,
     * since a variant is checked against the files its own build reaches,
     * and what another variant reaches is that variant's own to report.
     * A name is matched against the variants rather than looked up,
     * so one no variant answers to is passed over,
     * and a list naming nothing this configuration declares checks nothing at all.
     *
     * @example
     * ```ts
     * const diagnostics = await build.typeChack();
     * diagnostics.esm; // [] - nothing to report
     *
     * await build.typeChack([ 'esm' ]); // { esm: [ ... ] } - cjs is left alone
     * await build.typeChack([ 'umd' ]); // {} - no variant answers to the name
     * ```
     *
     * @see DiagnosticInterface
     * @since 3.0.0
     */

    async typeChack(names?: Array<string>): Promise<Record<string, DiagnosticInterface[]>> {
        const result: Record<string, Array<DiagnosticInterface>> = {};

        for (const variant of VariantService.get()) {
            if (!names || names.includes(variant.name)) result[variant.name] = await variant.check();
        }

        return result;
    }

    /**
     * Re-reads the TypeScript configuration from disk.
     *
     * @remarks
     * Reparses the configuration so a later check or build reads it as it now stands,
     * which is what a watch cycle needs after an edit to `tsconfig.json`.
     * The list of files reparsed is dropped rather than passed on, so a caller learns only that the reparse ran.
     * Nothing here waits on anything, so the promise settles at once.
     *
     * @example
     * ```ts
     * await build.reload(); // the TypeScript configuration is read again
     * ```
     *
     * @see TypescriptService.reload
     * @since 3.0.0
     */

    async reload(): Promise<void> {
        TypescriptService.reload();
    }

    /**
     * Constructs a variant for every entry the configuration declares.
     *
     * @param config - Configuration as it now stands
     * @throws xBuildError - When there is no configuration to read variants from
     *
     * @remarks
     * A name that already has a variant is passed over,
     * so re-reading a configuration adds what it gained
     * and leaves the variants it kept running rather than replacing them.
     * Nothing is removed here,
     * since a variant the configuration stopped declaring watches its own entry and disposes of itself.
     *
     * @see VariantService
     * @since 3.0.0
     */

    private parseVariants(config: ConfigurationInterface): void {
        if (!config)
            throw new xBuildError('Variants are not defined in the configuration');

        for (const name of Object.keys(config.variants ?? [])) {
            if (VariantService.has(name)) continue;
            new VariantService(name, this.events$, this.argv);
        }
    }

    /**
     * Builds the result a variant answers with when it was skipped rather than run, and reports it as an end.
     *
     * @param name - Variant that was not built
     * @param dependencies - Names of the dependencies that failed, in the order the variant declared them
     * @returns A result carrying one error naming them, and nothing at any other level
     *
     * @remarks
     * Shaped as a build result rather than as a thrown error,
     * so a skipped variant reads like a failed one to whatever reports the run.
     * It carries no metafile, which is what makes its own dependents skip in turn,
     * since a dependency that produced no output is what the graph reads as a failure.
     * Nothing was compiled, so every bucket but `errors` comes back empty.
     * The same result goes out on the event stream as an end,
     * since a variant that never ran reports no end of its own.
     * A reader would otherwise see the run finish, with one variant missing from the count.
     * The context is assembled here rather than taken from a build,
     * so its options are the ones the configuration states, and its duration is zero.
     *
     * @example
     * ```ts
     * const { errors } = this.skipped('app', [ 'types' ]);
     * errors[0].text; // 'Variant "app" was not built, because "types" failed'
     * ```
     *
     * @see BuildResultInterface
     * @since 3.0.0
     */

    private skipped(name: string, dependencies: Array<string>): BuildResultInterface {
        const failed = dependencies.map(dependency => `"${ dependency }"`).join(', ');
        const errors: Array<Message> = [
            {
                id: 'dependency-failed',
                text: `Variant "${ name }" was not built, because ${ failed } failed`,
                notes: [],
                detail: undefined,
                location: null,
                pluginName: name
            }
        ];

        const variant = this.config$.getValue().variants?.[name];
        const buildResult = <BuildResultInterface> <unknown> { info: [], debugs: [], warnings: [], errors };

        this.events$.next({
            type: 'end',
            duration: 0,
            context: {
                argv: this.argv,
                logs: { info: [], debug: [], error: errors, warning: [] },
                options: variant?.esbuild ?? {},
                overrides: variant?.logOverride ?? {},
                variantName: name,
                stage: {
                    startTime: new Date(),
                    dropped: new Set<string>(),
                    reachableFiles: new Set<string>()
                }
            },
            buildResult
        });

        return buildResult;
    }

    /**
     * Returns the variants one variant waits for.
     *
     * @param name - Variant whose dependencies are wanted
     * @returns The names it depends on, empty when it depends on none
     *
     * @remarks
     * Read from the configuration as it stands rather than from a copy taken when the run began.
     * A single name is flattened into a list, so both forms `dependOn` accepts read the same way here.
     *
     * @see VariantConfigurationInterface
     * @since 3.0.0
     */

    private getDependOn(name: string): Array<string> {
        return [ this.config$.getValue().variants?.[name]?.dependOn ?? [] ].flat();
    }
}
