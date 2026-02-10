/**
 * Import will remove at compile time
 */

import type {
    ProvidersType,
    ProviderUseValueInterface,
    ProviderUseClassInterface,
    InjectableOptionsInterface,
    ProviderUseFactoryInterface
} from '@symlinks/interfaces/symlinks.interface';

/**
 * Imports
 */

import {
    inject,
    Injectable,
    SINGLETONS,
    INJECTABLES,
    providersIntoArgs,
    isProviderUseValue,
    isProviderUseClass,
    isProviderUseFactory
} from '@symlinks/symlinks.module';

/**
 * Tests
 */

describe('isProviderUseClass', () => {
    test('should return true for a valid class provider', () => {
        const provider: ProviderUseClassInterface = { useClass: class {} };
        expect(isProviderUseClass(provider)).toBe(true);
    });

    test('should return false for null or undefined', () => {
        expect(isProviderUseClass(null)).toBe(false);
        expect(isProviderUseClass(undefined)).toBe(false);
    });

    test('should return false for non-object values', () => {
        expect(isProviderUseClass(123)).toBe(false);
        expect(isProviderUseClass('string')).toBe(false);
        expect(isProviderUseClass(true)).toBe(false);
    });

    test('should return false for objects without useClass property', () => {
        expect(isProviderUseClass({})).toBe(false);
        expect(isProviderUseClass({ useFactory: () => {} })).toBe(false);
        expect(isProviderUseClass({ useValue: 42 })).toBe(false);
    });

    test('should return true even if object has other properties alongside useClass', () => {
        const provider = { useClass: class {}, extra: 123 };
        expect(isProviderUseClass(provider)).toBe(true);
    });
});

describe('isProviderUseFactory', () => {
    test('should return true for a valid factory provider', () => {
        const provider: ProviderUseFactoryInterface = { useFactory: () => 'test' };
        expect(isProviderUseFactory(provider)).toBe(true);
    });

    test('should return false for null or undefined', () => {
        expect(isProviderUseFactory(null)).toBe(false);
        expect(isProviderUseFactory(undefined)).toBe(false);
    });

    test('should return false for non-object values', () => {
        expect(isProviderUseFactory(123)).toBe(false);
        expect(isProviderUseFactory('string')).toBe(false);
        expect(isProviderUseFactory(true)).toBe(false);
    });

    test('should return false for objects without useFactory property', () => {
        expect(isProviderUseFactory({})).toBe(false);
        expect(isProviderUseFactory({ useClass: class {} })).toBe(false);
        expect(isProviderUseFactory({ useValue: 42 })).toBe(false);
    });

    test('should return true even if object has other properties alongside useFactory', () => {
        const provider = { useFactory: () => 'test', extra: 123 };
        expect(isProviderUseFactory(provider)).toBe(true);
    });
});


describe('isProviderUseValue', () => {
    test('should return true for a valid value provider', () => {
        const provider: ProviderUseValueInterface = { useValue: 42 };
        expect(isProviderUseValue(provider)).toBe(true);
    });

    test('should return false for null or undefined', () => {
        expect(isProviderUseValue(null)).toBe(false);
        expect(isProviderUseValue(undefined)).toBe(false);
    });

    test('should return false for non-object values', () => {
        expect(isProviderUseValue(123)).toBe(false);
        expect(isProviderUseValue('string')).toBe(false);
        expect(isProviderUseValue(true)).toBe(false);
    });

    test('should return false for objects without useValue property', () => {
        expect(isProviderUseValue({})).toBe(false);
        expect(isProviderUseValue({ useClass: class {} })).toBe(false);
        expect(isProviderUseValue({ useFactory: () => {} })).toBe(false);
    });

    test('should return true even if object has other properties alongside useValue', () => {
        const provider = { useValue: 42, extra: 'abc' };
        expect(isProviderUseValue(provider)).toBe(true);
    });
});

describe('Injectable', () => {
    beforeEach(() => {
        INJECTABLES.clear();
    });

    test('should store metadata for a class without options', () => {
        @Injectable()
        class MyService {}

        const metadata = INJECTABLES.get(MyService);
        expect(metadata).toBeDefined();
        expect(metadata).toEqual({});
    });

    test('should store metadata for a class with options', () => {
        const options: InjectableOptionsInterface<typeof MyService> = { scope: 'singleton' };
        @Injectable(options)
        class MyService {}

        const metadata = INJECTABLES.get(MyService);
        expect(metadata).toBeDefined();
        expect(metadata).toEqual(options);
    });
});

describe('providersIntoArgs', () => {
    test('should return original args if providers is undefined', () => {
        const args = [ 1, 2 ];
        const result = providersIntoArgs(undefined, args);
        expect(result).toEqual([ 1, 2 ]);
    });

    test('should resolve value providers', () => {
        const providers: ProvidersType = [{ useValue: 42 }];
        const result = providersIntoArgs(providers);
        expect(result).toEqual([ 42 ]);
    });

    test('should resolve factory providers', () => {
        const providers: ProvidersType = [{ useFactory: () => 'hello' }];
        const result = providersIntoArgs(providers);
        expect(result).toEqual([ 'hello' ]);
    });

    test('should resolve class providers', () => {
        @Injectable()
        class MyClass {
            value = 123;
        }

        const providers: ProvidersType = [{ useClass: MyClass }];
        const result: Array<any> = providersIntoArgs(providers);

        expect(result.length).toBe(1);
        expect(result[0]).toBeInstanceOf(MyClass);
        expect(result[0].value).toBe(123);
    });

    test('should resolve direct constructor functions', () => {
        @Injectable()
        class MyClass {
            value = 'abc';
        }

        const providers: ProvidersType = [ MyClass ];
        const result: Array<any> = providersIntoArgs(providers);
        expect(result.length).toBe(1);
        expect(result[0]).toBeInstanceOf(MyClass);
        expect(result[0].value).toBe('abc');
    });

    test('should throw for unknown provider type', () => {
        const providers: ProvidersType = [ {} as any ];
        expect(() => providersIntoArgs(providers)).toThrow(/Unknown provider type/);
    });

    test('should resolve nested providers recursively', () => {
        @Injectable()
        class Inner {
            value = 'inner';
        }

        @Injectable({
            providers: [{ useClass: Inner }]
        })
        class Outer {
            constructor(public inner: Inner) {}
        }

        const providers: ProvidersType = [{ useClass: Outer }];
        const result: Array<any> = providersIntoArgs(providers);

        expect(result.length).toBe(1);
        expect(result[0]).toBeInstanceOf(<any> Outer);
        expect(result[0].inner).toBeInstanceOf(Inner);
        expect(result[0].inner.value).toBe('inner');
    });
});

describe('inject', () => {
    beforeEach(() => {
        SINGLETONS.clear();
        INJECTABLES.clear();
    });

    test('should instantiate a simple injectable class', () => {
        @Injectable()
        class MyService {
            value = 42;
        }

        const instance = inject(MyService);
        expect(instance).toBeInstanceOf(MyService);
        expect(instance.value).toBe(42);
    });

    test('should return the same instance for singleton scope', () => {
        @Injectable({ scope: 'singleton' })
        class SingletonService {
            id = Math.random();
        }

        const a = inject(SingletonService);
        const b = inject(SingletonService);
        expect(a).toBe(b);
        expect(a.id).toBe(b.id);
    });

    test('should instantiate a class using factory metadata', () => {
        const factory = xJet.fn(() => new FactoryService());
        @Injectable({ factory })
        class FactoryService {}

        const instance = inject(FactoryService);
        expect(factory).toHaveBeenCalled();
        expect(instance).toBeInstanceOf(FactoryService);
    });

    test('should inject dependencies from providers', () => {
        @Injectable()
        class Dep {
            depValue = 100;
        }

        @Injectable({ providers: [{ useClass: Dep }] })
        class Service {
            constructor(public dep: Dep) {}
        }

        const instance = inject(Service);
        expect(instance.dep).toBeInstanceOf(Dep);
        expect(instance.dep.depValue).toBe(100);
    });

    test('should throw when injecting a non-injectable class', () => {
        class NotInjectable {}

        expect(() => inject(NotInjectable)).toThrow(/not marked @Injectable/);
    });

    test('should pass extra args to the constructor', () => {
        @Injectable()
        class MyService {
            constructor(public a: number, public b: string) {}
        }

        const instance = inject(MyService, 5, 'test');
        expect(instance.a).toBe(5);
        expect(instance.b).toBe('test');
    });

    test('should recursively resolve nested providers', () => {
        @Injectable()
        class Inner {
            value = 'inner';
        }

        @Injectable({ providers: [{ useClass: Inner }] })
        class Outer {
            constructor(public inner: Inner) {}
        }

        const outer = inject(Outer);
        expect(outer.inner).toBeInstanceOf(Inner);
        expect(outer.inner.value).toBe('inner');
    });
});
