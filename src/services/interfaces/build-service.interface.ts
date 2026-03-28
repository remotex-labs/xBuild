/**
 * Import will remove at compile time
 */

import type { PartialBuildConfigType } from '@interfaces/configuration.interface';

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
     */

    config?: PartialBuildConfigType;

    /**
     * Whether to clear cached files and TypeScript language service state before reloading.
     *
     * @remarks
     * When enabled, cached file tracking and language service state are reset
     * before the configuration is reloaded.
     */

    clearCache?: boolean;
}
