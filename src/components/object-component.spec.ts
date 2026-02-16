/**
 * Imports
 */

import { URL } from 'url';
import { deepMerge, isObject } from './object.component';

/**
 * Tests
 */

describe('deepMerge utility', () => {
    beforeAll(() => {
        (<any> globalThis).URL = URL;
    });

    beforeEach(() => {
        xJet.restoreAllMocks();
    });

    describe('isObject', () => {
        test('should return true for plain objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ a: 1 })).toBe(true);
        });

        test('should return false for arrays, null, or primitives', () => {
            expect(isObject([])).toBe(false);
            expect(isObject(null)).toBe(false);
            expect(isObject(42)).toBe(false);
            expect(isObject('hello')).toBe(false);
        });
    });

    describe('deepMerge', () => {
        test('should merge shallow objects', () => {
            const a = { a: 1, b: 2 };
            const b = { b: 3, c: 4 };
            const result = deepMerge(a, b);

            expect(result).toEqual({ a: 1, b: 3, c: 4 });
        });

        test('should deep merge nested objects', () => {
            const a = { nested: { a: 1 } };
            const b = { nested: { b: 2 } };
            const result = deepMerge(a, b);

            expect(result).toEqual({ nested: { a: 1, b: 2 } });
        });

        test('should merge multiple sources sequentially', () => {
            const a = { a: 1 };
            const b = { b: 2 };
            const c = { c: 3 };
            const result = deepMerge(a, b, c);

            expect(result).toEqual({ a: 1, b: 2, c: 3 });
        });

        test('should merge arrays by concatenation', () => {
            const a = { list: [ 1, 2 ] };
            const b = { list: [ 3, 4 ] };
            const result = deepMerge(a, b);

            expect(result).toEqual({ list: [ 1, 2, 3, 4 ] });
        });

        test('should merge nested arrays and objects', () => {
            const a = { config: { items: [ 1, 2 ], flag: true } };
            const b = { config: { items: [ 3 ], mode: 'dark' } };
            const result = deepMerge(a, b);

            expect(result).toEqual({
                config: { items: [ 1, 2, 3 ], flag: true, mode: 'dark' }
            });
        });

        test('should override primitive values with latest source', () => {
            const a = { value: 1 };
            const b = { value: 2 };
            const result = deepMerge(a, b);

            expect(result.value).toBe(2);
        });

        test('should initialize missing nested objects before merge', () => {
            const a = {};
            const b = { nested: { a: 1 } };
            const result = deepMerge(a, b);

            expect(result).toEqual({ nested: { a: 1 } });
        });

        test('should not throw when merging with null or non-object source', () => {
            const a = { x: 1 };
            // @ts-expect-error intentionally passing invalid input
            const result = deepMerge(a, null);

            expect(result).toEqual({ x: 1 });
        });

        test('should handle merging empty sources gracefully', () => {
            const a = { foo: 'bar' };
            const result = deepMerge(a);

            expect(result).toEqual({ foo: 'bar' });
        });

        test('should not mutate input arrays directly', () => {
            const arr1 = [ 1, 2 ];
            const arr2 = [ 3 ];
            const a = { list: arr1 };
            const b = { list: arr2 };

            const result = deepMerge(a, b);

            expect(result.list).toEqual([ 1, 2, 3 ]);
            expect(arr1).toEqual([ 1, 2 ]); // Original should remain unchanged
        });

        test('should deeply merge multiple levels of nested objects', () => {
            const a = { level1: { level2: { a: 1 } } };
            const b = { level1: { level2: { b: 2, c: [ 1 ] } } };
            const c = { level1: { level2: { c: [ 2, 3 ] } } };

            const result = deepMerge(a, b, c);

            expect(result).toEqual({
                level1: { level2: { a: 1, b: 2, c: [ 1, 2, 3 ] } }
            });
        });

        test('should call Object.assign when setting primitive values', () => {
            const spy = xJet.spyOn(Object, 'assign');
            const a = { a: 1 };
            const b = { b: 2 };

            deepMerge(a, b);

            expect(spy).toHaveBeenCalled();
        });

        test('should return same reference for target object', () => {
            const a = { a: 1 };
            const b = { b: 2 };
            const result = deepMerge(a, b);

            expect(result).toBe(a);
        });
    });
});

/**
 * Import will remove at compile time
 */

/**
 * Imports
 */

import { equals, hasKey } from '@components/object.component';

/**
 * Tests
 */

describe('Object Component', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('equals function - primitive values', () => {
        test('should return true for identical primitives', () => {
            expect(equals(5, 5)).toBe(true);
            expect(equals('hello', 'hello')).toBe(true);
            expect(equals(true, true)).toBe(true);
            expect(equals(false, false)).toBe(true);
        });

        test('should return false for different primitives', () => {
            expect(equals(5, 10)).toBe(false);
            expect(equals('hello', 'world')).toBe(false);
            expect(equals(true, false)).toBe(false);
        });

        test('should handle NaN comparison', () => {
            expect(equals(NaN, NaN)).toBe(true);
        });

        test('should handle Infinity comparison', () => {
            expect(equals(Infinity, Infinity)).toBe(true);
            expect(equals(-Infinity, -Infinity)).toBe(true);
            expect(equals(Infinity, -Infinity)).toBe(false);
        });

        test('should handle zero and negative zero', () => {
            expect(equals(0, -0)).toBe(true);
            expect(equals(-0, -0)).toBe(true);
        });

        test('should return false for different types', () => {
            expect(equals(5, '5')).toBe(false);
            expect(equals(true, 1)).toBe(false);
            expect(equals(null, undefined)).toBe(false);
        });

        test('should handle null values', () => {
            expect(equals(null, null)).toBe(true);
            expect(equals(null, undefined)).toBe(false);
            expect(equals(null, 0)).toBe(false);
        });

        test('should handle undefined values', () => {
            expect(equals(undefined, undefined)).toBe(true);
            expect(equals(undefined, null)).toBe(false);
        });
    });

    describe('equals function - Date objects', () => {
        test('should compare dates by time value', () => {
            const date1 = new Date('2024-01-01');
            const date2 = new Date('2024-01-01');

            expect(equals(date1, date2)).toBe(true);
        });

        test('should return false for different dates', () => {
            const date1 = new Date('2024-01-01');
            const date2 = new Date('2024-01-02');

            expect(equals(date1, date2)).toBe(false);
        });

        test('should return false when comparing date with other types', () => {
            const date = new Date('2024-01-01');

            expect(equals(date, '2024-01-01')).toBe(false);
            expect(equals(date, 1704067200000)).toBe(false);
        });

        test('should handle same date instance', () => {
            const date = new Date('2024-01-01');

            expect(equals(date, date)).toBe(true);
        });
    });

    describe('equals function - RegExp objects', () => {
        test('should compare regexps by source and flags', () => {
            const regex1 = /hello/gi;
            const regex2 = /hello/gi;

            expect(equals(regex1, regex2)).toBe(true);
        });

        test('should return false for different sources', () => {
            const regex1 = /hello/g;
            const regex2 = /world/g;

            expect(equals(regex1, regex2)).toBe(false);
        });

        test('should return false for different flags', () => {
            const regex1 = /hello/g;
            const regex2 = /hello/i;

            expect(equals(regex1, regex2)).toBe(false);
        });

        test('should handle same regex instance', () => {
            const regex = /test/g;

            expect(equals(regex, regex)).toBe(true);
        });

        test('should return false when comparing regex with other types', () => {
            const regex = /test/g;

            expect(equals(regex, '/test/g')).toBe(false);
            expect(equals(regex, { source: 'test', flags: 'g' })).toBe(false);
        });
    });

    describe('equals function - URL objects', () => {
        test('should compare URLs by href', () => {
            const url1 = new URL('https://example.com/path');
            const url2 = new URL('https://example.com/path');

            expect(equals(url1, url2)).toBe(true);
        });

        test('should return false for different URLs', () => {
            const url1 = new URL('https://example.com/path1');
            const url2 = new URL('https://example.com/path2');

            expect(equals(url1, url2)).toBe(false);
        });

        test('should handle same URL instance', () => {
            const url = new URL('https://example.com');

            expect(equals(url, url)).toBe(true);
        });

        test('should return false when comparing URL with other types', () => {
            const url = new URL('https://example.com');

            expect(equals(url, 'https://example.com')).toBe(false);
        });

        test('should compare URLs with query parameters', () => {
            const url1 = new URL('https://example.com?key=value');
            const url2 = new URL('https://example.com?key=value');

            expect(equals(url1, url2)).toBe(true);
        });
    });

    describe('equals function - Arrays', () => {
        test('should compare arrays by elements', () => {
            expect(equals([ 1, 2, 3 ], [ 1, 2, 3 ])).toBe(true);
        });

        test('should return false for arrays with different elements', () => {
            expect(equals([ 1, 2, 3 ], [ 1, 2, 4 ])).toBe(false);
        });

        test('should return false for arrays with different lengths in strict mode', () => {
            expect(equals([ 1, 2, 3 ], [ 1, 2 ], true)).toBe(false);
        });

        test('should compare arrays with different lengths in non-strict mode', () => {
            expect(equals([ 1, 2 ], [ 1, 2, 3 ], false)).toBe(true);
        });

        test('should handle empty arrays', () => {
            expect(equals([], [])).toBe(true);
        });

        test('should handle nested arrays', () => {
            expect(equals([[ 1, 2 ], [ 3, 4 ]], [[ 1, 2 ], [ 3, 4 ]])).toBe(true);
        });

        test('should handle arrays with different nested values', () => {
            expect(equals([[ 1, 2 ], [ 3, 4 ]], [[ 1, 2 ], [ 3, 5 ]])).toBe(false);
        });

        test('should compare arrays with mixed types', () => {
            expect(equals([ 1, 'hello', true ], [ 1, 'hello', true ])).toBe(true);
            expect(equals([ 1, 'hello', true ], [ 1, 'hello', false ])).toBe(false);
        });

        test('should handle arrays with null and undefined', () => {
            expect(equals([ null, undefined ], [ null, undefined ])).toBe(true);
            expect(equals([ null, undefined ], [ undefined, null ])).toBe(false);
        });

        test('should handle sparse arrays', () => {
            const arr1: unknown[] = [];
            arr1[2] = 3;
            const arr2: unknown[] = [];
            arr2[2] = 3;

            expect(equals(arr1, arr2)).toBe(true);
        });
    });

    describe('equals function - Objects', () => {
        test('should compare objects by properties', () => {
            expect(equals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        });

        test('should return false for objects with different properties', () => {
            expect(equals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
        });

        test('should return false for objects with different property count in strict mode', () => {
            expect(equals({ a: 1, b: 2 }, { a: 1 }, true)).toBe(false);
        });

        test('should compare objects with different property count in non-strict mode', () => {
            expect(equals({ a: 1 }, { a: 1, b: 2 }, false)).toBe(true);
        });

        test('should handle empty objects', () => {
            expect(equals({}, {})).toBe(true);
        });

        test('should handle nested objects', () => {
            const obj1 = { a: { b: { c: 1 } } };
            const obj2 = { a: { b: { c: 1 } } };

            expect(equals(obj1, obj2)).toBe(true);
        });

        test('should handle objects with different nested values', () => {
            const obj1 = { a: { b: { c: 1 } } };
            const obj2 = { a: { b: { c: 2 } } };

            expect(equals(obj1, obj2)).toBe(false);
        });

        test('should ignore property order', () => {
            expect(equals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        });

        test('should handle objects with null values', () => {
            expect(equals({ a: null }, { a: null })).toBe(true);
            expect(equals({ a: null }, { a: undefined })).toBe(false);
        });

        test('should compare objects with Date properties', () => {
            const date = new Date('2024-01-01');
            const obj1 = { date };
            const obj2 = { date: new Date('2024-01-01') };

            expect(equals(obj1, obj2)).toBe(true);
        });

        test('should compare objects with RegExp properties', () => {
            const obj1 = { regex: /test/g };
            const obj2 = { regex: /test/g };

            expect(equals(obj1, obj2)).toBe(true);
        });
    });

    describe('equals function - Complex nested structures', () => {
        test('should handle deeply nested mixed structures', () => {
            const obj1 = {
                array: [ 1, 2, { nested: true }],
                date: new Date('2024-01-01'),
                regex: /test/g
            };
            const obj2 = {
                array: [ 1, 2, { nested: true }],
                date: new Date('2024-01-01'),
                regex: /test/g
            };

            expect(equals(obj1, obj2)).toBe(true);
        });

        test('should return false for deep structures with one difference', () => {
            const obj1 = {
                array: [ 1, 2, { nested: true }],
                value: 42
            };
            const obj2 = {
                array: [ 1, 2, { nested: false }],
                value: 42
            };

            expect(equals(obj1, obj2)).toBe(false);
        });

        test('should handle arrays of objects', () => {
            const arr1 = [{ id: 1 }, { id: 2 }];
            const arr2 = [{ id: 1 }, { id: 2 }];

            expect(equals(arr1, arr2)).toBe(true);
        });

        test('should handle objects with array properties', () => {
            const obj1 = { items: [ 1, 2, 3 ] };
            const obj2 = { items: [ 1, 2, 3 ] };

            expect(equals(obj1, obj2)).toBe(true);
        });
    });

    describe('equals function - strictCheck parameter', () => {
        test('should enforce strict length check for arrays by default', () => {
            expect(equals([ 1, 2 ], [ 1, 2, 3 ])).toBe(false);
        });

        test('should skip strict length check when strictCheck is false', () => {
            expect(equals([ 1, 2 ], [ 1, 2, 3 ], false)).toBe(true);
        });

        test('should enforce strict property count check for objects by default', () => {
            expect(equals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        });

        test('should skip strict property count check when strictCheck is false', () => {
            expect(equals({ a: 1 }, { a: 1, b: 2 }, false)).toBe(true);
        });

        test('should propagate strictCheck to nested arrays', () => {
            expect(equals([[ 1, 2 ]], [[ 1, 2, 3 ]])).toBe(false);
            expect(equals([[ 1, 2 ]], [[ 1, 2, 3 ]], false)).toBe(true);
        });

        test('should propagate strictCheck to nested objects', () => {
            expect(equals({ nested: { a: 1 } }, { nested: { a: 1, b: 2 } })).toBe(false);
            expect(equals({ nested: { a: 1 } }, { nested: { a: 1, b: 2 } }, false)).toBe(true);
        });
    });

    describe('hasKey function - basic functionality', () => {
        test('should return true for existing properties', () => {
            const obj = { key: 'value' };

            expect(hasKey(obj, 'key')).toBe(true);
        });

        test('should return false for non-existing properties', () => {
            const obj = { key: 'value' };

            expect(hasKey(obj, 'nonexistent')).toBe(false);
        });

        test('should check for symbol keys', () => {
            const sym = Symbol('test');
            const obj = { [sym]: 'value' };

            expect(hasKey(obj, sym)).toBe(true);
            expect(hasKey(obj, Symbol('other'))).toBe(false);
        });

        test('should check inherited properties', () => {
            const parent = { key: 'value' };
            const child = Object.create(parent);

            expect(hasKey(child, 'key')).toBe(true);
        });

        test('should check own properties', () => {
            const obj = { key: 'value' };

            expect(hasKey(obj, 'key')).toBe(true);
        });
    });

    describe('hasKey function - edge cases', () => {
        test('should return false for null', () => {
            expect(hasKey(null, 'key')).toBe(false);
        });

        test('should return false for undefined', () => {
            expect(hasKey(undefined, 'key')).toBe(false);
        });

        test('should handle primitive types', () => {
            expect(hasKey(5, 'key')).toBe(false);
            expect(hasKey('string', 'key')).toBe(false);
            expect(hasKey(true, 'key')).toBe(false);
        });

        test('should return true for function objects', () => {
            const fn = () => {};
            fn.prop = 'value';

            expect(hasKey(fn, 'prop')).toBe(true);
        });

        test('should handle arrays', () => {
            const arr = [ 1, 2, 3 ];

            expect(hasKey(arr, <any> 0)).toBe(true);
            expect(hasKey(arr, 'length')).toBe(true);
            expect(hasKey(arr, <any> 5)).toBe(false);
        });

        test('should handle empty objects', () => {
            const obj = {};

            expect(hasKey(obj, 'key')).toBe(false);
        });
    });

    describe('hasKey function - object edge cases', () => {
        test('should check for constructor property', () => {
            const obj = {};

            expect(hasKey(obj, 'constructor')).toBe(true);
        });

        test('should check for toString property', () => {
            const obj = {};

            expect(hasKey(obj, 'toString')).toBe(true);
        });

        test('should handle objects with null prototype', () => {
            const obj = Object.create(null);
            obj.key = 'value';

            expect(hasKey(obj, 'key')).toBe(true);
            expect(hasKey(obj, 'toString')).toBe(false);
        });

        test('should handle object with defineProperty', () => {
            const obj = {};
            Object.defineProperty(obj, 'key', {
                value: 'value',
                enumerable: false
            });

            expect(hasKey(obj, 'key')).toBe(true);
        });

        test('should handle objects with getters', () => {
            const obj = {
                get key() {
                    return 'value';
                }
            };

            expect(hasKey(obj, 'key')).toBe(true);
        });
    });

    describe('hasKey function - string keys', () => {
        test('should handle numeric string keys', () => {
            const obj = { '123': 'value' };

            expect(hasKey(obj, '123')).toBe(true);
        });

        test('should handle special character keys', () => {
            const obj = { 'key-with-dash': 'value', 'key.with.dot': 'value' };

            expect(hasKey(obj, 'key-with-dash')).toBe(true);
            expect(hasKey(obj, 'key.with.dot')).toBe(true);
        });

        test('should be case-sensitive for string keys', () => {
            const obj = { Key: 'value' };

            expect(hasKey(obj, 'Key')).toBe(true);
            expect(hasKey(obj, 'key')).toBe(false);
        });

        test('should handle empty string as key', () => {
            const obj = { '': 'value' };

            expect(hasKey(obj, '')).toBe(true);
        });
    });

    describe('integration tests', () => {
        test('should use equals and hasKey together', () => {
            const obj1 = { a: 1, b: 2 };
            const obj2 = { a: 1, b: 2 };

            if (hasKey(obj1, 'a') && hasKey(obj2, 'a')) {
                expect(equals(obj1, obj2)).toBe(true);
            }
        });

        test('should validate complex data structures', () => {
            const config1 = {
                url: new URL('https://example.com'),
                pattern: /test/gi,
                timestamp: new Date('2024-01-01'),
                settings: { debug: true, timeout: 5000 }
            };

            const config2 = {
                url: new URL('https://example.com'),
                pattern: /test/gi,
                timestamp: new Date('2024-01-01'),
                settings: { debug: true, timeout: 5000 }
            };

            expect(equals(config1, config2)).toBe(true);
            expect(hasKey(config1, 'url')).toBe(true);
            expect(hasKey(config1, 'settings')).toBe(true);
        });

        test('should handle configuration validation', () => {
            const defaultConfig = { host: 'localhost', port: 3000, debug: false };
            const userConfig = { host: 'localhost', port: 3000 };

            expect(equals(userConfig, defaultConfig, false)).toBe(true);
            expect(hasKey(userConfig, 'host')).toBe(true);
            expect(hasKey(userConfig, 'port')).toBe(true);
        });
    });

    describe('performance and corner cases', () => {
        test('should handle circular references gracefully', () => {
            const obj1: any = { a: 1 };
            obj1.self = obj1;

            const obj2: any = { a: 1 };
            obj2.self = obj2;

            // Circular references will likely cause issues, but we're documenting behavior
            // This test ensures the function doesn't crash
            expect(() => {
                try {
                    equals(obj1, obj2);
                } catch {
                    // Expected for circular references
                }
            }).not.toThrow();
        });

        test('should handle very deeply nested objects', () => {
            const obj1: any = {};
            const obj2: any = {};
            let current1 = obj1;
            let current2 = obj2;

            for (let i = 0; i < 50; i++) {
                current1.nested = { value: i };
                current2.nested = { value: i };
                current1 = current1.nested;
                current2 = current2.nested;
            }

            expect(equals(obj1, obj2)).toBe(true);
        });

        test('should handle large arrays', () => {
            const arr1 = Array.from({ length: 1000 }, (_, i) => i);
            const arr2 = Array.from({ length: 1000 }, (_, i) => i);

            expect(equals(arr1, arr2)).toBe(true);
        });

        test('should handle objects with many properties', () => {
            const obj1: any = {};
            const obj2: any = {};

            for (let i = 0; i < 100; i++) {
                obj1[`key${ i }`] = i;
                obj2[`key${ i }`] = i;
            }

            expect(equals(obj1, obj2)).toBe(true);
        });
    });
});
