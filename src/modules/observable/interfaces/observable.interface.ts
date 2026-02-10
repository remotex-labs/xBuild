/**
 * Import will remove at compile time
 */

import type { Observable } from '@observable/observable.module';

/**
 * Callback invoked for each value emitted by an Observable
 *
 * @template T - Type of value that will be delivered to this callback
 *
 * @param value - The emitted value from the source Observable
 *
 * @since 2.0.0
 */

export type NextType<T> = (value: T) => void;

/**
 * Callback invoked when an error terminates the Observable stream
 *
 * @param err - The error value that caused the stream to terminate
 *
 * @remarks
 * This handler signals a terminal state. After it is called:
 * - No further `next` values will be delivered
 * - No further `error` or `complete` callbacks will be invoked
 * - The subscription is considered finished
 *
 * Most Observable implementations treat any call to `error` as terminal.
 *
 * @since 2.0.0
 */

export type ErrorType = (err: unknown) => void;

/**
 * Callback invoked when the Observable completes successfully
 *
 * @remarks
 * This is a terminal notification. After this handler runs:
 * - No further values or errors will be emitted
 * - The stream is finished normally (no error occurred)
 *
 * @since 2.0.0
 */

export type CompleteType = () => void;

/**
 * Function that unsubscribes from an Observable and triggers cleanup
 *
 * @remarks
 * Calling this function:
 * - Stops delivery of future notifications (`next`, `error`, `complete`)
 * - Invokes any teardown/cleanup logic registered by the source
 * - Releases resources associated with the subscription
 *
 * It is safe to call multiple times (idempotent).
 *
 * @since 2.0.0
 */

export type UnsubscribeType = () => void;

/**
 * Generic unary function type — takes one input and produces one output
 *
 * Most frequently used to represent Observable operators that transform
 * one stream into another (map, filter, mergeMap, etc.).
 *
 * @template T - Type of the input value
 * @template R - Type of the returned value
 *
 * @since 2.0.0
 */

export interface UnaryFunctionInterface<T, R> {

    /**
     * Applies transformation to the input value
     *
     * @param source - The input value (most commonly an Observable)
     * @returns The transformed result (most commonly a new Observable)
     *
     * @since 2.0.0
     */

    (source: T): R;
}

/**
 * Operator function shape accepted by Observable.prototype.pipe()
 *
 * Takes a source Observable<T> and returns a new Observable<R>
 *
 * @template T - Type of values in the source Observable
 * @template R - Type of values in the resulting Observable
 *
 * @since 2.0.0
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OperatorFunctionType<T = any, R = any> =
    UnaryFunctionInterface<Observable<T>, Observable<R>>;

/**
 * Observer contract — object that receives Observable notifications
 *
 * Can be passed directly to `subscribe()` or built from individual callbacks.
 *
 * @template T - Type of values expected in `next` notifications
 *
 * @example
 * ```ts
 * // Full observer object
 * source.subscribe({
 *   next: value => console.log('value:', value),
 *   error: err => console.error('error:', err),
 *   complete: () => console.log('completed')
 * });
 *
 * // Minimal observer (only interested in values)
 * source.subscribe(value => console.log(value));
 * ```
 *
 * @see {@link Observable#subscribe}
 * @since 2.0.0
 */

export interface ObserverInterface<T> {
    /**
     * Receives each new value emitted by the Observable
     * @since 2.0.0
     */

    next?: NextType<T>;

    /**
     * Receives a terminal error that ends the stream
     * @since 2.0.0
     */

    error?: ErrorType;

    /**
     * Receives notification that the Observable completed successfully
     * @since 2.0.0
     */

    complete?: CompleteType;
}
