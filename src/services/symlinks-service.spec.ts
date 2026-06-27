/**
 * Imports
 */

import { inject, Injectable, SINGLETONS, forceInject, INJECTABLES } from './symlinks.service';
import { isProviderUseClass, isProviderUseValue, providersIntoArgs, isProviderUseFactory } from './symlinks.service';

/**
 * Tests
 */

describe('symlinks.module', () => {
    afterEach(() => {
        SINGLETONS.clear();
        INJECTABLES.clear();
    });

    describe('isProviderUseClass', () => {
        test('returns true only for a useClass provider', () => {
            expect(isProviderUseClass({ useClass: class {} })).toBe(true);
            expect(isProviderUseClass({ useFactory: (): void => {} })).toBe(false);
            expect(isProviderUseClass({ useValue: 1 })).toBe(false);
        });

        test('returns false for non-objects', () => {
            expect(isProviderUseClass(null)).toBe(false);
            expect(isProviderUseClass(() => {})).toBe(false);
            expect(isProviderUseClass(42)).toBe(false);
        });
    });

    describe('isProviderUseFactory', () => {
        test('returns true only for a useFactory provider', () => {
            expect(isProviderUseFactory({ useFactory: (): void => {} })).toBe(true);
            expect(isProviderUseFactory({ useClass: class {} })).toBe(false);
            expect(isProviderUseFactory({ useValue: 1 })).toBe(false);
            expect(isProviderUseFactory(null)).toBe(false);
        });
    });

    describe('isProviderUseValue', () => {
        test('returns true only for a useValue provider', () => {
            expect(isProviderUseValue({ useValue: 1 })).toBe(true);
            expect(isProviderUseValue({ useValue: undefined })).toBe(true);
            expect(isProviderUseValue({ useClass: class {} })).toBe(false);
            expect(isProviderUseValue(null)).toBe(false);
        });
    });

    describe('Injectable', () => {
        test('registers a class with its options', () => {
            class Service {}
            const options = { scope: 'singleton' as const };
            Injectable(options)(Service);

            expect(INJECTABLES.get(Service)).toBe(options);
        });

        test('registers an empty options object when none are given', () => {
            class Service {}
            Injectable()(Service);

            expect(INJECTABLES.get(Service)).toEqual({});
        });
    });

    describe('providersIntoArgs', () => {
        test('returns the initial args when no providers are given', () => {
            expect(providersIntoArgs(undefined, [ 1, 2 ])).toEqual([ 1, 2 ]);
            expect(providersIntoArgs()).toEqual([]);
        });

        test('resolves useValue providers', () => {
            expect(providersIntoArgs([{ useValue: 42 }, { useValue: 'a' }])).toEqual([ 42, 'a' ]);
        });

        test('resolves useFactory providers and feeds them their own providers', () => {
            const args = providersIntoArgs([
                { useFactory: (): string => 'hi' },
                { useFactory: (n: number): number => n + 1, providers: [{ useValue: 41 }] }
            ]);

            expect(args).toEqual([ 'hi', 42 ]);
        });

        test('resolves a useClass provider by injecting the class', () => {
            class Database {}
            Injectable()(Database);

            const [ db ] = providersIntoArgs([{ useClass: Database }]);

            expect(db).toBeInstanceOf(Database);
        });

        test('resolves a plain constructor provider by injecting it', () => {
            class Database {}
            Injectable()(Database);

            const [ db ] = providersIntoArgs([ Database ]);

            expect(db).toBeInstanceOf(Database);
        });

        test('skips providers already covered by the initial args', () => {
            const result = providersIntoArgs([{ useValue: 'a' }, { useValue: 'b' }], [ 'pre' ]);

            expect(result).toEqual([ 'pre', 'b' ]);
        });

        test('throws on an unknown provider shape', () => {
            expect(() => providersIntoArgs([ 42 as any ])).toThrow('Unknown provider type');
            expect(() => providersIntoArgs([ {} as any ])).toThrow('Unknown provider type');
        });
    });

    describe('inject', () => {
        test('throws when the class is not marked @Injectable', () => {
            class NotRegistered {}

            expect(() => inject(NotRegistered)).toThrow('not marked @Injectable');
        });

        test('instantiates a class with no providers', () => {
            class Service {}
            Injectable()(Service);

            expect(inject(Service)).toBeInstanceOf(Service);
        });

        test('returns the same instance for a singleton scope', () => {
            class Service {}
            Injectable({ scope: 'singleton' })(Service);

            expect(inject(Service)).toBe(inject(Service));
            expect(SINGLETONS.has(Service)).toBe(true);
        });

        test('returns a fresh instance when not a singleton', () => {
            class Service {}
            Injectable()(Service);

            expect(inject(Service)).not.toBe(inject(Service));
        });

        test('resolves constructor dependencies from providers', () => {
            class Database {}
            class UserService {
                constructor(public db: Database) {}
            }
            Injectable()(Database);
            Injectable({ providers: [ Database ] })(UserService);

            const user = inject(UserService);

            expect(user).toBeInstanceOf(UserService);
            expect(user.db).toBeInstanceOf(Database);
        });

        test('uses a custom factory instead of the constructor', () => {
            class Service {}
            const made = { tag: 'factory' };
            Injectable({ factory: () => made as any })(Service);

            expect(inject(Service)).toBe(made);
        });

        test('lets explicit args override provider-resolved values', () => {
            class Api {
                constructor(public url: string) {}
            }
            Injectable({ providers: [{ useValue: 'default-url' }] })(Api);

            expect(inject(Api).url).toBe('default-url');
            expect(inject(Api, 'override').url).toBe('override');
        });
    });

    describe('forceInject', () => {
        test('bypasses an existing singleton and creates a fresh instance', () => {
            class Service {}
            Injectable({ scope: 'singleton' })(Service);

            const first = inject(Service);
            const forced = forceInject(Service);

            expect(forced).not.toBe(first);
            expect(forced).toBeInstanceOf(Service);
            expect(SINGLETONS.get(Service)).toBe(forced);
        });
    });
});
