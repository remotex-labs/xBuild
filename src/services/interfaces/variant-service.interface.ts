/**
 * Import will remove at compile time
 */

import type { VariantBuildInterface, CommonBuildInterface } from '@interfaces/configuration.interface';

/**
 * Represents a configuration snapshot passed to configuration change subscribers.
 * Contains both variant-specific and common configuration that may have been updated.
 *
 * @remarks
 * This interface is used by the configuration service's reactive subscription system
 * to notify subscribers when configuration changes occur. It provides a consistent
 * structure for configuration change events, allowing subscribers to receive both
 * the variant-specific configuration and the common configuration in a single callback.
 *
 * The interface is typically used with observable patterns where components subscribe
 * to configuration changes and receive updates through this data structure. Both
 * properties are optional to handle scenarios where:
 * - A variant is removed from configuration (variantConfig becomes undefined)
 * - Common configuration is not present (commonConfig is undefined)
 * - Configuration is being initialized or reset
 *
 * Subscribers should check for undefined values and handle missing configuration
 * appropriately, such as deactivating a variant when its configuration is removed.
 *
 * @example
 * ```ts
 * // Subscribe to configuration changes
 * configService.select(config => ({
 *   variantConfig: config.variants?.['production'],
 *   commonConfig: config.common
 * })).subscribe(({ variantConfig, commonConfig }: ConfigSubscriptionInterface) => {
 *   if (!variantConfig) {
 *     console.log('Variant removed from configuration');
 *     return;
 *   }
 *
 *   // Merge and apply new configuration
 *   const merged = deepMerge(commonConfig, variantConfig);
 *   applyConfiguration(merged);
 * });
 * ```
 *
 * @example
 * ```ts
 * // Handle configuration updates in a variant service
 * private handleConfigChange({ variantConfig, commonConfig }: ConfigSubscriptionInterface): void {
 *   this.active = false;
 *   const config = this.getConfig(variantConfig, commonConfig);
 *
 *   if (!config) {
 *     console.warn('Variant configuration no longer available');
 *     return;
 *   }
 *
 *   this.active = true;
 *   this.buildConfig = config;
 *   this.reloadSettings();
 * }
 * ```
 *
 * @see {@link CommonBuildInterface}
 * @see {@link ConfigurationService}
 * @see {@link VariantBuildInterface}
 * @see {@link VariantService.handleConfigChange}
 *
 * @since 2.0.0
 */

export interface ConfigSubscriptionInterface {

    /**
     * Common build configuration shared across all variants.
     *
     * @remarks
     * Contains build settings that apply to all variants unless overridden by
     * variant-specific configuration. This provides a base configuration layer
     * that can be merged with variant settings.
     *
     * Common configuration typically includes:
     * - Default esbuild options (minification, target, format)
     * - Shared TypeScript settings
     * - Common define replacements
     * - Default lifecycle hooks
     * - Shared banner/footer content
     *
     * This property is optional and may be undefined when:
     * - No common configuration is defined in the build config file
     * - Configuration is being reset or cleared
     * - A minimal configuration is in use
     *
     * Subscribers should handle undefined by using an empty object as default
     * or skipping the merge operation.
     *
     * @example
     * ```ts
     * const commonDefaults: CommonBuildInterface = {
     *   esbuild: {
     *     target: 'es2020',
     *     format: 'esm',
     *     minify: false
     *   }
     * };
     *
     * // Use common config if available, otherwise use defaults
     * const effectiveCommon = commonConfig ?? commonDefaults;
     * ```
     *
     * @see {@link CommonBuildInterface}
     *
     * @since 2.0.0
     */

    commonConfig?: CommonBuildInterface;

    /**
     * Variant-specific build configuration.
     *
     * @remarks
     * Contains build settings specific to a particular variant (e.g., 'production',
     * 'development', 'testing'). These settings override common configuration when
     * merged, allowing variants to customize build behavior.
     *
     * Variant configuration typically includes:
     * - Variant-specific esbuild options (minification, sourcemaps)
     * - Custom entry points
     * - Environment-specific define replacements
     * - Variant-specific lifecycle hooks
     * - TypeScript configuration overrides
     *
     * This property is optional and may be undefined when:
     * - The variant has been removed from configuration
     * - Configuration is being reset
     * - An invalid variant name was used in the subscription selector
     *
     * When undefined, subscribers should typically:
     * - Deactivate the variant to prevent builds
     * - Clean up variant-specific resources
     * - Log a warning or error about the missing configuration
     * - Return early without processing the update
     *
     * The presence of variantConfig is critical for determining whether a variant
     * should remain active and continue building.
     *
     * @example
     * ```ts
     * // Production variant configuration
     * const productionConfig: VariantBuildInterface = {
     *   esbuild: {
     *     minify: true,
     *     sourcemap: false,
     *     target: 'es2018'
     *   },
     *   types: { failOnError: true },
     *   declaration: { bundle: true }
     * };
     * ```
     *
     * @example
     * ```ts
     * // Handle missing variant configuration
     * function handleConfigChange({ variantConfig, commonConfig }: ConfigSubscriptionInterface) {
     *   if (!variantConfig) {
     *     console.warn('Variant configuration removed - deactivating variant');
     *     this.active = false;
     *     this.dispose();
     *     return;
     *   }
     *
     *   // Continue with configuration update
     *   this.updateConfig(variantConfig, commonConfig);
     * }
     * ```
     *
     * @see {@link VariantBuildInterface}
     *
     * @since 2.0.0
     */

    variantConfig?: VariantBuildInterface;
}
