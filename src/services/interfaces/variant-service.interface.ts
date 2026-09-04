/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecyclePluginInterface } from '@interfaces/lifecycle.interface';
import type { BaseConfigurationInterface, VariantConfigurationInterface } from '@interfaces/configuration.interface';

/**
 * The slice of the configuration a variant watches.
 *
 * @remarks
 * What the configuration service hands a variant whenever the configuration changes,
 * holding the common block and the variant's own entry rather than the whole configuration.
 * A missing `variant` means the entry was removed, which is what tells the variant to dispose of itself.
 *
 * @example
 * ```ts
 * const change: VariantSubscriptionInterface = {
 *     common: { types: true },
 *     variant: { esbuild: { format: 'esm', outdir: 'dist/esm', ... } }
 * };
 * ```
 *
 * @see VariantService
 * @see BaseConfigurationInterface
 * @see VariantConfigurationInterface
 *
 * @since 3.0.0
 */

export interface VariantSubscriptionInterface {
    /**
     * The settings every variant inherits, absent when the configuration declares none.
     *
     * @remarks
     * Merged under the variant, so a setting the variant names wins over the one here.
     *
     * @example
     * ```ts
     * change.common?.types; // true
     * ```
     *
     * @see BaseConfigurationInterface
     * @since 3.0.0
     */

    common?: BaseConfigurationInterface;

    /**
     * The variant's own entry, absent once the configuration no longer declares it.
     *
     * @remarks
     * Its absence is what ends the variant, since a build with no entry left to describe it has nothing to run.
     *
     * @example
     * ```ts
     * change.variant?.esbuild.outdir; // 'dist/esm'
     * ```
     *
     * @see VariantConfigurationInterface
     * @since 3.0.0
     */

    variant?: VariantConfigurationInterface;
}

/**
 * The call a stage runs against each hook of a build.
 *
 * @remarks
 * Names which hook of the set the stage wants and hands it whatever that stage receives,
 * so one walk over the hooks serves every stage instead of each stage writing a walk of its own.
 * The result is `unknown`, since a start hook and a load hook answer with different shapes,
 * and the stage narrows it through the type parameter it dispatched with.
 *
 * @example
 * ```ts
 * const call: CallType = hook => hook.onStart?.({ context, esbuild });
 * ```
 *
 * @see HandleType
 * @see LifecyclePluginInterface
 *
 * @since 3.0.0
 */

export type CallType = (hook: LifecyclePluginInterface) => unknown;

/**
 * The test that decides whether a hook's result ends the walk.
 *
 * @typeParam T - Result the stage's hooks answer with
 *
 * @remarks
 * Returning `true` settles the stage on that result and leaves the hooks after it unrun,
 * which is what lets the first resolve hook to answer claim a path.
 * Returning `false` carries the walk on, so a stage folding every answer together sees all of them.
 * The test doubles as the place a stage folds each result into what it holds so far,
 * since it runs as each one arrives.
 *
 * @example
 * ```ts
 * const first: HandleType<OnResolveResult> = () => true;  // the first answer settles it
 * const every: HandleType<OnLoadResult> = () => false;    // every hook is consulted
 * ```
 *
 * @see CallType
 * @since 3.0.0
 */

export type HandleType<T> = (result: T) => boolean;
