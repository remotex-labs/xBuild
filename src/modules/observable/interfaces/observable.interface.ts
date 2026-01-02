/**
 * Import will remove at compile time
 */

import type { ObservableService } from '@observable/services/observable.service';

/**
 * Callback function invoked when a new value is emitted.
 *
 * @template T - The type of value being emitted.
 *
 * @param value - The emitted value.
 *
 * @remarks
 * This callback is called by observers when a new value is emitted via the observable.
 * It is the primary mechanism for receiving data from an observable stream.
 *
 * @since 2.0.0
 */

export type NextType<T> = (value: T) => void;

/**
 * Callback function invoked when an error occurs.
 *
 * @param err - The error that occurred. Can be any type of error.
 *
 * @remarks
 * This callback is called by observers when an error is emitted or when a handler throws
 * an exception. It allows consumers to handle error conditions gracefully.
 *
 * @since 2.0.0
 */

export type ErrorType = (err: unknown) => void;

/**
 * Callback function invoked when the observable completes.
 *
 * @remarks
 * This callback is called by observers when the observable signals that no more values
 * will be emitted. It indicates the successful completion of the observable stream.
 *
 * @since 2.0.0
 */

export type CompleteType = () => void;

/**
 * Function to unsubscribe from an observable subscription.
 *
 * @remarks
 * Returned from the {@link ObservableService.subscribe} method. Calling this function
 * removes the observer and stops receiving further emissions. It also triggers any cleanup
 * logic associated with the subscription.
 *
 * @since 2.0.0
 */

export type UnsubscribeType = () => void;

/**
 * Represents an observer that receives notifications from an observable.
 *
 * @template T - The type of values emitted to the observer.
 *
 * @remarks
 * An observer is an object with optional handlers for different observable events:
 * - `next`: Called when a new value is emitted
 * - `error`: Called when an error occurs
 * - `complete`: Called when the observable completes
 *
 * All handlers are optional. If a handler is not provided, that event will be ignored
 * for this observer. This allows flexible subscription patterns where consumers only
 * care about specific events.
 *
 * @example
 * ```ts
 * const observer: ObserverInterface<number> = {
 *   next: (value) => console.log('Value:', value),
 *   error: (err) => console.error('Error:', err),
 *   complete: () => console.log('Stream completed')
 * };
 *
 * observable.subscribe(observer);
 * ```
 *
 * @see NextType
 * @see ErrorType
 * @see CompleteType
 *
 * @since 2.0.0
 */

export interface ObserverInterface<T> {
    /**
     * Handler called when a value is emitted.
     *
     * @remarks
     * Optional callback is invoked when the observable emits a new value. If not provided,
     * this observer silently ignores value emissions.
     *
     * @since 2.0.0
     */

    next?: NextType<T>;

    /**
     * Handler called when an error occurs.
     *
     * @remarks
     * Optional callback is invoked when the observable emits an error or when a handler
     * throws an exception. If not provided, errors are silently ignored by this observer.
     *
     * @since 2.0.0
     */

    error?: ErrorType;

    /**
     * Handler called when the observable completes.
     *
     * @remarks
     * Optional callback is invoked when the observable signals' completion. If not provided,
     * this observer silently ignores completion events.
     *
     * @since 2.0.0
     */

    complete?: CompleteType;
}

/**
 * Represents a function that transforms a single input into an output.
 *
 * @template T - The input type to be transformed.
 * @template R - The output type after transformation.
 *
 * @param source - The input value to transform.
 * @returns The transformed output value.
 *
 * @remarks
 * A unary function is a function that takes exactly one argument and returns a single result.
 * This interface provides a type-safe way to represent transformation functions that are commonly
 * used in functional programming patterns, such as:
 *
 * - **Mapping**: Converting values from one type to another
 * - **Filtering**: Selecting or rejecting values based on conditions
 * - **Composition**: Creating pipelines of transformations
 * - **Higher-order functions**: Functions that return functions
 *
 * Unary functions are the foundation of many functional programming utilities and are particularly
 * useful in observable operators, array methods, and functional composition libraries.
 *
 * @example
 * ```ts
 * // Simple transformation
 * const double: UnaryFunctionInterface<number, number> = (x) => x * 2;
 * console.log(double(5)); // Output: 10
 *
 * // Type conversion
 * const stringify: UnaryFunctionInterface<number, string> = (x) => String(x);
 * console.log(stringify(42)); // Output: "42"
 *
 * // Object transformation
 * const getAge: UnaryFunctionInterface<{ name: string; age: number }, number> = (person) => person.age;
 * console.log(getAge({ name: 'Alice', age: 30 })); // Output: 30
 *
 * // Function composition
 * const compose = <T, U, R>(f: UnaryFunctionInterface<T, U>, g: UnaryFunctionInterface<U, R>) => {
 *   return (x: T): R => g(f(x));
 * };
 *
 * const addOne = (x: number) => x + 1;
 * const double = (x: number) => x * 2;
 * const addOneThenDouble = compose(addOne, double);
 * console.log(addOneThenDouble(5)); // Output: 12
 * ```
 *
 * @since 2.0.0
 */

export interface UnaryFunctionInterface<T, R> {
    (source: T): R;
}

/**
 * Function that transforms an observable by operating on its values.
 *
 * @template T - The input value type from the source observable. Defaults to `any`.
 * @template R - The output value type of the transformed observable. Defaults to `any`.
 *
 * @param source - The source observable to transform.
 * @returns A new observable with transformed values.
 *
 * @remarks
 * An operator function is a unary function that takes a source observable and returns a new
 * observable with modified behavior. Operators can be chained together using {@link ObservableService.pipe}
 * to create complex transformation pipelines.
 *
 * Common operator patterns:
 * - **Mapping**: Transform each emitted value using a function
 * - **Filtering**: Only emit values that match a condition
 * - **Debouncing**: Delay emission after a period of inactivity
 * - **Distinction**: Skip consecutive duplicate values
 * - **Side Effects**: Execute code for each emission without changing the value
 * - **Error Handling**: Catch and transform errors gracefully
 *
 * @example
 * ```ts
 * // Operator that doubles values
 * const doubleOperator: OperatorFunctionType<number, number> = (source) => {
 *   return new ObservableService((observer) => {
 *     return source.subscribe({
 *       next: (value) => observer.next?.(value * 2),
 *       error: (err) => observer.error?.(err),
 *       complete: () => observer.complete?.()
 *     });
 *   });
 * };
 *
 * const source = new ObservableService((observer) => {
 *   observer.next?.(5);
 *   observer.next?.(10);
 * });
 *
 * const doubled = source.pipe(doubleOperator);
 *
 * doubled.subscribe((value) => console.log(value)); // Outputs: 10, 20
 * ```
 *
 * @example
 * ```ts
 * // Operator that filters values
 * const filterOperator: OperatorFunctionType<number, number> = (source) => {
 *   return new ObservableService((observer) => {
 *     return source.subscribe({
 *       next: (value) => {
 *         if (value > 5) {
 *           observer.next?.(value);
 *         }
 *       },
 *       error: (err) => observer.error?.(err),
 *       complete: () => observer.complete?.()
 *     });
 *   });
 * };
 * ```
 *
 * @see ObservableService
 * @see ObservableService.pipe
 * @see UnaryFunctionInterface
 *
 * @since 2.0.0
 */

export type OperatorFunctionType<T = any, R = any> = UnaryFunctionInterface<ObservableService<T>, ObservableService<R>>;
