/**
 * Import will remove at compile time
 */

import type { ConstructorType, FunctionLikeType, FunctionType } from '@interfaces/function.interface';

/**
 * Represents a provider that uses a factory function to generate a value.
 *
 * @remarks
 * A factory provider can also declare dependencies through `providers`, which
 * will be resolved and passed to the factory function.
 *
 * @example
 * ```ts
 * const factoryProvider: ProviderUseFactoryInterface = {
 *   useFactory: (dep: MyService) => new AnotherService(dep),
 *   providers: [MyService]
 * };
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseFactoryInterface {
    useFactory: FunctionType;
    providers?: ProvidersType,
}

/**
 * Represents a provider that uses a class constructor to generate a value.
 *
 * @remarks
 * Class providers can also declare dependencies through `providers`, which
 * will be injected when the class is instantiated.
 *
 * @example
 * ```ts
 * const classProvider: ProviderUseClassInterface = {
 *   useClass: MyService,
 *   providers: [DependencyService]
 * };
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseClassInterface {
    useClass: ConstructorType;
    providers?: ProvidersType,
}

/**
 * Represents a provider that uses a static value.
 *
 * @remarks
 * Value providers do not have dependencies and are injected as-is.
 *
 * @example
 * ```ts
 * const valueProvider: ProviderUseValueInterface = {
 *   useValue: 42
 * };
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseValueInterface {
    useValue: unknown;
}


/**
 * Type for all possible providers that can be injected.
 *
 * @remarks
 * Providers can be:
 * - A class constructor (`ConstructorType`)
 * - A factory provider (`ProviderUseFactoryInterface`)
 * - A class provider (`ProviderUseClassInterface`)
 * - A value provider (`ProviderUseValueInterface`)
 *
 * @example
 * ```ts
 * const providers: ProvidersType = [
 *   MyService,
 *   { useFactory: () => new AnotherService() },
 *   { useValue: 42 }
 * ];
 * ```
 *
 * @see ProviderUseClassInterface
 * @see ProviderUseValueInterface
 * @see ProviderUseFactoryInterface
 *
 * @since 2.0.0
 */

export type ProvidersType = Array<
    ConstructorType | ProviderUseFactoryInterface | ProviderUseClassInterface | ProviderUseValueInterface
>;

/**
 * Options for configuring an injectable class.
 *
 * @remarks
 * - `scope`: Determines whether the class should behave as a singleton or transient.
 * - `factory`: Optional factory function to instantiate the class.
 * - `providers`: Optional dependencies to inject when creating the instance.
 *
 * @example
 * ```ts
 * @Injectable({ scope: 'singleton', providers: [DepService] })
 * class MyService {}
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface InjectableOptionsInterface<T extends ConstructorType = ConstructorType> {
    scope?: 'singleton' | 'transient';
    factory?: FunctionLikeType<InstanceType<T>, ConstructorParameters<T>>;
    providers?: ProvidersType
}
