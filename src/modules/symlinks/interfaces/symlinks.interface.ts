/**
 * A generic type representing a function with any arguments and any return type.
 *
 * @remarks
 * This type is a very flexible function type, allowing any arguments of any type
 * and returning any type. Use with caution, as it bypasses TypeScript's type safety.
 *
 * @example
 * ```ts
 * const exampleFn: FunctionType = (a, b, c) => a + b + c;
 *
 * const anotherFn: FunctionType = (...args) => args.length;
 * ```
 *
 * @since 2.0.0
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionType = (...args: Array<any>) => any;

/**
 * Represents a generic constructor type.
 *
 * @remarks
 * This utility type describes a class constructor that accepts any number of arguments
 * and returns any instance type. Useful for mixins or generic factory functions.
 *
 * @example
 * ```ts
 * function WithTimestamp<TBase extends ConstructorType>(Base: TBase) {
 *   return class extends Base {
 *     timestamp = Date.now();
 *   };
 * }
 * ```
 *
 * @since 2.0.0
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConstructorType = new (...args: Array<any>) => any;

/**
 * A type representing a function with a specific return type, arguments, and optional context.
 *
 * @typeParam Return - The type returned by the function. Defaults to `unknown`.
 * @typeParam Args - A tuple of argument types for the function. Defaults to an empty array `[]`.
 * @typeParam Context - The type of `this` context for the function. Defaults to `unknown`.
 *
 * @remarks
 * This type allows you to strongly type functions with a specific `this` context and arguments.
 *
 * @example
 * ```ts
 * const fn: FunctionLikeType<number, [string, string], { prefix: string }> = function(this, a, b) {
 *   return (this.prefix + a + b).length;
 * }
 * ```
 *
 * @since 2.0.0
 */

export type FunctionLikeType<Return = unknown, Args extends Array<unknown> = [], Context = unknown> =
    (this: Context, ...args: Args) => Return;

/**
 * A type representing a constructor with specific arguments and return type.
 *
 * @typeParam Return - The instance type returned by the constructor. Defaults to `unknown`.
 * @typeParam Args - A tuple of argument types for the constructor. Defaults to an empty array `[]`.
 *
 * @remarks
 * This type allows strong typing of class constructors with defined argument types.
 *
 * @example
 * ```ts
 * class MyClass {
 *   constructor(public name: string) {}
 * }
 *
 * const ctor: ConstructorLikeType<MyClass, [string]> = MyClass;
 * const instance = new ctor("Hello");
 * ```
 *
 * @since 2.0.0
 */

export type ConstructorLikeType<Return = unknown, Args extends Array<unknown> = []> =
    new(...args: Args) => Return;

/**
 * Creates instances using a custom factory function.
 *
 * @remarks
 * The factory receives resolved dependencies as arguments in the order
 * declared in the `providers` array.
 *
 * This provider type offers the most flexibility for:
 * - conditional instantiation logic
 * - configuration-dependent creation
 * - wrapping third-party libraries
 * - computed or cached values
 *
 * @example
 * ```ts
 * {
 *   useFactory: (logger, config) => new EmailService(logger, config),
 *   providers: [LoggerService, AppConfig]
 * }
 * ```
 *
 * @see {@link ProvidersType}
 * @since 2.0.0
 */

export interface ProviderUseFactoryInterface {
    /**
     * The factory function called to produce the provided value.
     *
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
 * Delegates instantiation to a different class constructor.
 *
 * @remarks
 * The target class receives dependencies resolved from the `providers` array
 * (or from the global container if none are declared locally).
 *
 * Most common use cases:
 * - swapping implementations (real vs mock)
 * - providing concrete classes for abstract/interface tokens
 * - overriding default behaviors in modules
 *
 * @example
 * ```ts
 * {
 *   useClass: FileLogger,
 *   providers: [FileTransport, LogFormatter]
 * }
 * ```
 *
 * @see {@link ProvidersType}
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
 * Supplies a static, pre-defined value.
 *
 * @remarks
 * The value is returned exactly as provided — no instantiation
 * or dependency resolution is performed.
 *
 * Typical uses include:
 * - configuration objects
 * - constants / enums
 * - already-created instances
 * - mock objects for testing
 *
 * @example
 * ```ts
 * { useValue: { apiKey: 'sk-xxx', baseUrl: 'https://api.example.com' } }
 * ```
 *
 * @see {@link ProvidersType}
 * @since 2.0.0
 */

export interface ProviderUseValueInterface {
    /**
     * The literal value that will be provided when this token is resolved.
     *
     * @since 2.0.0
     */
    useValue: unknown;
}

/**
 * Union of all supported provider shapes that can be registered.
 *
 * @remarks
 * A provider can be provided in one of four forms (listed by frequency):
 * - plain class constructor (most common)
 * - factory provider (most flexible)
 * - class redirect (`useClass`)
 * - static value (`useValue`)
 *
 * @example
 * ```ts
 * const providers: ProvidersType = [
 *   UserService,
 *   { useClass: AdminUserService, providers: [AdminGuard] },
 *   { useFactory: createCacheClient, providers: [RedisConfig] },
 *   { useValue: 'development' as const }
 * ];
 * ```
 *
 * @see {@link ProviderUseClassInterface}
 * @see {@link ProviderUseValueInterface}
 * @see {@link ProviderUseFactoryInterface}
 *
 * @since 2.0.0
 */

export type ProvidersType = Array<
    ConstructorType | ProviderUseFactoryInterface | ProviderUseClassInterface | ProviderUseValueInterface
>;

/**
 * Configuration options for the `@Injectable` decorator.
 *
 * @remarks
 * Controls lifetime and creation behavior of injectable classes:
 * - `scope` — singleton vs transient lifetime
 * - `factory` — custom creation logic instead of `new`
 * - `providers` — local dependency overrides visible only to this class
 *
 * @example Standard singleton
 * ```ts
 * @Injectable()
 * class OrderService {}
 * ```
 *
 * @example Transient with local providers
 * ```ts
 * @Injectable({
 *   scope: 'transient',
 *   providers: [InMemoryCartRepository]
 * })
 * class CartUseCase {}
 * ```
 *
 * @example Custom factory
 * ```ts
 * @Injectable({
 *   factory: (logger, metrics) => new MonitoredService(logger, metrics),
 *   providers: [LoggerService, MetricsService]
 * })
 * class PaymentGateway {}
 * ```
 *
 * @see {@link ProvidersType}
 * @since 2.0.0
 */

export interface InjectableOptionsInterface<T extends ConstructorType = ConstructorType> {
    /**
     * Defines instance lifetime.
     * - `singleton`: one shared instance for the entire container
     * - `transient`: new instance created on every resolution
     *
     * @defaultValue 'singleton' (in most implementations)
     *
     * @since 2.0.0
     */

    scope?: 'singleton' | 'transient';

    /**
     * Custom factory that replaces default constructor-based instantiation.
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
