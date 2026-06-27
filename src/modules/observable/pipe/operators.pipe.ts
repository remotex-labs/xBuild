/**
 * Imports
 */

import { Observable } from '@observable/observable.module';

/**
 * Maps each emitted value through a projection function.
 *
 * @template T - The input value type.
 * @template R - The projected value type.
 *
 * @param project - Transforms each source value into an output value.
 * @returns An operator that emits the projected values.
 *
 * @throws Error - Errors thrown by `project` are caught and routed to the observer's error handler.
 *
 * @remarks
 * Applies `project` to every value from the source and emits the result.
 *
 * @example
 * ```ts
 * const doubled = numbers.pipe(map(x => x * 2));
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
 * Emits a value only when it differs from the previously emitted one.
 *
 * @template T - The type of values being compared.
 *
 * @param compareFn - Equality test returning `true` when two values are equal. Defaults to strict equality (`===`).
 * @returns An operator that suppresses consecutive duplicate values.
 *
 * @throws Error - Errors thrown by `compareFn` are caught and routed to the observer's error handler.
 *
 * @remarks
 * The first value always passes through; each later value is emitted only when `compareFn` reports it as different
 * from the last emitted value.
 *
 * @example
 * ```ts
 * // Compare by identity field
 * users.pipe(distinctUntilChanged((prev, curr) => prev.id === curr.id));
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
 * Emits only the values that satisfy a predicate.
 *
 * @template T - The type of values being filtered.
 *
 * @param predicate - Returns `true` to emit the value, `false` to drop it.
 * @returns An operator that forwards only matching values.
 *
 * @throws Error - Errors thrown by `predicate` are caught and routed to the observer's error handler.
 *
 * @remarks
 * Non-matching values are skipped; error and completion notifications pass through unchanged.
 *
 * @example
 * ```ts
 * const evens = numbers.pipe(filter(x => x % 2 === 0));
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
 * Runs a side effect for each value and forwards the value unchanged.
 *
 * @template T - The type of values passing through.
 *
 * @param sideEffect - Invoked for each emitted value; its return value is ignored.
 * @returns An operator that passes values through after running the side effect.
 *
 * @throws Error - Errors thrown by `sideEffect` are caught and routed to the observer's error handler.
 *
 * @remarks
 * Intended for logging, tracking, or other side effects. If `sideEffect` throws, the value is not emitted.
 *
 * @example
 * ```ts
 * const logged = numbers.pipe(tap(x => console.log('value', x)));
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
