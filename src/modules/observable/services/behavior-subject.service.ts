/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { CompleteType, NextType, ErrorType } from '@observable/observable.module';
import type { ObserverInterface, UnsubscribeType } from '@observable/observable.module';

/**
 * Imports
 */

import { SubjectService } from '@observable/services/subject.service';

/**
 * A subject that replays its latest value to each new subscriber on subscription.
 *
 * @template T - The type of values emitted by the behavior subject.
 *
 * @remarks
 * Extends {@link SubjectService} by retaining the most recent value (seeded at construction) and emitting it
 * immediately to every new subscriber. A value is therefore always available, even before the first {@link next}.
 *
 * @example
 * ```ts
 * const count = new BehaviorSubject<number>(0);
 * count.subscribe(v => console.log('A', v)); // logs 0 immediately
 * count.next(5);
 * count.subscribe(v => console.log('B', v)); // logs 5 immediately
 * ```
 *
 * @see SubjectService
 * @see ObserverInterface
 *
 * @since 2.0.0
 */

export class BehaviorSubjectService<T> extends SubjectService<T> {
    /**
     * The most recent value, replayed to new subscribers.
     *
     * @remarks
     * Seeded from the constructor and updated by {@link next}.
     *
     * @since 2.0.0
     */

    private lastValue: T;

    /**
     * Creates a behavior subject seeded with an initial value.
     *
     * @param initialValue - The initial value, or a factory invoked once to compute it.
     *
     * @remarks
     * A factory enables lazy or side-effecting initialization; it is called exactly once during construction.
     *
     * @example
     * ```ts
     * const direct = new BehaviorSubject<number>(42);
     * const lazy = new BehaviorSubject<string>(() => localStorage.getItem('state') ?? 'default');
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
     * The current value: the latest emitted value, or the initial value.
     *
     * @returns The most recent value.
     *
     * @since 2.0.0
     */

    get value(): T {
        return this.lastValue;
    }

    /**
     * Subscribes and immediately replays the current value to the new observer.
     *
     * @param observerOrNext - A full observer object, or a `next` callback.
     * @param error - Error handler, used when the first argument is a `next` callback.
     * @param complete - Completion handler, used when the first argument is a `next` callback.
     * @returns Unsubscribe function, or a no-op when the subject has already completed.
     *
     * @remarks
     * Registers the observer through {@link SubjectService}, then emits the current value once so late subscribers
     * receive the latest state.
     *
     * @see SubjectService.subscribe
     * @since 2.0.0
     */

    override subscribe(
        observerOrNext?: ObserverInterface<T> | NextType<T>,
        error?: ErrorType,
        complete?: CompleteType
    ): UnsubscribeType {
        if(this.isCompleted) return () => {};

        const observer = this.createSafeObserver(observerOrNext, error, complete);
        const unsub = super.subscribe(observer);
        observer.next?.(this.lastValue);

        return unsub;
    }

    /**
     * Stores the value as the current state, then emits it to all observers.
     *
     * @param value - The new value to emit.
     *
     * @throws AggregateError - When one or more observer `next` handlers throw.
     *
     * @remarks
     * Updates the replay value before broadcasting, so subscribers added afterward receive it.
     *
     * @see SubjectService.next
     * @since 2.0.0
     */

    override next(value: T): void {
        if (this.isCompleted) return;

        this.lastValue = value;
        super.next(value);
    }
}
