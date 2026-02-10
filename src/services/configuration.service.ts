/**
 * Import will remove at compile time
 */

import type { UnsubscribeType, Observable } from '@observable/observable.module';
import type { BuildConfigInterface, DeepPartialType } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { Injectable } from '@symlinks/symlinks.module';
import { BehaviorSubject } from '@observable/observable.module';
import { deepMerge, equals } from '@components/object.component';
import { map, distinctUntilChanged } from '@observable/observable.module';
import { DEFAULTS_COMMON_CONFIG } from '@constants/configuration.constant';

/**
 * Provides a centralized service for managing and observing configuration state.
 *
 * @template T - The configuration object type must extend {@link BuildConfigInterface}
 *
 * @remarks
 * Configuration changes are deeply merged with existing values, preserving unmodified properties.
 * Type-safe selectors enable reactive access to nest or derived configuration properties.
 *
 * @example
 * ```ts
 * // Initialize with default or custom configuration
 * const configService = new ConfigurationService({ name: 'myApp' });
 *
 * // Get current configuration value
 * const config = configService.getValue();
 *
 * // Get a specific configuration property
 * const name = configService.getValue(cfg => cfg.name);
 *
 * // Subscribe to configuration changes
 * const unsubscribe = configService.subscribe((config) => {
 *   console.log('Config updated:', config);
 * });
 *
 * // Select and observe specific properties reactively
 * configService.select(cfg => cfg.name)
 *   .subscribe(name => console.log('Name changed:', name));
 *
 * // Update configuration (deep merge)
 * configService.patch({ name: 'newApp' });
 *
 * // Cleanup subscription
 * unsubscribe();
 * ```
 *
 * @see {@link BuildConfigInterface} for the configuration contract
 * @see {@link BehaviorSubject} for the underlying reactive implementation
 *
 * @since 2.0.0
 */

@Injectable({
    scope: 'singleton'
})
export class ConfigurationService<T extends BuildConfigInterface> {
    /**
     * Internal configuration state managed by a {@link BehaviorSubject}.
     *
     * @remarks
     * This private property holds the current configuration and emits changes
     * to all active subscribers. All public methods delegate state access through this subject.
     *
     * @see {@link BehaviorSubject}
     *
     * @since 2.0.0
     */

    private readonly config$: BehaviorSubject<T>;

    /**
     * Initializes a new {@link ConfigurationService} instance.
     *
     * @param initialConfig - The initial configuration object (defaults to {@link DEFAULTS_COMMON_CONFIG})
     *
     * @remarks
     * - Creates a deep copy of the provided configuration to prevent external mutations
     * - If no configuration is provided, uses the default configuration
     * - The configuration is wrapped in a {@link BehaviorSubject} for reactive updates
     *
     * @example
     * ```ts
     * // With default configuration
     * const service = new ConfigurationService();
     *
     * // With custom configuration
     * const service = new ConfigurationService({ name: 'customApp' });
     * ```
     *
     * @since 2.0.0
     */

    constructor(private initialConfig: T = DEFAULTS_COMMON_CONFIG as T) {
        this.config$ = new BehaviorSubject<T>(deepMerge({}, initialConfig) as T);
    }

    /**
     * Retrieves the current configuration value synchronously.
     *
     * @overload
     * @returns The complete current configuration object
     *
     * @example
     * ```ts
     * const config = configService.getValue();
     * console.log(config.name);
     * ```
     *
     * @since 2.0.0
     */

    getValue(): T;

    /**
     * Retrieves a computed value derived from the current configuration.
     *
     * @overload
     * @typeParam R - The return type of the selector function
     * @param selector - A function that extracts or transforms a value from the configuration
     * @returns The computed value returned by the selector function
     *
     * @remarks
     * This overload allows synchronous extraction of specific configuration properties
     * or computed values without creating an Observable subscription.
     *
     * @example
     * ```ts
     * const name = configService.getValue(cfg => cfg.name);
     * const nameLength = configService.getValue(cfg => cfg.name?.length ?? 0);
     * ```
     *
     * @since 2.0.0
     */

    getValue<R>(selector: (config: T) => R): R;

    /**
     * Implementation of getValue that handles both overloads.
     *
     * @param selector - Optional selector function for computed values
     * @returns The current configuration or a computed value derived from it
     *
     * @remarks
     * When no selector is provided, it returns the complete configuration.
     * When a selector is provided, applies it to the current configuration value
     * and returns the result.
     *
     * @since 2.0.0
     */

    getValue<R>(selector?: (config: T) => R): T | R {
        if (!selector)
            return this.config$.value;

        return selector(this.config$.value);
    }

    /**
     * Subscribes to configuration changes and executes a callback for each update.
     *
     * @param observer - A callback function invoked with the new configuration value on each change
     * @returns An unsubscribe function that removes this subscription when called
     *
     * @remarks
     * - The observer is immediately called with the current configuration value
     * - Subsequent calls occur whenever the configuration is updated via {@link patch}
     * - Returns an unsubscribe function for cleanup; it should be called to prevent memory leaks
     * - For more sophisticated reactive operations, consider using {@link select} instead
     *
     * @example
     * ```ts
     * const unsubscribe = configService.subscribe((config) => {
     *   console.log('Configuration changed:', config);
     * });
     *
     * // Later, stop listening to changes
     * unsubscribe();
     * ```
     *
     * @see {@link select} for reactive selector-based subscriptions
     *
     * @since 1.0.0
     */

    subscribe(observer: (value: T) => void): UnsubscribeType {
        return this.config$.subscribe(observer);
    }

    /**
     * Creates an Observable that emits selected configuration values whenever they change.
     *
     * @typeParam R - The return type of the selector function
     * @param selector - A function that extracts or transforms a value from the configuration
     * @returns An Observable that emits distinct selector results on configuration changes
     *
     * @remarks
     * - Uses the provided selector to extract a computed value from the configuration
     * - Only emits values that are distinct from the previous emission (via {@link distinctUntilChanged})
     * - Distinction is determined using the {@link equals} utility for deep equality comparison
     * - Allows reactive composition using RxJS operators and subscriptions
     * - Ideal for observing nested properties or computed values without pollution from unchanged properties
     *
     * @example
     * ```ts
     * // Observe a specific property
     * configService.select(cfg => cfg.name)
     *   .subscribe(name => console.log('Name is now:', name));
     *
     * // Observe a derived value
     * configService.select(cfg => cfg.name?.toUpperCase() ?? '')
     *   .subscribe(uppercaseName => console.log('Upper name:', uppercaseName));
     *
     * // Compose with other RxJS operators
     * configService.select(cfg => cfg.name)
     *   .pipe(
     *     filter(name => name?.length > 0),
     *     map(name => name.toUpperCase())
     *   )
     *   .subscribe(uppercaseName => console.log('Valid uppercase name:', uppercaseName));
     * ```
     *
     * @see {@link equals} for equality comparison logic
     * @see {@link distinctUntilChanged} for deduplication behavior
     * @see {@link subscribe} for simple subscription-based value access
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
     * Updates the configuration with partial changes, performing a deep merge.
     *
     * @param partial - A partial configuration object containing the properties to update
     *
     * @remarks
     * - Performs a deep merge of the provided partial configuration with the current configuration
     * - Unmodified properties are preserved from the current configuration
     * - The merge operation uses {@link deepMerge} to ensure nested objects are properly merged
     * - After merging, emits the updated configuration to all active subscribers via the BehaviorSubject
     * - For complete replacement rather than merging, create a new ConfigurationService instance
     *
     * @example
     * ```ts
     * // Update a single property
     * configService.patch({ name: 'updatedApp' });
     *
     * // Update multiple properties (existing properties are preserved)
     * configService.patch({
     *   name: 'newApp',
     *   // other properties remain unchanged
     * });
     *
     * // Patch with nested updates
     * configService.patch({
     *   name: 'app',
     *   // nested properties would be merged deeply if they existed
     * });
     * ```
     *
     * @see {@link subscribe} to observe changes
     * @see {@link deepMerge} for the merging implementation
     * @see {@link select} to observe specific properties reactively
     *
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
     * Replaces the entire configuration with a new configuration object.
     *
     * @param config - The complete configuration object to set
     *
     * @remarks
     * - Performs a complete replacement of the configuration (unlike {@link patch} which merges)
     * - The provided configuration object is used directly without deep cloning
     * - Emits the new configuration to all active subscribers via the BehaviorSubject
     * - Useful when you need to reset or swap the entire configuration state
     * - No properties are preserved from the previous configuration
     *
     * @example
     * ```ts
     * // Replace entire configuration
     * configService.reload({
     *   verbose: true,
     *   variants: { production: { esbuild: { minify: true } } },
     *   common: { esbuild: { write: true } }
     * });
     *
     * // Reset to default configuration
     * configService.reload(DEFAULTS_COMMON_CONFIG);
     *
     * // Swap between different configuration profiles
     * const prodConfig = loadProductionConfig();
     * configService.reload(prodConfig);
     * ```
     *
     * @see {@link patch} for partial configuration updates with deep merging
     * @see {@link subscribe} to observe configuration changes
     * @see {@link select} to observe specific configuration properties reactively
     *
     * @since 2.0.0
     */

    reload(config: Partial<T>): void {
        this.config$.next(deepMerge({}, this.initialConfig, config) as T);
    }
}
