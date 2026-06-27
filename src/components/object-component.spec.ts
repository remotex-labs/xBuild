/**
 * Imports
 */

import { hasProviderKey } from './object.component';

/**
 * Tests
 */

describe('object.component', () => {
    describe('hasProviderKey', () => {
        test('returns true when an object owns the key', () => {
            expect(hasProviderKey({ useClass: class {} }, 'useClass')).toBe(true);
            expect(hasProviderKey({ value: 1 }, 'value')).toBe(true);
        });

        test('returns true even when the owned value is undefined', () => {
            expect(hasProviderKey({ useValue: undefined }, 'useValue')).toBe(true);
        });

        test('returns true for inherited (prototype) keys', () => {
            expect(hasProviderKey({}, 'toString')).toBe(true);
        });

        test('returns false when the key is absent', () => {
            expect(hasProviderKey({ a: 1 }, 'b')).toBe(false);
            expect(hasProviderKey({}, 'missing')).toBe(false);
        });

        test('returns false for null and undefined', () => {
            expect(hasProviderKey(null, 'a')).toBe(false);
            expect(hasProviderKey(undefined, 'a')).toBe(false);
        });

        test('returns false for non-object primitives', () => {
            expect(hasProviderKey(42, 'a')).toBe(false);
            expect(hasProviderKey('str', 'length')).toBe(false);
            expect(hasProviderKey(true, 'a')).toBe(false);
        });

        test('returns false for functions', () => {
            expect(hasProviderKey(() => {}, 'name')).toBe(false);
            expect(hasProviderKey(class {}, 'prototype')).toBe(false);
        });

        test('treats arrays as objects', () => {
            expect(hasProviderKey([ 1, 2 ], 'length')).toBe(true);
            expect(hasProviderKey([], '0')).toBe(false);
        });
    });
});
