/**
 * Import will remove at compile time
 */

import type { ObserverInterface, UnsubscribeType } from '@observable/observable.module';
import type { NextType, ErrorType, CompleteType, OperatorFunctionType } from '@observable/observable.module';

/**
 * Represents a push-based collection of values that can be observed over time
 *
 * This is the core type of lightweight observable implementation.
 * It allows subscription, safe error handling and operator chaining via pipe.
 *
 * @template T - Type of values emitted by this observable
 *
 * @example
 * ```ts
 * const numbers = new Observable<number>(observer => {
 *   [1, 2, 3].forEach(v => observer.next?.(v));
 *   observer.complete?.();
 *   return () => console.log('cleaned up');
 * });
 *
 * const sub = numbers.subscribe({
 *   next: v => console.log(v),
 *   complete: () => console.log('done')
 * });
 *
 * sub(); // triggers cleanup
 * ```
 *
 * @see {@link pipe}
 * @see {@link ObserverInterface}
 * @see {@link OperatorFunctionType}
 *
 * @since 2.0.0
 */

export class ObservableService<T = unknown> {
    /**
     * Creates a new observable service with a subscription handler.
     *
     * @param handler - Function called when someone subscribes.
     *                  It receives an observer and returns an optional cleanup function.
     *
     * @remarks
     * The handler function is called immediately when {@link subscribe} is invoked.
     * It receives the observer object and is responsible for:
     * - Calling `observer.next()` to emit values
     * - Calling `observer.error()` to emit errors
     * - Calling `observer.complete()` to signal completion
     * - Returning an optional cleanup function for resource management
     *
     * This design pattern allows for lazy initialization, external event binding and
     * fine-grained control over subscription lifecycle.
     *
     * @example
     * ```ts
     * const timerObservable = new ObservableService<number>((observer) => {
     *   let count = 0;
     *   const intervalId = setInterval(() => {
     *     observer.next?.(count++);
     *   }, 1000);
     *
     *   // Return cleanup function
     *   return () => clearInterval(intervalId);
     * });
     * ```
     *
     * @see ObserverInterface
     * @since 2.0.0
     */

    constructor(
        private readonly handler: (observer: ObserverInterface<T>) => UnsubscribeType | void
    ) {}

    /**
     * Subscribes to this observable and receives values, errors and completion
     *
     * @param observerOrNext - Either a full observer object or just the next handler
     * @param error - Optional error handler
     * @param complete - Optional completion handler
     * @returns Unsubscribe function — call it to stop receiving values and clean up
     *
     * @remarks
     * Supports three overload styles:
     * 1. Single observer object
     * 2. Separate next/error/complete callbacks
     * 3. Only the next callback (error and complete are optional)
     *
     * @example
     * ```ts
     * // Object style
     * subscription = source.subscribe({
     *   next: v => console.log(v),
     *   error: e => console.error(e),
     *   complete: () => console.log('completed')
     * });
     *
     * // Callback style
     * subscription = source.subscribe(
     *   v => console.log(v),
     *   e => console.error(e),
     *   () => console.log('completed')
     * );
     * ```
     *
     * @since 2.0.0
     */

    subscribe(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): UnsubscribeType {
        const observer = this.createSafeObserver(observerOrNext, error, complete);
        let cleanup: UnsubscribeType | void;

        try {
            cleanup = this.handler(observer);
        } catch (err) {
            observer.error?.(err);

            return () => {};
        }

        return () => {
            try {
                cleanup?.();
            } catch (err) {
                observer.error?.(err);
            }
        };
    }

    /**
     * Chains zero or more operators to transform this observable
     *
     * When called without arguments returns the same observable (identity).
     * Each operator receives the previous observable and returns a new one.
     *
     * @remarks
     * Type signatures are overloaded up to 5 explicit operators for best type inference.
     * After that, a rest version is used with weaker type information (the result is `Observable<T>`).
     *
     * @returns New observable (or same when no operators given)
     *
     * @since 2.0.0
     */

    pipe(): this;

    /**
     * Chains one observable operator to transform the observable.
     *
     * @template A - The output type of the first operator.
     *
     * @param op1 - First operator function to apply.
     * @returns An observable transformed by the operator.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A>(
        op1: OperatorFunctionType<T, A>
    ): ObservableService<A>;

    /**
     * Chains two observable operators to transform the observable.
     *
     * @template A - The output type of the first operator.
     * @template B - The output type of the second operator.
     *
     * @param op1 - First operator function to apply.
     * @param op2 - Second operator function to apply.
     * @returns An observable transformed by both operators in sequence.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A, B>(
        op1: OperatorFunctionType<T, A>, op2: OperatorFunctionType<A, B>
    ): ObservableService<B>;

    /**
     * Chains three observable operators to transform the observable.
     *
     * @template A - The output type of the first operator.
     * @template B - The output type of the second operator.
     * @template C - The output type of the third operator.
     *
     * @param op1 - First operator function to apply.
     * @param op2 - Second operator function to apply.
     * @param op3 - Third operator function to apply.
     * @returns An observable transformed by all three operators in sequence.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A, B, C>(
        op1: OperatorFunctionType<T, A>,
        op2: OperatorFunctionType<A, B>,
        op3: OperatorFunctionType<B, C>
    ): ObservableService<C>;

    /**
     * Chains four observable operators to transform the observable.
     *
     * @template A - The output type of the first operator.
     * @template B - The output type of the second operator.
     * @template C - The output type of the third operator.
     * @template D - The output type of the fourth operator.
     *
     * @param op1 - First operator function to apply.
     * @param op2 - Second operator function to apply.
     * @param op3 - Third operator function to apply.
     * @param op4 - Fourth operator function to apply.
     * @returns An observable transformed by all four operators in sequence.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A, B, C, D>(
        op1: OperatorFunctionType<T, A>,
        op2: OperatorFunctionType<A, B>,
        op3: OperatorFunctionType<B, C>,
        op4: OperatorFunctionType<C, D>
    ): ObservableService<D>;

    /**
     * Chains five observable operators to transform the observable.
     *
     * @template A - The output type of the first operator.
     * @template B - The output type of the second operator.
     * @template C - The output type of the third operator.
     * @template D - The output type of the fourth operator.
     * @template E - The output type of the fifth operator.
     *
     * @param op1 - First operator function to apply.
     * @param op2 - Second operator function to apply.
     * @param op3 - Third operator function to apply.
     * @param op4 - Fourth operator function to apply.
     * @param op5 - Fifth operator function to apply.
     * @returns An observable transformed by all five operators in sequence.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A, B, C, D, E>(
        op1: OperatorFunctionType<T, A>,
        op2: OperatorFunctionType<A, B>,
        op3: OperatorFunctionType<B, C>,
        op4: OperatorFunctionType<C, D>,
        op5: OperatorFunctionType<D, E>
    ): ObservableService<E>;

    /**
     * Chains five or more observable operators to transform the observable.
     *
     * @template A - The output type of the first operator.
     * @template B - The output type of the second operator.
     * @template C - The output type of the third operator.
     * @template D - The output type of the fourth operator.
     * @template E - The output type of the fifth operator.
     * @template Ops - Tuple type of additional operator functions beyond the first five.
     *
     * @param op1 - First operator function to apply.
     * @param op2 - Second operator function to apply.
     * @param op3 - Third operator function to apply.
     * @param op4 - Fourth operator function to apply.
     * @param op5 - Fifth operator function to apply.
     * @param operations - Additional operator functions to apply sequentially.
     * @returns An observable transformed by all operators in sequence with the output type inferred from the final operator.
     *
     * @see {@link pipe} for implementation details
     * @since 2.0.0
     */

    pipe<A, B, C, D, E, Ops extends Array<OperatorFunctionType>>(
        op1: OperatorFunctionType<T, A>,
        op2: OperatorFunctionType<A, B>,
        op3: OperatorFunctionType<B, C>,
        op4: OperatorFunctionType<C, D>,
        op5: OperatorFunctionType<D, E>,
        ...operations: Ops
    ): ObservableService<
        Ops extends [...Array<unknown>, OperatorFunctionType<unknown, infer R>] ? R : T
    >;

    /**
     * Internal implementation of the pipe operator chain.
     *
     * @param operators - Array of operator functions to be reduced over the observable.
     * @returns The final transformed observable, or the original observable if no operators are provided.
     *
     * @remarks
     * This is the concrete implementation that executes the operator chain using a reducer pattern.
     * Each operator receives the current observable and returns a transformed observable, which becomes
     * the input for the next operator. The chain begins with the current observable instance.
     *
     * If the operator array is empty, the method returns the current observable unchanged, allowing
     * for safe calling of `pipe()` without arguments.
     *
     * Operators are applied sequentially from left to right, enabling composition of multiple
     * transformations such as mapping, filtering, debouncing and other value manipulations.
     *
     * @example
     * ```ts
     * const source = new ObservableService<number>((observer) => {
     *   observer.next?.(10);
     *   observer.next?.(20);
     * });
     *
     * // With operators
     * const doubled = source.pipe(
     *   (obs) => new ObservableService((observer) =>
     *     obs.subscribe((v) => observer.next?.(v * 2))
     *   )
     * );
     *
     * // Without operators
     * const same = source.pipe();
     * ```
     *
     * @see OperatorFunctionType
     * @since 2.0.0
     */

    pipe<R = ObservableService<T>>(...operators: Array<OperatorFunctionType>): R {
        if (operators.length === 0) {
            return this as unknown as R;
        }

        return <R> operators.reduce<ObservableService>(
            (prev, op) => op(prev),
            this as ObservableService
        );
    }

    /**
     * Converts subscribe arguments into a consistent ObserverInterface shape
     *
     * @remarks Internal helper – not meant to be called directly
     *
     * @since 2.0.0
     */

    protected createSafeObserver(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): ObserverInterface<T> {
        return typeof observerOrNext === 'function'
            ? { next: observerOrNext, error, complete }
            : observerOrNext || {};
    }
}
