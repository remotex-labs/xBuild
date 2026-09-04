/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BaseConfigurationInterface } from '@interfaces/configuration.interface';
import type { DeclarationOptionsInterface, TypeCheckOptionsInterface } from '@interfaces/configuration.interface';

/**
 * Collapses a setting written as either a flag or an options object into the object form alone.
 *
 * @typeParam T - Shape the long form of the setting takes
 *
 * @param value - The setting as the configuration spelled it, or `undefined` when it named none
 * @returns The options to work from, or `undefined` when the setting is off
 *
 * @remarks
 * A setting a configuration may write as `true` or as an object leaves every reader testing both forms.
 * This gives them one shape instead: `undefined` says the setting is off, and anything else says it is on and carries
 * the settings for it.
 * `true` becomes an empty object rather than a truthy scalar, so a caller reads a field from the result without first
 * asking which form the configuration used.
 * `false` and an omitted setting both come back `undefined`, since neither turns the setting on.
 *
 * @example
 * ```ts
 * flagOptions(true);                // {} - on, with nothing said about how
 * flagOptions({ outDir: 'types' }); // { outDir: 'types' }
 * flagOptions(false);               // undefined
 * flagOptions(undefined);           // undefined
 * ```
 *
 * @see typesOptions
 * @see declarationOptions
 *
 * @since 3.0.0
 */

export function flagOptions<T extends object>(value?: boolean | T): T | undefined {
    if (!value) return undefined;

    return value === true ? <T> {} : value;
}

/**
 * Reads the type-checking settings of a configuration, whichever form it wrote them in.
 *
 * @param config - Configuration block to read, the common one or a variant's
 * @returns The type-checking options, or `undefined` when checking is off
 *
 * @remarks
 * The result is what decides whether the build type-checks at all, so a caller tests it before reading a field.
 * `types: true` yields an empty object, which means checking is on under its defaults rather than off.
 *
 * @example
 * ```ts
 * typesOptions({ types: true });                  // {} - check and report
 * typesOptions({ types: { failOnError: true } }); // { failOnError: true }
 * typesOptions({});                               // undefined - no checking
 * ```
 *
 * @see flagOptions
 * @since 3.0.0
 */

export function typesOptions(config: BaseConfigurationInterface): TypeCheckOptionsInterface | undefined {
    return flagOptions(config.types);
}

/**
 * Reads the declaration settings of a configuration, whichever form it wrote them in.
 *
 * @param config - Configuration block to read, the common one or a variant's
 * @returns The declaration options, or `undefined` when no declarations are emitted
 *
 * @remarks
 * The result is what decides whether declarations are emitted at all, so a caller tests it before reading a field.
 * `declaration: true` yields an empty object, so `outDir` reads as `undefined` and the emit falls back to the
 * directory the compiler options name.
 *
 * @example
 * ```ts
 * declarationOptions({ declaration: true });                     // {} - emit under the configured directory
 * declarationOptions({ declaration: { outDir: 'types' } });      // { outDir: 'types' }
 * declarationOptions({});                                        // undefined - nothing emitted
 * ```
 *
 * @see flagOptions
 * @since 3.0.0
 */

export function declarationOptions(config: BaseConfigurationInterface): DeclarationOptionsInterface | undefined {
    return flagOptions(config.declaration);
}
