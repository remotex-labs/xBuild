/**
 * Import will remove at compile time
 */

import type { InjectableOptionsInterface, ProvidersType } from './interfaces/symlinks.interface';
import type { ProviderUseFactoryInterface, ProviderUseValueInterface } from './interfaces/symlinks.interface';
import type { ProviderUseClassInterface, ConstructorType, ConstructorLikeType } from './interfaces/symlinks.interface';

/**
 * A collection of singleton instances for injectable classes.
 *
 * @remarks
 * This map stores instances of classes marked as `singleton` in `@Injectable` metadata.
 * It ensures that only one instance exists for the lifetime of the application.
 *
 * @see ConstructorType
 * @since 2.0.0
 */

export const SINGLETONS = new Map<ConstructorType, unknown>();

/**
 * Stores metadata for all classes marked with the `@Injectable` decorator.
 *
 * @remarks
 * The metadata includes scope, factory function, and provider dependencies.
 *
 * @see Injectable
 * @since 2.0.0
 */

export const INJECTABLES = new Map<ConstructorType, InjectableOptionsInterface>();

/**
 * Type guard to check if a provider uses a class.
 *
 * @param provider - The provider to check.
 * @returns True if the provider is a {@link ProviderUseClassInterface}.
 *
 * @see ProviderUseClassInterface
 * @since 2.0.0
 */

export function isProviderUseClass(provider: unknown): provider is ProviderUseClassInterface {
    return typeof provider === 'object' && provider !== null && 'useClass' in provider;
}

/**
 * Type guard to check if a provider uses a factory function.
 *
 * @param provider - The provider to check.
 * @returns True if the provider is a {@link ProviderUseFactoryInterface}.
 *
 * @see ProviderUseFactoryInterface
 * @since 2.0.0
 */

export function isProviderUseFactory(provider: unknown): provider is ProviderUseFactoryInterface {
    return typeof provider === 'object' && provider !== null && 'useFactory' in provider;
}

/**
 * Type guard to check if a provider uses a value.
 *
 * @param provider - The provider to check.
 * @returns True if the provider is a {@link ProviderUseValueInterface}.
 *
 * @see ProviderUseValueInterface
 * @since 2.0.0
 */

export function isProviderUseValue(provider: unknown): provider is ProviderUseValueInterface {
    return typeof provider === 'object' && provider !== null && 'useValue' in provider;
}

/**
 * Marks a class as injectable, optionally providing metadata.
 *
 * @param options - Optional configuration for the injectable class.
 *
 * @remarks
 * The `@Injectable` decorator allows classes to be automatically instantiated
 * and injected with dependencies using the `inject` function.
 *
 * @example
 * ```ts
 * @Injectable({ scope: 'singleton' })
 * class MyService {}
 *
 * const instance = inject(MyService);
 * ```
 *
 * ```ts
 * @Injectable()
 * class Database {
 * }
 *
 * @Injectable({
 *     providers: [ Database ]
 * })
 * class UserService {
 *     constructor(private db: Database) {
 *         console.log(db); // db instance
 *     }
 * }
 *
 * const userService = inject(UserService);
 * ```
 *
 * ```ts
 * @Injectable()
 * class Cache {}
 *
 * @Injectable({
 *     providers: [{ useClass: Cache }]
 * })
 * class UserService {
 *     constructor(cache: Cache) {
 *         console.log(cache); // cache instance
 *     }
 * }
 *
 * const userService = inject(UserService);
 * ```
 *
 * ```ts
 * @Injectable({
 *     providers: [
 *         {
 *             useFactory(): Date {
 *                 return new Date();
 *             }
 *         }
 *     ]
 * })
 * class ClockService {
 *     constructor(now: Date) {
 *         console.log(now.toLocaleTimeString()); // get time from the factory
 *     }
 * }
 *
 * const clockService = inject(ClockService);
 * ```
 *
 * ```ts
 * @Injectable({
 *     providers: [
 *         {
 *             useValue: 'https://api.example.com'
 *         }
 *     ]
 * })
 * class ApiService {
 *     constructor(baseUrl: string) {
 *         console.log(baseUrl);
 *     }
 * }
 *
 *
 * const apiService = inject(ApiService); // log https://api.example.com
 * const apiService2 = inject(ApiService, 'https://api2.example.com'); // log https://api2.example.com
 * ```
 *
 * ```ts
 * @Injectable()
 * class Logger {
 * }
 *
 * @Injectable({
 *     providers: [
 *         Logger,
 *         { useValue: 10 },
 *         { useFactory: (): string => 'prod' }
 *     ]
 * })
 * class AppService {
 *     constructor(
 *         logger: Logger,
 *         retries: number,
 *         env: string
 *     ) {
 *         console.log(logger, retries, env);
 *     }
 * }
 *
 * const appService = inject(AppService); // log Logger {} 10 prod
 * const appService2 = inject(AppService, inject(Logger), 50, 'test'); // log Logger {} 50 test
 * ```
 *
 * @see InjectableOptionsInterface
 * @since 2.0.0
 */

export function Injectable<T extends ConstructorType = ConstructorType>(options?: InjectableOptionsInterface<T>) {
    return function (target: T): void {
        INJECTABLES.set(target, <InjectableOptionsInterface>options || {});
    };
}

/**
 * Converts an array of providers into constructor arguments for injection.
 *
 * @param providers - An optional array of providers to resolve.
 * @param args - Optional initial arguments to prepend before resolving providers.
 * @returns An array of resolved arguments including the results from providers.
 *
 * @remarks
 * This function iterates over the provided `ProvidersType` array and converts each provider
 * into its resolved value. It supports class providers, factory providers, value providers,
 * and direct constructor functions. The returned array can be used to construct instances
 * with dependencies injected in the correct order.
 *
 * @example
 * ```ts
 * const args = providersIntoArgs([{ useValue: 42 }, { useFactory: () => 'hello' }]);
 * // args = [42, 'hello']
 * ```
 *
 * @see isProviderUseClass
 * @see isProviderUseValue
 * @see isProviderUseFactory
 *
 * @since 2.0.0
 */

export function providersIntoArgs(providers?: ProvidersType, args: Array<unknown> = []): Array<unknown> {
    if (!providers) return args;

    const scopeAgs: Array<unknown> = args;
    for (const provider of providers.slice(scopeAgs.length)) {
        if (isProviderUseClass(provider)) {
            scopeAgs.push(inject(provider.useClass, ...providersIntoArgs(provider.providers)));
        } else if (isProviderUseFactory(provider)) {
            scopeAgs.push(provider.useFactory(...providersIntoArgs(provider.providers)));
        } else if (isProviderUseValue(provider)) {
            scopeAgs.push(provider.useValue);
        } else if (typeof provider === 'function') {
            scopeAgs.push(inject(provider));
        } else {
            throw new Error(`Unknown provider type: ${ typeof provider }`);
        }
    }

    return scopeAgs;
}

/**
 * Resolves and instantiates a class with its dependencies.
 *
 * @param token - The constructor function or class to instantiate.
 * @param args - Optional arguments to pass to the constructor, which can override
 *               or supplement provider-resolved values.
 * @returns An instance of the class with all dependencies injected.
 *
 * @remarks
 * The `inject` function looks up metadata for the class marked with `@Injectable`.
 * It resolves all providers recursively using `providersIntoArgs`. If the class is
 * marked as a `singleton`, the same instance will be returned on further calls.
 *
 * @example
 * ```ts
 * @Injectable({ scope: 'singleton' })
 * class MyService {}
 *
 * const instance = inject(MyService);
 * ```
 *
 * @see Injectable
 * @see providersIntoArgs
 *
 * @since 2.0.0
 */

export function inject<T, Args extends Array<unknown>>(token: ConstructorLikeType<T, Args>, ...args: Partial<Args>): T {
    if (SINGLETONS.has(token)) return <T>SINGLETONS.get(token);

    const metadata = INJECTABLES.get(token);
    if (!metadata) throw new Error(`Cannot inject ${ token.name } – not marked @Injectable`);

    const scopeAgs = providersIntoArgs(metadata.providers, args);
    const instance: T = metadata.factory
        ? <T>metadata.factory(...scopeAgs)
        : new token(...scopeAgs as Args);

    if (metadata?.scope === 'singleton') {
        SINGLETONS.set(token, instance);
    }

    return instance;
}

/**
 * Forces the instantiation of a class bypassing any existing singleton instance.
 *
 * @param token - The constructor function or class to instantiate.
 * @param args - Optional arguments to pass to the constructor, which can override
 *               or supplement provider-resolved values.
 * @returns A new instance of the class, even if a singleton instance already exists.
 *
 * @remarks
 * Unlike the `inject` function, `forceInject` will delete any existing singleton
 * instance for the given class before creating a new one. This is useful when you
 * need a fresh instance regardless of the singleton scope.
 *
 * @example
 * ```ts
 * @Injectable({ scope: 'singleton' })
 * class MyService {}
 *
 * const freshInstance = forceInject(MyService);
 * ```
 *
 * @see inject
 * @since 2.0.0
 */

export function forceInject<T, Args extends Array<unknown>>(token: ConstructorLikeType<T, Args>, ...args: Partial<Args>): T {
    if (SINGLETONS.has(token)) SINGLETONS.delete(token);

    return inject<T, Args>(token, ...args);
}
