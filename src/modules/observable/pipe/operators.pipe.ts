/**
 * Imports
 */

import { Observable } from '@observable/observable.module';

/**
 * Transforms each emitted value using the provided transformation function.
 *
 * @template T - The input value type.
 * @template R - The output value type after transformation.
 *
 * @param project - Function that transforms each input value to an output value.
 * @returns An operator function that creates a new observable with transformed values.
 *
 * @throws Error - If the project function throws, the error is caught and emitted to the observer.
 *
 * @remarks
 * The `map` operator applies a transformation function to every value emitted by the source
 * observable and emits the transformed values. Errors thrown by the project function are
 * automatically caught and passed to the observer's error handler.
 *
 * Common use cases:
 * - Converting data formats (string to number, object property extraction)
 * - Mathematical transformations (doubling, negation)
 * - Type conversions and casting
 *
 * @example
 * ```ts
 * const numbers = new Observable<number>((observer) => {
 *   observer.next?.(5);
 *   observer.next?.(10);
 * });
 *
 * const doubled = numbers.pipe(map((x) => x * 2));
 *
 * doubled.subscribe((value) => console.log(value)); // Outputs: 10, 20
 * ```
 *
 * @see Observable
 * @see OperatorFunctionType
 *
 * @since 2.0.0
 */

export function map<T, R>(project: (value: T) => R) {
    return (source: Observable<T>): Observable<R> => {
        return new Observable<R>((observer) => {
            return source.subscribe({
                next: (value) => {
                    try {
                        const result = project(value);
                        observer.next?.(result);
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.()
            });
        });
    };
}

/**
 * Emits only values that are different from the previously emitted value.
 *
 * @template T - The type of values being compared.
 *
 * @param compareFn - Optional comparison function to determine equality. Defaults to strict equality (`===`).
 * @returns An operator function that creates a new observable with only distinct consecutive values.
 *
 * @remarks
 * The `distinctUntilChanged` operator filters out consecutive duplicate values using the provided
 * comparison function. Only values that differ from the last emitted value are passed through.
 * This is particularly useful for reducing redundant emissions when state changes are minimal.
 *
 * The comparison function receives the previous and current values and should return `true`
 * if they are considered equal (and thus should be filtered), or `false` if they are different
 * (and thus should be emitted).
 *
 * Errors thrown by the comparison function are caught and emitted to the observer's error handler.
 *
 * Common use cases:
 * - Avoiding redundant updates (e.g., state management)
 * - Filtering out echoed or repeated sensor data
 * - Preventing unnecessary re-renders in UI frameworks
 *
 * @example
 * ```ts
 * const values = new Observable<number>((observer) => {
 *   observer.next?.(1);
 *   observer.next?.(1);
 *   observer.next?.(2);
 *   observer.next?.(2);
 *   observer.next?.(3);
 * });
 *
 * const distinct = values.pipe(distinctUntilChanged());
 *
 * distinct.subscribe((value) => console.log(value)); // Outputs: 1, 2, 3
 * ```
 *
 * @example
 * ```ts
 * // Custom comparison for objects
 * interface User { id: number; name: string; }
 *
 * const users = new Observable<User>((observer) => {
 *   observer.next?.({ id: 1, name: 'Alice' });
 *   observer.next?.({ id: 1, name: 'Alice' });
 *   observer.next?.({ id: 2, name: 'Bob' });
 * });
 *
 * const distinctUsers = users.pipe(
 *   distinctUntilChanged((prev, curr) => prev.id === curr.id)
 * );
 *
 * distinctUsers.subscribe((user) => console.log(user.name));
 * // Outputs: "Alice", "Bob"
 * ```
 *
 * @see Observable
 * @see OperatorFunctionType
 *
 * @since 2.0.0
 */

export function distinctUntilChanged<T>(
    compareFn: (previous: T, current: T) => boolean = (a, b) => a === b
) {
    return (source: Observable<T>): Observable<T> => {
        return new Observable<T>((observer) => {
            let hasPrevious = false;
            let previous: T;

            return source.subscribe({
                next: (value) => {
                    try {
                        if(!hasPrevious) {
                            previous = value;
                            hasPrevious = true;
                            observer.next?.(value);

                            return;
                        }

                        if (!compareFn(previous, value)) {
                            previous = value;
                            observer.next?.(value);
                        }
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.()
            });
        });
    };
}

/**
 * Filters emitted values based on a predicate function.
 *
 * @template T - The type of values being filtered.
 *
 * @param predicate - Function that returns `true` if the value should pass through, `false` otherwise.
 * @returns An operator function that creates a new observable with only filtered values.
 *
 * @remarks
 * The `filter` operator only emits values that satisfy the predicate condition. Values that
 * do not match the condition are silently skipped. All other events (error, complete) are
 * passed through unchanged.
 *
 * Errors thrown by the predicate function are caught and passed to the observer's error handler.
 *
 * Common use cases:
 * - Filtering by value range (e.g., only positive numbers)
 * - Filtering by type or property (e.g., only objects with specific properties)
 * - Conditional emission based on complex logic
 *
 * @example
 * ```ts
 * const numbers = new Observable<number>((observer) => {
 *   observer.next?.(1);
 *   observer.next?.(2);
 *   observer.next?.(3);
 *   observer.next?.(4);
 *   observer.next?.(5);
 * });
 *
 * const evens = numbers.pipe(filter((x) => x % 2 === 0));
 *
 * evens.subscribe((value) => console.log(value)); // Outputs: 2, 4
 * ```
 *
 * @see Observable
 * @see OperatorFunctionType
 *
 * @since 2.0.0
 */

export function filter<T>(predicate: (value: T) => boolean) {
    return (source: Observable<T>): Observable<T> => {
        return new Observable<T>((observer) => {
            return source.subscribe({
                next: (value) => {
                    try {
                        if (predicate(value)) {
                            observer.next?.(value);
                        }
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.()
            });
        });
    };
}

/**
 * Performs a side effect for each emitted value without modifying the value.
 *
 * @template T - The type of values being processed.
 *
 * @param sideEffect - Function to execute for each emitted value. The return value is ignored.
 * @returns An operator function that creates a new observable with the side effect applied.
 *
 * @remarks
 * The `tap` operator is used for debugging, logging, or triggering side effects without
 * altering the data flow. The provided function is called for each emitted value, and the
 * original value is passed through unchanged to the resulting observable.
 *
 * Errors thrown by the side effect function are caught and passed to the observer's error handler.
 * The original value is NOT emitted if the side effect throws an error.
 *
 * Common use cases:
 * - Logging values for debugging
 * - Triggering analytics or tracking events
 * - Updating external state or UI without changing the stream
 * - Performance monitoring
 *
 * @example
 * ```ts
 * const numbers = new Observable<number>((observer) => {
 *   observer.next?.(5);
 *   observer.next?.(10);
 * });
 *
 * const logged = numbers.pipe(
 *   tap((x) => console.log(`Processing: ${x}`))
 * );
 *
 * logged.subscribe((value) => console.log(`Received: ${value}`));
 * // Outputs:
 * // Processing: 5
 * // Received: 5
 * // Processing: 10
 * // Received: 10
 * ```
 *
 * @see Observable
 * @see OperatorFunctionType
 *
 * @since 2.0.0
 */

export function tap<T>(sideEffect: (value: T) => void) {
    return (source: Observable<T>): Observable<T> => {
        return new Observable<T>((observer) => {
            return source.subscribe({
                next: (value) => {
                    try {
                        sideEffect(value);
                        observer.next?.(value);
                    } catch (err) {
                        observer.error?.(err);
                    }
                },
                error: (err) => observer.error?.(err),
                complete: () => observer.complete?.()
            });
        });
    };
}
