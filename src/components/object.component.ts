/**
 * Reports whether a value can be treated as a keyed object.
 *
 * @param item - Value to test
 * @returns `true` when the value is a non-null object that is not an array
 *
 * @remarks
 * Narrows to `Record<string, unknown>`, which is what lets the merge and comparison helpers index a value they were
 * handed as `unknown`.
 * Only arrays and `null` are ruled out, so a `Date`, a `RegExp`, and a class instance all pass - the callers that
 * care treat those specially before asking.
 *
 * @example
 * ```ts
 * isObject({ key: 'value' }); // true
 * isObject(new Date());       // true - an object, whatever else it is
 * isObject([]);               // false
 * isObject(null);             // false
 * ```
 *
 * @see deepMerge
 * @since 2.0.0
 */

export function isObject(item: unknown): item is Record<string, unknown> {
    return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Reports whether a value is an ordinary keyed object rather than an instance of something.
 *
 * @param item - Value to test
 * @returns `true` when the value is an object literal, or one built with a null prototype
 *
 * @remarks
 * Where {@link isObject} asks whether a value can be indexed, this asks whether walking its keys describes it.
 * A `Date`, a `RegExp`, a `Map`, and a class instance carry their state somewhere other than their own enumerable
 * keys, so merging into a fresh object would leave nothing of them behind.
 * The test is that the prototype is a root of its chain rather than this realm's `Object.prototype`.
 * An object literal built inside a `vm` context therefore counts as plain,
 * which is what a configuration file executed in a sandbox hands back.
 *
 * @example
 * ```ts
 * isPlainObject({ key: 'value' });               // true
 * isPlainObject(Object.create(null));            // true
 * isPlainObject(runInNewContext('({ a: 1 })'));  // true - plain, whatever realm built it
 * isPlainObject(/^_/);                           // false - a value, not a shape
 * isPlainObject(new Date());                     // false
 * ```
 *
 * @see isObject
 * @see deepMerge
 *
 * @since 3.0.0
 */

export function isPlainObject(item: unknown): item is Record<string, unknown> {
    if (!isObject(item)) return false;
    const prototype = Object.getPrototypeOf(item);

    return prototype === null || Object.getPrototypeOf(prototype) === null;
}

/**
 * Merges objects into a target, recursing into nested objects.
 *
 * @typeParam T - Type of the object being merged into
 *
 * @param target - Object the sources are merged into, modified in place
 * @param sources - Objects to merge, applied left to right so a later one wins
 * @returns The target, for chaining
 *
 * @remarks
 * Three rules decide each key: two arrays concatenate, two plain objects merge, and anything else is overwritten.
 * A `Date`, a `RegExp`, a `Map`, and a class instance are values rather than shapes to walk,
 * so they are carried across as they stand.
 * Recursing into such a value would reduce it to a plain object holding whatever its own enumerable keys are.
 * Concatenation rather than replacement means merging the same configuration twice doubles its arrays,
 * so an accumulating merge wants a fresh target each time.
 * That is also the way to use this as a deep copy, by merging into `{}`.
 * The target is modified rather than copied, so pass a literal unless the caller means to have its object rewritten.
 *
 * @example
 * ```ts
 * deepMerge({ a: 1, b: { x: 10 } }, { b: { y: 20 }, c: 3 }); // { a: 1, b: { x: 10, y: 20 }, c: 3 }
 * deepMerge({ items: [ 1, 2 ] }, { items: [ 3 ] });          // { items: [ 1, 2, 3 ] } - concatenated
 * deepMerge({}, { pattern: /^_/ });                          // { pattern: /^_/ } - the same regular expression
 * deepMerge({}, config);                                     // a deep copy of config
 * ```
 *
 * @see isObject
 * @see isPlainObject
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
            } else if (isPlainObject(sourceValue)) {
                Object.assign(target, {
                    [key]: deepMerge(
                        isPlainObject(targetValue) ? targetValue : {},
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
 * Compares two values by structure rather than by identity.
 *
 * @param a - First value
 * @param b - Second value
 * @param strictCheck - Whether both sides must have the same number of entries, `true` by default
 * @returns `true` when the two are equal by these rules
 *
 * @remarks
 * `Date`, `RegExp`, and `URL` are compared by what they mean - timestamp, pattern and flags, href - rather than by
 * walking their properties, which would find nothing.
 * `NaN` equals itself here, unlike under `===`.
 * `0` and `-0` compare equal, since strict equality settles them before the question of sign arises.
 * Relaxing `strictCheck` turns the comparison into a subset test: every entry of the first value must appear in the
 * second, and extra entries in the second are ignored.
 *
 * @example
 * ```ts
 * equals(NaN, NaN);                                      // true
 * equals(new Date('2024-01-01'), new Date('2024-01-01')); // true
 * equals({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } });   // true
 * equals([ 1, 2 ], [ 1, 2, 3 ], false);                   // true - a subset
 * equals([ 1, 2 ], [ 1, 2, 3 ]);                          // false - lengths differ
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
 * Reports whether a key can be reached on a value.
 *
 * @param obj - Value to look in
 * @param key - Key to look for, a name or a symbol
 * @returns `true` when the key is reachable, own or inherited
 *
 * @remarks
 * Answers for objects and functions only: a primitive returns `false` even where the key would resolve, so
 * `'length'` on a string is not found here.
 * `null` and `undefined` answer `false` rather than throwing, which is the point of asking through this rather than
 * with `in` directly.
 *
 * @example
 * ```ts
 * hasKey({ name: 'test' }, 'name');   // true
 * hasKey({ name: 'test' }, 'age');    // false
 * hasKey(null, 'key');                // false
 * hasKey('string', 'length');         // false - a primitive, not an object
 * ```
 *
 * @since 2.0.0
 */

export function hasKey(obj: unknown, key: string | symbol): boolean {
    if (obj == null || (typeof obj !== 'object' && typeof obj !== 'function'))
        return false;

    return key in obj || Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Compares two objects or arrays entry by entry.
 *
 * @param a - First value
 * @param b - Second value
 * @param strictCheck - Whether both sides must have the same number of entries
 * @returns `true` when every entry of the first matches the second
 *
 * @remarks
 * The recursive half of {@link equals}, which handles the special types before delegating here.
 * Position compares arrays, so the same items in another order are not equal.
 * Objects are walked by the first value's own enumerable keys, which is what makes the relaxed mode a subset test -
 * a key the second value has and the first does not is never looked at.
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

/**
 * Serializes a value to JSON, carrying a `bigint` across as a string.
 *
 * @param value - Value to serialize
 * @returns The JSON text
 *
 * @throws TypeError - Raised when the value holds a circular reference
 *
 * @remarks
 * `JSON.stringify` throws on a `bigint` rather than serializing it, so this converts each to its decimal digits on
 * the way out.
 * The digits are written as a JSON string, since JSON has no number wide enough to hold them,
 * which is what keeps a value past `Number.MAX_SAFE_INTEGER` exact.
 * A reader therefore gets a string back where a `bigint` went in.
 * Everything else behaves as `JSON.stringify` does: an `undefined` property is dropped, a `Map` and a `Set` come out
 * as `{}`, and a `Date` comes out as the string its own `toJSON` produced.
 * A top-level `undefined`, function, or symbol still yields `undefined` rather than text,
 * which the declared return type does not admit.
 *
 * @example
 * ```ts
 * stringify({ id: 9007199254740993n }); // '{"id":"9007199254740993n"}' - the digits kept exactly
 * stringify({ a: 1, b: [ 1, 2 ] });     // '{"a":1,"b":[1,2]}'
 * stringify({ a: undefined, b: 1 });    // '{"b":1}' - the undefined key dropped
 * stringify(undefined);                 // undefined - not text, despite the signature
 * ```
 *
 * @since 3.0.0
 */

export function stringify(value: unknown): string {
    return JSON.stringify(value, (_, entry) => typeof entry === 'bigint' ? entry.toString() + 'n' : entry);
}
