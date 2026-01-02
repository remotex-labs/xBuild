/**
 * Imports
 */

import { URL } from 'url';

/**
 * Type guard function that validates if a value is a plain object.
 *
 * @remarks
 * This function checks whether a given value is a plain JavaScript object (excluding arrays,
 * null, and primitives). It serves as a TypeScript type guard using the `is` keyword, which
 * narrows the type of the parameter to {@link Record}&lt;string, unknown&gt; when the function
 * returns `true`.
 *
 * **What qualifies as an object**:
 * - Value must be truthy (not null, undefined, 0, '', false, etc.)
 * - Value's `typeof` must be `'object'`
 * - Value must NOT be an Array instance
 *
 * **What does NOT qualify**:
 * - Arrays (explicitly excluded even though they are objects)
 * - null (typeof null === 'object' but is filtered out)
 * - Primitives (string, number, boolean, symbol, bigint)
 * - Functions (typeof function === 'function')
 *
 * **Type narrowing**:
 * When used in conditional statements, TypeScript automatically narrows the type:
 * ```ts
 * if (isObject(value)) {
 *   // Inside this block, 'value' is typed as Record<string, unknown>
 *   value.someKey = 'value';
 * }
 * ```
 *
 * @param item - The value to check. Can be any type.
 *
 * @returns `true` if the item is a plain object, `false` otherwise. The return type uses
 *          TypeScript's type predicate (`item is Record<string, unknown>`) to enable
 *          type narrowing in consumer code.
 *
 * @example
 * ```ts
 * isObject({}) // true
 * isObject({ key: 'value' }) // true
 * isObject(new Object()) // true
 *
 * isObject([]) // false (array)
 * isObject(null) // false (null)
 * isObject(undefined) // false (undefined)
 * isObject('string') // false (primitive)
 * isObject(42) // false (primitive)
 * isObject(() => {}) // false (function)
 * ```
 *
 * @see deepMerge - Often used together to validate merge sources
 * @since 2.0.0
 */

export function isObject(item: unknown): item is Record<string, unknown> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Recursively merges one or more source objects into a target object.
 *
 * @remarks
 * This function performs a deep merge operation, combining properties from source objects
 * into a target object. When properties exist in multiple objects, source values override
 * target values (left-to-right order). Special handling applies to arrays and nested objects.
 *
 * **Merge behavior**:
 * - **Primitives and simple values**: Source value overwrites target value
 * - **Arrays**: Arrays are concatenated ([...target, ...source]). Target array items
 *              come first, followed by source array items
 * - **Nested objects**: Recursively merged using the same rules
 * - **Type mismatches**: If target has a non-object value but a source has an object,
 *                       the source object is assigned directly
 *
 * **Important characteristics**:
 * - Mutates the target object (modifies it in place, does not create a copy)
 * - Processes multiple sources sequentially (left to right)
 * - Validates input using {@link isObject} to ensure safe merging
 * - Returns the modified target object for chaining
 *
 * **Typical use cases**:
 * - Merging configuration objects (base config and user overrides)
 * - Combining build settings from multiple sources
 * - Deep cloning object hierarchies (bypassing an empty object as a target)
 *
 * @template T - The type of the target object. The return type matches the target type.
 *
 * @param target - The target object that will be mutated and returned. All source properties
 *                 will be merged into this object.
 * @param sources - One or more source objects to merge into the target. Each source is
 *                  processed in order, with later sources taking precedence.
 *
 * @returns The modified target object with all sources merged into it. The return type
 *          matches the target object's type parameter T.
 *
 * @example
 * ```ts
 * // Basic object merge
 * const target = { a: 1, b: 2 };
 * const source = { b: 3, c: 4 };
 * deepMerge(target, source);
 * // Result: { a: 1, b: 3, c: 4 }
 *
 * // Nested object merge
 * const config = { db: { host: 'localhost', port: 5432 } };
 * const override = { db: { port: 3306 } };
 * deepMerge(config, override);
 * // Result: { db: { host: 'localhost', port: 3306 } }
 *
 * // Array concatenation
 * const base = { plugins: ['a', 'b'] };
 * const additional = { plugins: ['c', 'd'] };
 * deepMerge(base, additional);
 * // Result: { plugins: ['a', 'b', 'c', 'd'] }
 *
 * // Multiple sources (processed left to right)
 * const obj = { a: 1 };
 * deepMerge(obj, { a: 2, b: 3 }, { b: 4, c: 5 });
 * // Result: { a: 2, b: 4, c: 5 }
 *
 * // Merging build configurations
 * const baseConfig = {
 *   types: true,
 *   esbuild: { format: 'esm', minify: true }
 * };
 * const buildOverride = {
 *   esbuild: { minify: false }
 * };
 * deepMerge(baseConfig, buildOverride);
 * // Result: { types: true, esbuild: { format: 'esm', minify: false } }
 * ```
 *
 * @see isObject - Type guard used internally for validation
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
 * Compares two values for equality with support for complex types and strict mode.
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @param strictCheck - If `true`, enforces strict length/property count checks. Defaults to `true`.
 * @returns `true` if the values are equal, `false` otherwise.
 *
 * @remarks
 * This function provides deep equality comparison with special handling for various types:
 *
 * - **Primitives**: Uses strict equality (`===`) and `Object.is()` for accurate comparisons
 * - **Date objects**: Compares by time value (`getTime()`)
 * - **RegExp objects**: Compares by source and flags
 * - **URL objects**: Compares by href property
 * - **Arrays**: Recursively compares elements; length mismatch fails in strict mode
 * - **Objects**: Recursively compares properties; property count mismatch fails in strict mode
 *
 * The `strictCheck` parameter controls whether length (arrays) and property count (objects)
 * must match exactly. When `false`, allows comparing subsets of arrays or objects.
 *
 * @example
 * ```ts
 * // Primitive comparison
 * equals(5, 5); // true
 * equals('hello', 'hello'); // true
 * equals(NaN, NaN); // true
 *
 * // Date comparison
 * equals(new Date('2024-01-01'), new Date('2024-01-01')); // true
 *
 * // RegExp comparison
 * equals(/test/gi, /test/gi); // true
 *
 * // Array comparison
 * equals([1, 2, 3], [1, 2, 3]); // true
 * equals([1, 2], [1, 2, 3]); // false (strict mode)
 * equals([1, 2], [1, 2, 3], false); // true (non-strict mode)
 *
 * // Object comparison
 * equals({ a: 1, b: 2 }, { a: 1, b: 2 }); // true
 * equals({ a: 1 }, { a: 1, b: 2 }); // false (strict mode)
 * equals({ a: 1 }, { a: 1, b: 2 }, false); // true (non-strict mode)
 *
 * // Nested structures
 * equals(
 *   { nested: { value: 1 }, date: new Date('2024-01-01') },
 *   { nested: { value: 1 }, date: new Date('2024-01-01') }
 * ); // true
 * ```
 *
 * @see hasKey
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
 * Checks if an object has a specific key or property.
 *
 * @param obj - The object to check. Can be any value including null, primitives, or functions.
 * @param key - The property key to check. Can be a string or symbol.
 * @returns `true` if the object has the key (own or inherited), `false` otherwise.
 *
 * @remarks
 * This function checks for the presence of a property using two methods:
 * 1. The `in` operator - checks for both own and inherited properties
 * 2. `Object.prototype.hasOwnProperty` - checks for own properties only
 *
 * Returns `false` for null, undefined, and non-object primitives (numbers, strings, booleans).
 * Function objects are supported and can have properties.
 *
 * Common use cases:
 * - Validating object structure before access
 * - Checking for both own and inherited properties
 * - Safe property access in dynamic code
 *
 * @example
 * ```ts
 * const obj = { name: 'John', age: 30 };
 *
 * hasKey(obj, 'name'); // true
 * hasKey(obj, 'nonexistent'); // false
 *
 * // Symbol keys
 * const sym = Symbol('id');
 * const objWithSymbol = { [sym]: 123 };
 * hasKey(objWithSymbol, sym); // true
 *
 * // Inherited properties
 * const parent = { inherited: true };
 * const child = Object.create(parent);
 * hasKey(child, 'inherited'); // true
 *
 * // Edge cases
 * hasKey(null, 'key'); // false
 * hasKey(undefined, 'key'); // false
 * hasKey(42, 'key'); // false
 * hasKey(() => {}, 'call'); // true (functions have properties)
 *
 * // Array properties
 * const arr = [1, 2, 3];
 * hasKey(arr, 0); // true
 * hasKey(arr, 'length'); // true
 * hasKey(arr, 10); // false
 * ```
 *
 * @see equals
 * @since 2.0.0
 */

export function hasKey(obj: unknown, key: string | symbol): boolean {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function'))
        return false;

    return key in obj || Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Internal helper function that performs deep equality comparison on objects and arrays.
 *
 * @param a - The first object/array to compare.
 * @param b - The second object/array to compare.
 * @param strictCheck - If `true`, enforces strict length/property count checks. Defaults to `true`.
 * @returns `true` if the objects are deeply equal, `false` otherwise.
 *
 * @remarks
 * This is a recursive helper used by the {@link equals} function to handle complex nested
 * structures. It distinguishes between arrays and objects and compares them accordingly:
 *
 * - **Arrays**: Compares length (in strict mode) and all elements recursively
 * - **Objects**: Compares property count (in strict mode) and all properties recursively
 *
 * The `strictCheck` parameter propagates through recursive calls, ensuring consistent
 * comparison behavior for deeply nested structures.
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
