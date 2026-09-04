/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { DeepPartialType } from '@interfaces/types.interface';
import type { UnsubscribeType, Observable } from '@remotex-labs/xobservable';
import type { ConfigurationInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { Injectable } from '@remotex-labs/xinject';
import { BehaviorSubject } from '@remotex-labs/xobservable';
import { deepMerge, equals } from '@components/object.component';
import { map, distinctUntilChanged } from '@remotex-labs/xobservable';
import { DefaultsCommonConfig } from '@constants/configuration.constant';

/**
 * Holds the build configuration and lets the rest of the build watch it change.
 *
 * @typeParam T - Shape of the configuration, at least a {@link ConfigurationInterface}
 *
 * @remarks
 * The configuration is not settled once and read forever: a watch reloads the file behind it, so whatever depends on
 * a setting has to be told when it moves rather than reading it once at startup.
 * That is what {@link select} is for - it reports only when the value that a caller actually asked for has changed,
 * so a change elsewhere in the configuration wakes nobody.
 * Updates merge rather than replace, so an update says what changes and leaves the rest standing.
 * Registered as a singleton, so every consumer reads and watches the same configuration.
 *
 * @example
 * ```ts
 * const configuration = inject(ConfigurationService);
 *
 * configuration.getValue(config => config.verbose);  // false
 * configuration.select(config => config.variants)
 *     .subscribe(variants => rebuild(variants));     // told whenever the variants change
 * configuration.patch({ verbose: true });            // the variant's watcher hears nothing
 * ```
 *
 * @see ConfigurationInterface
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class ConfigurationService<T extends ConfigurationInterface> {
    /**
     * The configuration and everything watching it.
     *
     * @remarks
     * A behavior subject rather than a plain one, so a subscriber arriving late is handed the configuration as it
     * stands instead of waiting for the next change.
     *
     * @since 2.0.0
     */

    private readonly config$: BehaviorSubject<T>;

    /**
     * Creates the service around a starting configuration.
     *
     * @param initialConfig - Configuration to start from, the built-in defaults when omitted
     *
     * @remarks
     * The configuration is copied on the way in, so the object handed over is never written to - which is what makes
     * the frozen defaults usable as a starting point.
     * It is also kept as it was passed, since {@link reload} needs something to return to.
     *
     * @example
     * ```ts
     * const configuration = new ConfigurationService({ variants: { esm: { esbuild: { format: 'esm' } } } });
     * configuration.getValue().variants.esm; // { esbuild: { format: 'esm' } }
     * ```
     *
     * @see DefaultsCommonConfig
     * @since 2.0.0
     */

    constructor(private initialConfig: T = DefaultsCommonConfig as T) {
        this.config$ = new BehaviorSubject<T>(deepMerge({}, initialConfig) as T);
    }

    /**
     * Reads the whole configuration as it stands.
     *
     * @returns The current configuration
     *
     * @example
     * ```ts
     * configuration.getValue().verbose; // false
     * ```
     *
     * @since 2.0.0
     */

    getValue(): T;

    /**
     * Reads one value out of the configuration as it stands.
     *
     * @typeParam R - What the selector returns
     * @param selector - Picks the value to read
     * @returns Whatever the selector returned
     *
     * @remarks
     * The one-off counterpart of {@link select}: it answers once and never again, which suits a decision taken at a
     * point in time rather than something that has to follow the configuration.
     *
     * @example
     * ```ts
     * configuration.getValue(config => Object.keys(config.variants)); // [ 'esm', 'cjs' ]
     * ```
     *
     * @since 2.0.0
     */

    getValue<R>(selector: (config: T) => R): R;

    /**
     * Serves both reading forms.
     *
     * @param selector - Picks a value, or reads the whole configuration when absent
     * @returns The configuration, or what the selector returned
     *
     * @since 2.0.0
     */

    getValue<R>(selector?: (config: T) => R): T | R {
        if (!selector)
            return this.config$.value;

        return selector(this.config$.value);
    }

    /**
     * Watches the whole configuration.
     *
     * @param observer - Called with the configuration, now and on every change
     * @returns A function that stops the watching
     *
     * @remarks
     * Called straight away with the configuration as it stands, so a subscriber needs no separate first read.
     * It hears every change, whatever moved, which is why {@link select} is the better choice for anything that cares
     * about one corner of the configuration.
     *
     * @example
     * ```ts
     * const stop = configuration.subscribe(config => console.log(config.verbose)); // logs at once
     * configuration.patch({ verbose: true });                                      // logs again
     * stop();
     * ```
     *
     * @see select
     * @since 1.0.0
     */

    subscribe(observer: (value: T) => void): UnsubscribeType {
        return this.config$.subscribe(observer);
    }

    /**
     * Watches one value in the configuration.
     *
     * @typeParam R - What the selector returns
     * @param selector - Picks the value to watch
     * @returns A stream of that value, reporting only when it has actually changed
     *
     * @remarks
     * The selector runs on every change, but its result is compared against the one before and only a real difference
     * is passed on - so a change elsewhere costs a comparison rather than the work behind a subscriber.
     * The comparison is structural, so a selector that builds an equal object each time still reports nothing.
     *
     * @example
     * ```ts
     * configuration.select(config => config.common?.esbuild?.minify)
     *     .subscribe(minify => console.log(minify)); // true, then again only when it changes
     *
     * configuration.patch({ verbose: true });        // nothing reported - minify did not move
     * ```
     *
     * @see equals
     * @see subscribe
     *
     * @since 2.0.0
     */

    select<R>(selector: (config: T) => R): Observable<R> {
        return this.config$.pipe(
            map(selector),
            distinctUntilChanged((prev, curr) => equals(prev, curr))
        ) as Observable<R>;
    }

    /**
     * Merges changes into the configuration and reports them.
     *
     * @param partial - The parts to change, nested as deeply as needed
     *
     * @remarks
     * Merged over what is there now, so anything left out keeps its value and only the corners named are touched.
     * Arrays are concatenated rather than replaced, so patching a list adds to it - which is a reason to reach for
     * {@link reload} when a list has to be replaced rather than extended.
     * Every subscriber is told, while a {@link select} passes it on only if the value it picked actually moved.
     *
     * @example
     * ```ts
     * configuration.patch({ common: { esbuild: { minify: false } } });
     * configuration.getValue().common?.esbuild?.format; // 'cjs' - untouched
     * ```
     *
     * @see reload
     * @since 1.0.0
     */

    patch(partial: DeepPartialType<T>): void {
        const mergedConfig = deepMerge<T>(
            {} as T,
            this.config$.value,
            partial
        );

        this.config$.next(mergedConfig);
    }

    /**
     * Starts again from the initial configuration, with the given one merged over it.
     *
     * @param config - Configuration to apply over the initial one
     *
     * @remarks
     * Not a replacement: the result is the configuration this service was constructed with,
     * merged with what is passed here.
     * What the initial configuration carried therefore survives, and only what accumulated since is dropped.
     * That is what re-reading an edited file wants, since a patch has no way to take something back.
     * To be rid of the initial configuration too, construct another service.
     *
     * @example
     * ```ts
     * configuration.patch({ verbose: true });
     * configuration.reload({ common: { types: false } });
     * configuration.getValue().verbose; // false again - the patch is gone
     * ```
     *
     * @see patch
     * @since 2.0.0
     */

    reload(config: DeepPartialType<T>): void {
        this.config$.next(deepMerge({}, this.initialConfig, config) as T);
    }
}
