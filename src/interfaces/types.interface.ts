/**
 * Flattens an intersection or mapped type into a single, plain object type.
 *
 * @template T - Type to flatten.
 *
 * @remarks
 * Re-maps every key of `T` onto a fresh object and intersects with `unknown` (a no-op for
 * assignability). The result is structurally identical to `T` but is displayed by the
 * compiler and editor tooltips as one resolved object rather than a chain of intersections,
 * which makes inferred types far easier to read.
 *
 * @example
 * ```ts
 * type Messy = { a: number } & { b: string };
 * type Clean = PrettifyType<Messy>; // { a: number; b: string }
 * ```
 *
 * @since 2.6.0
 */

export type PrettifyType<T> = { [K in keyof T]: T[K]; } & unknown;

/**
 * Unwraps a possibly promised type, then flattens it with {@link PrettifyType}.
 *
 * @template T - Type to await and flatten.
 *
 * @remarks
 * Applies `Awaited<T>` to resolve any `Promise` (or thenable) wrappers, then runs the result
 * through {@link PrettifyType}. Useful for presenting the resolved value of an async signature
 * as a clean object type.
 *
 * @example
 * ```ts
 * type Resolved = AwaitedPrettifyType<Promise<{ a: number } & { b: string }>>;
 * // { a: number; b: string }
 * ```
 *
 * @see PrettifyType
 * @since 2.6.0
 */

export type AwaitedPrettifyType<T> = PrettifyType<Awaited<T>>;

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
 * @since 2.6.0
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
 * @since 2.6.0
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
 * @since 2.6.0
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
 * @since 2.6.0
 */

export type ConstructorLikeType<Return = unknown, Args extends Array<unknown> = []> =
    new(...args: Args) => Return;
