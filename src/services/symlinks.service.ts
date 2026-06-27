/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ConstructorType, ConstructorLikeType } from '@interfaces/types.interface';
import type { ProviderUseClassInterface } from './interfaces/symlinks-service.interface';
import type { ProviderUseFactoryInterface, ProviderUseValueInterface } from './interfaces/symlinks-service.interface';
import type { ProviderType, InjectableOptionsInterface, ProvidersType } from './interfaces/symlinks-service.interface';

/**
 * Imports
 */

import { hasProviderKey } from '@components/object.component';

/**
 * Cache of singleton instances, keyed by class.
 *
 * @remarks
 * Populated lazily: `inject` adds a class here the first time it resolves it under `singleton` scope,
 * then returns the same instance on later calls.
 *
 * @see ConstructorType
 * @since 2.0.0
 */

export const SINGLETONS = new Map<ConstructorType, unknown>();

/**
 * Registry of `@Injectable` metadata, keyed by class.
 *
 * @remarks
 * Written by the `@Injectable` decorator and read by `inject` to resolve and construct a class.
 *
 * @see Injectable
 * @since 2.0.0
 */

export const INJECTABLES = new Map<ConstructorType, InjectableOptionsInterface>();

/**
 * Type guard that checks whether a provider uses a class.
 *
 * @param provider - The provider to check.
 * @returns `true` if the provider is a {@link ProviderUseClassInterface}.
 *
 * @see ProviderUseClassInterface
 * @since 2.0.0
 */

export function isProviderUseClass(provider: unknown): provider is ProviderUseClassInterface {
    return hasProviderKey(provider, 'useClass');
}

/**
 * Type guard that checks whether a provider uses a factory function.
 *
 * @param provider - The provider to check.
 * @returns `true` if the provider is a {@link ProviderUseFactoryInterface}.
 *
 * @see ProviderUseFactoryInterface
 * @since 2.0.0
 */

export function isProviderUseFactory(provider: unknown): provider is ProviderUseFactoryInterface {
    return hasProviderKey(provider, 'useFactory');
}

/**
 * Type guard that checks whether a provider uses a value.
 *
 * @param provider - The provider to check.
 * @returns `true` if the provider is a {@link ProviderUseValueInterface}.
 *
 * @see ProviderUseValueInterface
 * @since 2.0.0
 */

export function isProviderUseValue(provider: unknown): provider is ProviderUseValueInterface {
    return hasProviderKey(provider, 'useValue');
}

/**
 * Class decorator that registers a class for resolution by `inject`.
 *
 * @param options - Scope, factory, and provider metadata for the class.
 *
 * @remarks
 * Records `options` against the class in `INJECTABLES` so `inject` can construct it and supply its dependencies.
 * Apply it to any class resolved through `inject` or `forceInject`; without it, `inject` throws.
 *
 * @example <caption>Plain injectable</caption>
 * ```ts
 * @Injectable()
 * class OrderService {}
 *
 * const service = inject(OrderService);
 * ```
 *
 * @example <caption>With scope and dependencies</caption>
 * ```ts
 * @Injectable({ scope: 'singleton', providers: [ Database ] })
 * class UserService {
 *     constructor(private db: Database) {}
 * }
 * ```
 *
 * @see inject
 * @see InjectableOptionsInterface
 *
 * @since 2.0.0
 */

export function Injectable<T extends ConstructorType = ConstructorType>(options?: InjectableOptionsInterface<T>) {
    return (target: T): void => {
        INJECTABLES.set(target, (options ?? {}) as InjectableOptionsInterface);
    };
}

/**
 * Converts an array of providers into constructor arguments for injection.
 *
 * @param providers - An optional array of providers to resolve.
 * @param args - Optional initial arguments prepended before the resolved providers.
 * @returns An array of resolved arguments, including the results from the providers.
 *
 * @remarks
 * Each provider is resolved to a value in declaration order, recursing into nested `providers`.
 * Any leading `args` are kept as-is, and only the providers beyond them are resolved.
 *
 * @example
 * ```ts
 * const args = providersIntoArgs([{ useValue: 42 }, { useFactory: () => 'hello' }]);
 * // args = [ 42, 'hello' ]
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
    const resolved: Array<unknown> = [ ...args ];
    for (const provider of providers.slice(resolved.length)) {
        resolved.push(resolveProvider(provider));
    }

    return resolved;
}

/**
 * Resolves a single provider entry to its injected value.
 *
 * @param provider - The provider to resolve.
 * @returns The constructed instance, factory result, or literal value.
 *
 * @throws Error - When the provider does not match any supported shape.
 *
 * @remarks
 * The plain-constructor case is checked first since it is the most common provider form.
 *
 * @see providersIntoArgs
 * @since 2.6.0
 */

function resolveProvider(provider: ProviderType): unknown {
    if (typeof provider === 'function') return inject(provider);
    if (isProviderUseClass(provider)) return inject(provider.useClass, ...providersIntoArgs(provider.providers));
    if (isProviderUseFactory(provider)) return provider.useFactory(...providersIntoArgs(provider.providers));
    if (isProviderUseValue(provider)) return provider.useValue;

    throw new Error(`Unknown provider type: ${ typeof provider }`);
}

/**
 * Resolves and instantiates a class with its dependencies.
 *
 * @param token - The constructor function or class to instantiate.
 * @param args - Optional arguments passed to the constructor,
 *               which can override or supplement provider-resolved values.
 * @returns An instance of the class with all dependencies injected.
 *
 * @remarks
 * Resolves the class's `providers` through `providersIntoArgs`, then constructs it (or calls its `factory`).
 * Under the `singleton` scope the instance is cached and returned on later calls.
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

    const resolvedArgs = providersIntoArgs(metadata.providers, args);
    const instance: T = metadata.factory
        ? <T>metadata.factory(...resolvedArgs)
        : new token(...resolvedArgs as Args);

    if (metadata.scope === 'singleton') {
        SINGLETONS.set(token, instance);
    }

    return instance;
}

/**
 * Forces instantiation of a class, bypassing any existing singleton instance.
 *
 * @param token - The constructor function or class to instantiate.
 * @param args - Optional arguments passed to the constructor,
 *               which can override or supplement provider-resolved values.
 * @returns A new instance of the class, even if a singleton instance already exists.
 *
 * @remarks
 * Drops any cached singleton for the class, then delegates to `inject`, so a fresh instance is always built.
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
