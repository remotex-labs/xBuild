/**
 * Checks whether a value is a plain object (not null, not an array, but an object).
 *
 * @param item - The value to check
 *
 * @returns `true` if the value is a plain object, `false` otherwise
 *
 * @remarks
 * This type guard function narrows the type to `Record<string, unknown>` when it returns `true`.
 * A value is considered a plain object if it meets all criteria:
 * - Is truthy (not `null`, `undefined`, `false`, `0`, `''`, etc.)
 * - Has type `'object'`
 * - Is not an array
 *
 * This function treats class instances, dates, and other object types as plain objects since
 * they satisfy the criteria. Use more specific checks if you need to exclude these.
 *
 * @example
 * ```ts
 * isObject({}); // true
 * isObject({ key: 'value' }); // true
 * isObject(null); // false
 * isObject([]); // false
 * isObject('string'); // false
 * isObject(new Date()); // true (it's an object, not an array)
 * ```
 *
 * @see {@link deepMerge}
 *
 * @since 2.0.0
 */

export function isObject(item: unknown): item is Record<string, unknown> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Recursively merges multiple source objects into a target object with deep property merging.
 *
 * @template T - The type of the target object must extend `object`
 *
 * @param target - The target object to merge into
 * @param sources - One or more source objects to merge from
 *
 * @returns The target object with all sources merged into it
 *
 * @remarks
 * This function performs a deep merge with the following behavior:
 * - Primitive values in sources overwrite values in target
 * - Arrays are concatenated (target items first, then source items)
 * - Objects are recursively merged
 * - Sources are processed left-to-right, with later sources overwriting earlier ones
 * - The target object is mutated and returned
 *
 * Merge strategy by type:
 * - **Both arrays**: Concatenates `[...targetValue, ...sourceValue]`
 * - **Both objects**: Recursively merges properties
 * - **Source is object, target is not**: Creates a new object with source properties
 * - **Other cases**: Source value overwrites target value
 *
 * @example
 * ```ts
 * const target = { a: 1, b: { x: 10 } };
 * const source = { b: { y: 20 }, c: 3 };
 *
 * const result = deepMerge(target, source);
 * // { a: 1, b: { x: 10, y: 20 }, c: 3 }
 * ```
 *
 * @example
 * ```ts
 * // Array concatenation
 * const target = { items: [1, 2] };
 * const source = { items: [3, 4] };
 *
 * deepMerge(target, source);
 * // { items: [1, 2, 3, 4] }
 * ```
 *
 * @example
 * ```ts
 * // Multiple sources
 * const result = deepMerge(
 *   { a: 1 },
 *   { b: 2 },
 *   { c: 3 }
 * );
 * // { a: 1, b: 2, c: 3 }
 * ```
 *
 * @see {@link isObject}
 *
 * @since 2.0.0
 */
export function deepMerge<T extends object>(target: T, ...sources: Array<object>): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            const sourceValue = source[key];
            const targetValue = target[key];

            if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
                Object.assign(target, { [key]: [ ...targetValue, ...sourceValue ] });
            } else if (isObject(sourceValue)) {
                Object.assign(target, {
                    [key]: deepMerge(
                        isObject(targetValue) ? targetValue : {},
                        sourceValue
                    )
                });
            } else {
                Object.assign(target, { [key]: sourceValue });
            }
        }

        return deepMerge(target, ...sources);
    }

    return target;
}

/**
 * Performs deep equality comparison between two values with support for primitives, objects, arrays, and special types.
 *
 * @param a - The first value to compare
 * @param b - The second value to compare
 * @param strictCheck - When `true`, requires arrays and objects to have the same length/key count; defaults to `true`
 *
 * @returns `true` if values are deeply equal, `false` otherwise
 *
 * @remarks
 * This function performs comprehensive equality checking with special handling for:
 * - **Primitives**: Uses strict equality (`===`) and `Object.is()` for `NaN` and `-0` handling
 * - **Dates**: Compares timestamps using `getTime()`
 * - **RegExp**: Compares source patterns and flags
 * - **URLs**: Compares full `href` strings
 * - **Arrays**: Recursively compares elements
 * - **Objects**: Recursively compares properties
 *
 * The `strictCheck` parameter controls comparison behavior:
 * - `true` (default): Arrays must have the same length, objects must have the same key count.
 * - `false`: Allows partial matches (subset comparison)
 *
 * **Null handling**:
 * Returns `false` if either value is `null` (unless both are `null`, caught by `===` check).
 *
 * @example
 * ```ts
 * equals(1, 1); // true
 * equals('test', 'test'); // true
 * equals(NaN, NaN); // true (via Object.is)
 * equals(null, null); // true
 * ```
 *
 * @example
 * ```ts
 * // Date comparison
 * const date1 = new Date('2024-01-01');
 * const date2 = new Date('2024-01-01');
 * equals(date1, date2); // true
 * ```
 *
 * @example
 * ```ts
 * // Deep object comparison
 * equals(
 *   { a: 1, b: { c: 2 } },
 *   { a: 1, b: { c: 2 } }
 * ); // true
 * ```
 *
 * @example
 * ```ts
 * // Strict vs non-strict array comparison
 * equals([1, 2], [1, 2, 3], true); // false (different lengths)
 * equals([1, 2], [1, 2, 3], false); // true (subset match)
 * ```
 *
 * @see {@link deepEquals}
 * @see {@link hasKey}
 *
 * @since 2.0.0
 */

export function equals(a: unknown, b: unknown, strictCheck = true): boolean {
    if (a === b) return true;
    if (Object.is(a, b)) return true;
    if (a === null || b === null) return false;

    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();

    if (a instanceof RegExp && b instanceof RegExp)
        return a.source === b.source && a.flags === b.flags;

    if (URL && a instanceof URL && b instanceof URL)
        return a.href === b.href;

    if (typeof a === 'object' && typeof b === 'object') {
        return deepEquals(a, b, strictCheck);
    }

    return false;
}

/**
 * Checks whether an object or function has a specific property key.
 *
 * @param obj - The object or function to check
 * @param key - The property key to search for (string or symbol)
 *
 * @returns `true` if the key exists on the object, `false` otherwise
 *
 * @remarks
 * This function performs two checks to determine the key existence:
 * 1. Uses the `in` operator to check the prototype chain
 * 2. Uses `Object.prototype.hasOwnProperty.call()` for own properties
 *
 * Returns `false` if the value is:
 * - `null` or `undefined`
 * - Not an object or function (primitives like strings, numbers, booleans)
 *
 * This function is safer than direct property access when dealing with unknown objects,
 * as it handles `null` and `undefined` gracefully without throwing errors.
 *
 * @example
 * ```ts
 * const obj = { name: 'test' };
 * hasKey(obj, 'name'); // true
 * hasKey(obj, 'age'); // false
 * hasKey(null, 'key'); // false
 * hasKey('string', 'length'); // true
 * ```
 *
 * @example
 * ```ts
 * // Symbol keys
 * const sym = Symbol('key');
 * const obj = { [sym]: 'value' };
 * hasKey(obj, sym); // true
 * ```
 *
 * @see {@link deepEquals}
 *
 * @since 2.0.0
 */

export function hasKey(obj: unknown, key: string | symbol): boolean {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function'))
        return false;

    return key in obj || Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Performs deep equality comparison on objects and arrays with configurable strictness.
 *
 * @param a - The first object to compare
 * @param b - The second object to compare
 * @param strictCheck - When `true`, requires same length/key count; defaults to `true`
 *
 * @returns `true` if objects are deeply equal, `false` otherwise
 *
 * @remarks
 * This internal helper function is called by {@link equals} to handle object and array comparisons.
 * It recursively compares nested structures using the following logic:
 *
 * **Array comparison**:
 * - In strict mode: Arrays must have identical length
 * - Compares elements by index using {@link equals}
 * - Order matters (different order means not equal)
 *
 * **Object comparison**:
 * - In strict mode: Objects must have same number of keys
 * - Iterates through keys of the first object
 * - Checks if each key exists in the second object
 * - Recursively compares property values using {@link equals}
 *
 * **Non-strict mode** allows partial matches where the first value can be a subset of the second.
 *
 * @example
 * ```ts
 * // Arrays
 * deepEquals([1, 2, 3], [1, 2, 3], true); // true
 * deepEquals([1, 2], [1, 2, 3], false); // true (subset)
 * deepEquals([1, 2], [1, 2, 3], true); // false (different lengths)
 * ```
 *
 * @example
 * ```ts
 * // Nested objects
 * deepEquals(
 *   { user: { name: 'Alice', age: 30 } },
 *   { user: { name: 'Alice', age: 30 } },
 *   true
 * ); // true
 * ```
 *
 * @see {@link equals}
 * @see {@link hasKey}
 *
 * @since 2.0.0
 */

function deepEquals(a: object, b: object, strictCheck: boolean = true): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
        if(strictCheck && a.length !== b.length) return false;

        return a.every((val, i) => equals(val, b[i], strictCheck));
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (strictCheck && aKeys.length !== bKeys.length) return false;

    for (const key of aKeys) {
        if (!hasKey(b, key)) return false;
        if (!equals((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], strictCheck)) {
            return false;
        }
    }

    return true;
}
