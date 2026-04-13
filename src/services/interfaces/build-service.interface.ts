/**
 * Import will remove at compile time
 */

import type { PartialBuildConfigType } from '@interfaces/configuration.interface';
import type { BuildResultInterface } from '@providers/interfaces/esbuild-messages-provider.interface';

/**
 * Options used to reload the build service configuration.
 *
 * @remarks
 * These options control how configuration reload behaves:
 * - `config` replaces the current build configuration
 * - `clearCache` clears cached file and TypeScript language service state before reloading
 *
 * @since 2.3.0
 */

export interface ReloadOptionsInterface {
    /**
     * Optional new configuration to replace the current one.
     *
     * @remarks
     * When provided, the build service reloads using this configuration
     * before recalculating variants.
     *
     * @since 2.3.0
     */

    config?: PartialBuildConfigType;

    /**
     * Whether to clear cached files and TypeScript language service state before reloading.
     *
     * @remarks
     * When enabled, cached file tracking and language service state are reset
     * before the configuration is reloaded.
     *
     * @since 2.3.0
     */

    clearCache?: boolean;
}

/**
 * Isolated state container for a single {@link BuildService.build} invocation.
 *
 * @remarks
 * Created fresh on every `build()` call to ensure concurrent watch-mode
 * rebuilds cannot share or overwrite each other's state.
 *
 * Passed through {@link BuildService.buildVariant} to carry the promise
 * cache, accumulated errors, and collected results across the full
 * dependency graph traversal.
 *
 * @see {@link BuildService.build}
 * @see {@link BuildService.buildVariant}
 *
 * @since 2.4.0
 */
export interface BuildTreeInterface {
    /**
     * Promise cache keyed by variant name.
     *
     * @remarks
     * Ensures each variant builds exactly once per `build()` call.
     * Subsequent callers depending on the same variant await the
     * already-running promise instead of triggering a duplicate build.
     *
     * @since 2.4.0
     */

    cache: Map<string, Promise<void>>;

    /**
     * Accumulated build errors across all variants.
     *
     * @remarks
     * Errors are pushed here rather than thrown immediately, so all
     * variants attempt to build even if a sibling fails. Thrown together
     * as an `AggregateError` after all builds complete.
     *
     * @since 2.4.0
     */

    errors: Array<Error>;

    /**
     * Collected build results keyed by variant name.
     *
     * @remarks
     * Populated by {@link BuildService.buildVariant} as each variant
     * finishes. Only contains results for variants that built successfully.
     *
     * @since 2.4.0
     */

    results: Record<string, BuildResultInterface>;
}
