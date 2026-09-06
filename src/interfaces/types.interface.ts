/**
 * A copy of a type with every property optional, all the way down.
 *
 * @remarks
 * Recurses into object properties rather than stopping at the top level,
 * which is what lets a patch name one deeply nested setting and leave its siblings standing.
 * It is the shape a partial update takes, not the shape anything is stored in.
 *
 * @example
 * ```ts
 * type Config = { common: { esbuild: { minify: boolean, outdir: string } } };
 *
 * const patch: DeepPartialType<Config> = { common: { esbuild: { minify: false } } };
 * ```
 *
 * @since 2.0.0
 */

export type DeepPartialType<T> = {
    [K in keyof T]?: T[K] extends object
        ? DeepPartialType<T[K]> : T[K];
};

/**
 * Any value that is not an object.
 *
 * @remarks
 * The whole set of primitives, `null` and `undefined` among them,
 * so a value of this type compares with `===` and carries nothing worth walking.
 *
 * @example
 * ```ts
 * const port: PrimitiveType = 8080;
 * const absent: PrimitiveType = null;
 * ```
 *
 * @see PrimitiveOrObjectType
 * @since 3.0.0
 */

export type PrimitiveType = string | number | boolean | bigint | symbol | null | undefined;

/**
 * A function that supplies a value when the build runs rather than when it is configured.
 *
 * @remarks
 * Receives the name it is producing a value for and the arguments the build was given,
 * so a setting can follow a flag without the configuration file reading the command line itself.
 * The result is primitive, since what it produces is substituted into the source as a literal.
 *
 * @example
 * ```ts
 * const release: RuntimeHandlerType = (name, args) => args.production === true;
 * ```
 *
 * @see PrimitiveType
 * @since 3.0.0
 */

export type RuntimeHandlerType = (name: string, args: Record<string, unknown>) => PrimitiveType;

/**
 * A primitive, or a plain object keyed by name or symbol.
 *
 * @remarks
 * Widens {@link PrimitiveType} to cover a value that is substituted whole rather than as a single literal.
 *
 * @example
 * ```ts
 * const flag: PrimitiveOrObjectType = true;
 * const table: PrimitiveOrObjectType = { region: 'eu', retries: 3 };
 * ```
 *
 * @see PrimitiveType
 * @since 3.0.0
 */

export type PrimitiveOrObjectType = PrimitiveType | Record<string | symbol, unknown>;

/**
 * What a hook returns when answering is optional.
 *
 * @typeParam T - The value a hook returns when it has one
 *
 * @remarks
 * Accepts the value itself, `void`, or a promise of either,
 * so a hook can be written synchronously or asynchronously and can decline to answer either way.
 * `null` belongs to the union only where `T` names it, which is what the default `T = null` does,
 * so the bare form describes a hook that never has an answer to give.
 *
 * @example
 * ```ts
 * const onStart: () => MaybeVoidPromiseType<OnStartResult> = () => undefined;
 * const onStartAsync: () => MaybeVoidPromiseType<OnStartResult> = async () => ({ warnings: [] });
 * const setup: () => MaybeVoidPromiseType = () => null;
 * ```
 *
 * @see MaybeUndefinedPromiseType
 * @since 3.0.0
 */

export type MaybeVoidPromiseType<T = null> = void | T | Promise<void | T>;

/**
 * The same as {@link MaybeVoidPromiseType}, for a hook whose empty answer is `undefined`.
 *
 * @remarks
 * Used where esbuild reads the absence of a result as "carry on with the default",
 * which its load and resolve callbacks spell as `undefined` rather than as `void`.
 *
 * @example
 * ```ts
 * const onLoad: () => MaybeUndefinedPromiseType<OnLoadResult> = () => undefined;
 * ```
 *
 * @see MaybeVoidPromiseType
 * @since 2.0.0
 */

export type MaybeUndefinedPromiseType<T> = undefined | null | T | Promise<undefined | null | T>;

