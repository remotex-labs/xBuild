/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { FunctionLikeType, ConstructorType, FunctionType } from '@interfaces/types.interface';

/**
 * Provider that produces its value by calling a factory function.
 *
 * @remarks
 * Use this when the value needs creation logic rather than a plain `new`.
 * The factory runs and its return value becomes the provided value.
 * Declared `providers` are resolved and passed to it as arguments, in order.
 *
 * @example
 * ```ts
 * {
 *   useFactory: (logger, config) => new EmailService(logger, config),
 *   providers: [ LoggerService, AppConfig ]
 * }
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseFactoryInterface {
    /**
     * The factory function called to produce the provided value.
     *
     * @remarks
     * Receives resolved dependencies as arguments.
     *
     * @since 2.0.0
     */

    useFactory: FunctionType;

    /**
     * Optional local dependencies resolved and passed to the factory.
     *
     * @since 2.0.0
     */

    providers?: ProvidersType;
}

/**
 * Provider that resolves a token by instantiating a different class.
 *
 * @remarks
 * Use this to swap or redirect an implementation - the token resolves to `useClass` instead of itself.
 * The class receives dependencies from its `providers`, or from the global container when none are declared.
 *
 * @example
 * ```ts
 * {
 *   useClass: FileLogger,
 *   providers: [ FileTransport, LogFormatter ]
 * }
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseClassInterface {
    /**
     * The class constructor used to create the instance.
     *
     * @since 2.0.0
     */

    useClass: ConstructorType;

    /**
     * Optional local dependencies injected into the class constructor.
     *
     * @since 2.0.0
     */

    providers?: ProvidersType;
}

/**
 * Provider that supplies a fixed, pre-built value.
 *
 * @remarks
 * Use this for a value that already exists - a config object, constant, or ready-made instance.
 * It is provided as-is, with no instantiation or dependency resolution.
 *
 * @example
 * ```ts
 * { useValue: { apiKey: 'sk-xxx', baseUrl: 'https://api.example.com' } }
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface ProviderUseValueInterface {
    /**
     * The literal value provided when this token is resolved.
     *
     * @since 2.0.0
     */

    useValue: unknown;
}

/**
 * A single provider entry: a plain class constructor, or one of the `useClass`,
 * `useFactory`, or `useValue` forms.
 *
 * @remarks
 * The element type of {@link ProvidersType}. Useful for typing helpers that resolve one provider.
 *
 * @see ProviderUseClassInterface
 * @see ProviderUseValueInterface
 * @see ProviderUseFactoryInterface
 *
 * @since 2.6.0
 */

export type ProviderType =
    ConstructorType | ProviderUseFactoryInterface | ProviderUseClassInterface | ProviderUseValueInterface;

/**
 * An ordered list of providers accepted in an `@Injectable` `providers` array.
 *
 * @remarks
 * Each entry is a {@link ProviderType}, resolved in declaration order.
 *
 * @example
 * ```ts
 * const providers: ProvidersType = [
 *   UserService,
 *   { useClass: AdminUserService, providers: [ AdminGuard ] },
 *   { useFactory: createCacheClient, providers: [ RedisConfig ] },
 *   { useValue: 'development' as const }
 * ];
 * ```
 *
 * @see ProviderType
 * @since 2.0.0
 */

export type ProvidersType = Array<ProviderType>;

/**
 * Configuration for the `@Injectable` decorator.
 *
 * @remarks
 * Controls how an injectable class is created and how long its instance lives.
 *
 * @example <caption>Standard singleton</caption>
 * ```ts
 * @Injectable()
 * class OrderService {}
 * ```
 *
 * @example <caption>Transient with local providers</caption>
 * ```ts
 * @Injectable({
 *   scope: 'transient',
 *   providers: [ InMemoryCartRepository ]
 * })
 * class CartUseCase {}
 * ```
 *
 * @example <caption>Custom factory</caption>
 * ```ts
 * @Injectable({
 *   factory: (logger, metrics) => new MonitoredService(logger, metrics),
 *   providers: [ LoggerService, MetricsService ]
 * })
 * class PaymentGateway {}
 * ```
 *
 * @see ProvidersType
 * @since 2.0.0
 */

export interface InjectableOptionsInterface<T extends ConstructorType = ConstructorType> {
    /**
     * Defines the instance lifetime.
     *
     * @remarks
     * - `singleton`: one shared instance for the entire container
     * - `transient`: a new instance created on every resolution
     *
     * @defaultValue 'transient'
     * @since 2.0.0
     */

    scope?: 'singleton' | 'transient';

    /**
     * Custom factory that replaces default constructor-based instantiation.
     *
     * @remarks
     * Receives resolved dependencies in the declared order.
     *
     * @since 2.0.0
     */

    factory?: FunctionLikeType<InstanceType<T>, ConstructorParameters<T>>;

    /**
     * Dependencies available only during resolution of this specific class.
     *
     * @since 2.0.0
     */

    providers?: ProvidersType;
}
