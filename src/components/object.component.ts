/**
 * Tests whether a value is a non-null object carrying the given own/inherited key.
 *
 * @param value - The value to check.
 * @param key - The discriminating property name.
 * @returns `true` when `value` is an object containing `key`.
 *
 * @remarks
 * Shared foundation for the provider type guards, keeping their object/null/key checks in one place.
 *
 * @since 2.6.0
 */

export function hasProviderKey<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
    return typeof value === 'object' && value !== null && key in value;
}
