/**
 * Import will remove at compile time
 */

import type { CompleteType, NextType, ErrorType } from '@observable/interfaces/observable.interface';
import type { ObserverInterface, UnsubscribeType } from '@observable/interfaces/observable.interface';

/**
 * Imports
 */

import { SubjectService } from '@observable/services/subject.service';

/**
 * A subject that emits the most recent value to new subscribers immediately upon subscription.
 *
 * @template T - The type of values emitted by the behavior subject.
 *
 * @remarks
 * The `BehaviorSubjectService` extends {@link SubjectService} to maintain and replay the
 * latest emitted value to all new subscribers. Unlike a regular subject where new subscribers
 * only receive values emitted after subscription, behavior subjects guarantee that every new
 * subscriber immediately receives the current value.
 *
 * This is particularly useful for:
 * - State management where new subscribers need the current state
 * - Configuration or preference storage
 * - Real-time data feeds where latecomers need the latest snapshot
 *
 * The behavior subject always has a value available, even before any emission occurs, using
 * the initial value provided at construction.
 *
 * @example
 * ```ts
 * const count = new BehaviorSubjectService<number>(0);
 * count.subscribe((value) => console.log('Observer 1:', value)); // Immediately logs: 0
 * count.next(5);
 * count.subscribe((value) => console.log('Observer 2:', value)); // Immediately logs: 5
 * ```
 *
 * @see SubjectService
 * @see ObserverInterface
 *
 * @since 2.0.0
 */

export class BehaviorSubjectService<T> extends SubjectService<T> {
    /**
     * Flag indicating whether the subject has been completed.
     *
     * @remarks
     * This private property tracks the completion state of the subject. It is set to `true`
     * when {@link complete} is called, indicating that the subject has entered a terminal state
     * and will no longer emit values or errors.
     *
     * Once a subject is completed, any subsequent calls to {@link next} or {@link error} should
     * be prevented or have no effect, maintaining the integrity of the observable contract.
     *
     * This flag can be used to:
     * - Prevent emissions after completion
     * - Check if the subject is in a terminal state
     * - Implement conditional logic based on completion status
     *
     * @example
     * ```ts
     * const subject = new SubjectService<number>();
     *
     * console.log(subject['completeStatus']); // false
     *
     * subject.complete();
     *
     * console.log(subject['completeStatus']); // true
     * ```
     *
     * @see complete
     * @since 2.0.0
     */

    private completeStatus = false;

    /**
     * The most recently emitted value or the initial value.
     *
     * @remarks
     * This property stores the latest value that will be replayed to new subscribers.
     * It is initialized with the value provided to the constructor and updated whenever
     * {@link next} is called.
     *
     * @since 2.0.0
     */

    private lastValue: T;

    /**
     * Creates a new behavior subject with an initial or lazily-computed value.
     *
     * @template T - The type of values emitted by the behavior subject.
     *
     * @param initialValue - Either an initial value or a factory function that computes it.
     *
     * @remarks
     * The behavior subject requires an initial value at construction time. This value can be
     * provided in two ways:
     *
     * 1. **Direct value**: Pass the value directly (e.g., `new BehaviorSubjectService(0)`)
     * 2. **Factory function**: Pass a function that returns the value (e.g., `new BehaviorSubjectService(() => getInitialState())`)
     *
     * Using a factory function allows for lazy initialization and computation of the initial value,
     * which is useful when the initial state depends on side effects or is expensive to compute.
     *
     * @example
     * ```ts
     * // Direct value
     * const subject1 = new BehaviorSubjectService<number>(42);
     *
     * // Factory function for lazy initialization
     * const subject2 = new BehaviorSubjectService<string>(() => {
     *   return localStorage.getItem('savedState') ?? 'default';
     * });
     * ```
     *
     * @since 2.0.0
     */

    constructor(initialValue: T | (() => T)) {
        super();
        this.lastValue = typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue;
    }

    /**
     * Retrieves the current value of the behavior subject.
     *
     * @template T - The type of the value.
     *
     * @returns The most recently emitted value or the initial value.
     *
     * @remarks
     * This getter provides read-only access to the current state of the behavior subject.
     * The value is always available and represents either the last emitted value or the
     * initial value if no emissions have occurred.
     *
     * @example
     * ```ts
     * const subject = new BehaviorSubjectService<number>(10);
     * console.log(subject.value); // Output: 10
     *
     * subject.next(20);
     * console.log(subject.value); // Output: 20
     * ```
     *
     * @since 2.0.0
     */

    get value(): T {
        return this.lastValue;
    }

    /**
     * Subscribes to the behavior subject with immediate replay of the current value.
     *
     * @template T - The type of values emitted by the behavior subject.
     *
     * @param observerOrNext - Either an observer object or a callback function for the `next` event.
     * @param error - Optional error handler callback.
     * @param complete - Optional completion handler callback.
     * @returns An unsubscribe function that removes the subscription.
     *
     * @remarks
     * This override adds behavior-specific subscription logic: immediately after the observer
     * is registered with the parent {@link SubjectService}, the current value is emitted to
     * the new observer. This ensures all subscribers, even those who join late, receive the
     * most recent value.
     *
     * The subscription follows the same modes as the parent:
     * 1. **Observer mode**: Pass a full {@link ObserverInterface}
     * 2. **Callback mode**: Pass a `next` callback with optional error and complete handlers
     * 3. **Empty mode**: Pass nothing to subscribe without any handlers
     *
     * @example
     * ```ts
     * const subject = new BehaviorSubjectService<number>(5);
     *
     * // Observer mode
     * const unsub1 = subject.subscribe({
     *   next: (value) => console.log('A:', value)
     * }); // Immediately logs: "A: 5"
     *
     * subject.next(10);
     *
     * // Callback mode (late subscriber)
     * const unsub2 = subject.subscribe(
     *   (value) => console.log('B:', value)
     * ); // Immediately logs: "B: 10"
     *
     * subject.next(15); // Both log their respective updates
     * ```
     *
     * @see ObserverInterface
     * @see SubjectService.subscribe
     *
     * @since 2.0.0
     */

    override subscribe(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): UnsubscribeType {
        if(this.completeStatus) return () => {};

        const observer = this.normalizeObserver(observerOrNext, error, complete);
        const unsub = super.subscribe(observer);
        observer.next?.(this.lastValue);

        return unsub;
    }

    /**
     * Emits a new value and updates the current state.
     *
     * @template T - The type of values emitted by the behavior subject.
     *
     * @param value - The new value to emit to all observers.
     * @returns void
     *
     * @throws AggregateError - If one or more observer's `next` handler throws an error.
     *
     * @remarks
     * This override extends the parent {@link SubjectService.next} method by storing the
     * emitted value as the current state before broadcasting to all observers. This ensures
     * that any new subscribers added after this emission will receive this value.
     *
     * Error handling follows the parent behavior: if an observer's next handler throws,
     * the error is passed to that observer's error handler (if provided), and all errors
     * are collected and thrown together as an {@link AggregateError}.
     *
     * @example
     * ```ts
     * const subject = new BehaviorSubjectService<number>(0);
     *
     * subject.subscribe((value) => console.log('Observer 1:', value));
     *
     * subject.next(42); // Updates internal state and notifies observers
     *
     * subject.subscribe((value) => console.log('Observer 2:', value));
     * // Immediately logs: "Observer 2: 42" (receives the updated state)
     * ```
     *
     * @see AggregateError
     * @see SubjectService.next
     *
     * @since 2.0.0
     */

    override next(value: T): void {
        // todo throw error if complete
        if(this.completeStatus) return;

        this.lastValue = value;
        super.next(value);
    }

    /**
     * Signals completion to all observers and marks the subject as completed.
     *
     * @template T - The type of values emitted by the subject.
     *
     * @returns void
     *
     * @throws AggregateError - If one or more observer's `complete` handler throws an error.
     *
     * @remarks
     * This override extends the parent {@link SubjectService.complete} method by setting an internal
     * flag to track the completion state. This allows the subject to prevent further emissions and
     * maintain awareness of its lifecycle state.
     *
     * The method calls the `complete` handler on all current observers, then sets the completion flag,
     * and finally clears the observers collection to prevent further emissions. If an observer's
     * complete handler throws an error, it is caught and collected. All errors from handlers are
     * thrown together as an {@link AggregateError} after all observers have been notified.
     *
     * If an observer does not provide a complete handler, it is skipped without any effect.
     *
     * Once completion is signaled, the subject enters a terminal state and no further values,
     * errors, or completions can be emitted.
     *
     * @example
     * ```ts
     * const subject = new SubjectService<number>();
     *
     * subject.subscribe({
     *   next: (value) => console.log('Value:', value),
     *   complete: () => console.log('Completed')
     * });
     *
     * subject.next(42); // Logs: "Value: 42"
     * subject.complete(); // Logs: "Completed"
     *
     * // Further calls have no effect
     * subject.next(100); // No output
     * ```
     *
     * @see AggregateError
     * @see SubjectService.complete
     *
     * @since 2.0.0
     */

    override complete(): void {
        this.completeStatus = true;
        super.complete();
    }
}
