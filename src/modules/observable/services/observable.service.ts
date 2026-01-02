/**
 * Import will remove at compile time
 */

import type { ErrorType } from '@observable/interfaces/observable.interface';
import type { OperatorFunctionType } from '@observable/interfaces/observable.interface';
import type { CompleteType, NextType } from '@observable/interfaces/observable.interface';
import type { ObserverInterface, UnsubscribeType } from '@observable/interfaces/observable.interface';

/**
 * A reactive observable service that manages subscriptions through a handler function.
 *
 * @template T - The type of values emitted by the observable.
 *
 * @remarks
 * The `ObservableService` implements a subscription-based pattern where observers are
 * notified through a handler function. Unlike the previous implementation that manages
 * internal state and subscribers, this version delegates all emission logic to a provided
 * handler function, offering greater flexibility and control over subscription behavior.
 *
 * The handler function receives an observer and is responsible for managing value emissions,
 * error handling, and completion. It can return an optional unsubscribe function
 * called when the subscription is disposed.
 *
 * @example
 * ```ts
 * // Create an observable that emits a single value
 * const observable = new ObservableService<number>((observer) => {
 *   observer.next?.(42);
 *   observer.complete?.();
 * });
 *
 * // Subscribe to the observable
 * const unsub = observable.subscribe((value) => console.log(value));
 * ```
 *
 * @see ObserverInterface
 * @since 2.0.0
 */

export class ObservableService<T = unknown> {
    /**
     * Creates a new observable service with a subscription handler.
     *
     * @template T - The type of values emitted by the observable.
     *
     * @param handler - Function that receives an observer and manages emissions. Can return an unsubscribe function.
     *
     * @remarks
     * The handler function is called immediately when {@link subscribe} is invoked. It receives
     * the observer object and is responsible for:
     * - Calling `observer.next()` to emit values
     * - Calling `observer.error()` to emit errors
     * - Calling `observer.complete()` to signal completion
     * - Returning an optional cleanup function for resource management
     *
     * This design pattern allows for lazy initialization, external event binding, and
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
     * Subscribes to the observable with flexible observer configuration.
     *
     * @param observerOrNext - Either an observer object or a callback function for the `next` event.
     * @param error - Optional error handler callback.
     * @param complete - Optional completion handler callback.
     * @returns An unsubscribe function that cleans up the subscription and handles any errors during cleanup.
     *
     * @remarks
     * This method supports multiple subscription modes:
     *
     * 1. **Observer mode**: Pass a full {@link ObserverInterface} with optional handlers
     * 2. **Callback mode**: Pass a `next` callback function with optional separate error and complete handlers
     * 3. **Empty mode**: Pass nothing to subscribe without any handlers
     *
     * The handler is immediately invoked with the constructed observer. If the handler throws
     * an error, it is caught and passed to the observer's error handler, while an empty unsubscribe
     * function is returned.
     *
     * The returned unsubscribe function safely calls the cleanup function returned by the handler
     * (if any). Any errors during cleanup are caught and passed to the observer's error handler.
     *
     * @example
     * ```ts
     * // Observer mode
     * const unsub1 = observable.subscribe({
     *   next: (value) => console.log(value),
     *   error: (err) => console.error(err),
     *   complete: () => console.log('Done')
     * });
     *
     * // Callback mode
     * const unsub2 = observable.subscribe(
     *   (value) => console.log(value),
     *   (err) => console.error(err),
     *   () => console.log('Done')
     * );
     *
     * // Unsubscribe
     * unsub1();
     * unsub2();
     * ```
     *
     * @throws No errors are thrown; instead errors are passed to the observer's error handler.
     *
     * @see UnsubscribeType
     * @see ObserverInterface
     *
     * @since 2.0.0
     */

    subscribe(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): UnsubscribeType {
        const observer = this.normalizeObserver(observerOrNext, error, complete);
        let cleanup: UnsubscribeType | void;

        try {
            cleanup = this.handler(observer);
        } catch (err) {
            observer.error?.(err);

            return () => {
            };
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
     * Chains one observable operator to transform the observable.
     *
     * @template A - The output type of the first operator.
     *
     * @param op1 - First operator function to apply.
     * @returns An observable transformed by the operator.
     *
     * @remarks
     * This overload applies a single operator to the observable, returning a new observable
     * with the transformed value type. The operator receives the current observable and returns
     * a new observable with the transformed output type.
     *
     * @example
     * ```ts
     * const source = new ObservableService<number>((observer) => {
     *   observer.next?.(5);
     * });
     *
     * const doubled = source.pipe(
     *   (obs) => new ObservableService((observer) =>
     *     obs.subscribe((v) => observer.next?.(v * 2))
     *   )
     * );
     * ```
     *
     * @see OperatorFunctionType
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
     * @remarks
     * This overload handles five or more operators, providing maximum flexibility for complex
     * transformation chains. The output type is inferred from the final operator in the sequence,
     * allowing for sophisticated composition of many operators while maintaining type safety.
     *
     * @example
     * ```ts
     * const result = source.pipe(
     *   mapOperator,
     *   filterOperator,
     *   debounceOperator,
     *   distinctOperator,
     *   tapOperator,
     *   transformOperator // Output type inferred from this operator
     * );
     * ```
     *
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
     * @param ops - Array of operator functions to be reduced over the observable.
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
     * transformations such as mapping, filtering, debouncing, and other value manipulations.
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

    pipe(...ops: OperatorFunctionType[]): ObservableService {
        if (ops.length < 1) {
            return this as ObservableService;
        }

        return ops.reduce<ObservableService>(
            (prev, op) => op(prev),
            this as ObservableService
        );
    }

    /**
     * Normalizes subscription input into a unified observer object.
     *
     * @template T - The type of values in the observer.
     *
     * @param observerOrNext - Either an observer object or a callback function for the `next` event.
     * @param error - Optional error handler callback.
     * @param complete - Optional completion handler callback.
     * @returns A normalized {@link ObserverInterface} object.
     *
     * @remarks
     * This protected helper method converts flexible subscription input formats into a consistent
     * {@link ObserverInterface} structure. It handles:
     *
     * 1. **Observer object**: Returns the observer as-is, or an empty object if undefined
     * 2. **Callback function**: Wraps the callback as the `next` handler with optional separate error and complete handlers
     *
     * This normalization allows the {@link subscribe} method to work uniformly with different
     * input formats without duplicating conversion logic.
     *
     * @example
     * ```ts
     * // Observer object
     * const obs1 = this.normalizeObserver({ next: (v) => console.log(v) });
     *
     * // Callback function with handlers
     * const obs2 = this.normalizeObserver(
     *   (v) => console.log(v),
     *   (err) => console.error(err),
     *   () => console.log('done')
     * );
     *
     * // Empty
     * const obs3 = this.normalizeObserver();
     * ```
     *
     * @see ObserverInterface
     * @since 2.0.0
     */

    protected normalizeObserver(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): ObserverInterface<T> {
        return typeof observerOrNext === 'function'
            ? { next: observerOrNext, error, complete }
            : observerOrNext || {};
    }
}
