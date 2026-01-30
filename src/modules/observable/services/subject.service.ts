/**
 * Import will remove at compile time
 */

import type { ObserverInterface } from '@observable/observable.module';

/**
 * Imports
 */

import { ObservableService } from '@observable/services/observable.service';

/**
 * A subject that acts as both an observable and an observer.
 *
 * @template T - The type of values emitted by the subject.
 *
 * @remarks
 * The `SubjectService` extends {@link Observable} to provide a multicast observable
 * that maintains a collection of active observers. Unlike a regular observable that executes
 * its handler once per subscription, a subject allows multiple subscribers to share the same
 * emission sequence and receive values emitted directly via {@link next}, {@link error},
 * and {@link complete} methods.
 *
 * This is particularly useful for:
 * - Event buses where multiple listeners need the same events
 * - Sharing a single data source across multiple subscribers
 * - Implementing pub-sub patterns
 *
 * When a subscriber unsubscribes, they are automatically removed from the observer's collection.
 *
 * @example
 * ```ts
 * const subject = new SubjectService<number>();
 *
 * // Multiple subscribers
 * subject.subscribe((value) => console.log('Observer 1:', value));
 * subject.subscribe((value) => console.log('Observer 2:', value));
 *
 * // Emit values to all subscribers
 * subject.next(42); // Both observers receive 42
 * subject.next(100); // Both observers receive 100
 *
 * // Complete the subject
 * subject.complete();
 * ```
 *
 * @see ObservableService
 * @see ObserverInterface
 *
 * @since 2.0.0
 */

export class SubjectService<T> extends ObservableService<T> {
    /**
     * Tracks whether the subject has completed.
     *
     * @remarks
     * Once the subject is completed, no further values or errors can be emitted,
     * and new subscribers will immediately receive the complete notification.
     *
     * @since 2.0.0
     */

    protected isCompleted = false;

    /**
     * Collection of all active observers subscribed to this subject.
     *
     * @remarks
     * This set maintains references to all current observers. When {@link next}, {@link error},
     * or {@link complete} is called, all observers in this collection are notified.
     *
     * @see ObserverInterface
     * @since 2.0.0
     */

    private observers = new Set<ObserverInterface<T>>();

    /**
     * Creates a new subject service with a shared observer management handler.
     *
     * @template T - The type of values emitted by the subject.
     *
     * @remarks
     * The subject initializes with a handler function that manages the observer's collection.
     * When a new subscriber is added via {@link subscribe}, the observer is added to the
     * collection and a cleanup function is returned that removes the observer when unsubscribed.
     *
     * @example
     * ```ts
     * const subject = new SubjectService<string>();
     * const unsub = subject.subscribe((value) => console.log(value));
     * subject.next('hello'); // Observer receives 'hello'
     * unsub(); // Remove observer from a subject
     * ```
     *
     * @since 2.0.0
     */

    constructor() {
        super((observer) => {
            if (this.isCompleted) {
                observer.complete?.();

                return;
            }

            this.observers.add(observer);

            return (): boolean => this.observers.delete(observer);
        });
    }

    /**
     * Emits a new value to all active observers.
     *
     * @template T - The type of values emitted by the subject.
     *
     * @param value - The value to emit to all observers.
     * @returns void
     *
     * @throws AggregateError - If one or more observer's `next` handler throws an error.
     *
     * @remarks
     * This method calls the `next` handler on all current observers with the provided value.
     * If an observer's next handler throws an error, it is caught and passed to that observer's
     * error handler (if provided). All errors from handlers are collected and thrown together
     * as an {@link AggregateError} after all observers have been notified.
     *
     * The observers are iterated over a snapshot of the collection to allow observers to
     * unsubscribe during emission without affecting iteration.
     *
     * @example
     * ```ts
     * const subject = new SubjectService<number>();
     *
     * subject.subscribe((value) => console.log('A:', value));
     * subject.subscribe((value) => {
     *   if (value === 0) throw new Error('Zero not allowed');
     *   console.log('B:', value);
     * });
     *
     * try {
     *   subject.next(0); // Observer B throws, wrapped in AggregateError
     * } catch (err) {
     *   if (err instanceof AggregateError) {
     *     console.log(`${err.errors.length} observer(s) failed`);
     *   }
     * }
     * ```
     *
     * @see AggregateError
     * @since 2.0.0
     */

    next(value: T): void {
        if (this.isCompleted) return;
        const errors: Array<unknown> = [];

        for (const o of [ ...this.observers ]) {
            try {
                o.next?.(value);
            } catch (err) {
                errors.push(err);
                try {
                    o.error?.(err);
                } catch {}
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `${ errors.length } observer(s) failed in next()`);
        }
    }

    /**
     * Emits an error to all active observers.
     *
     * @param err - The error to emit to all observers.
     * @returns void
     *
     * @throws AggregateError - If one or more observer's `error` handler throws an error.
     *
     * @remarks
     * This method calls the `error` handler on all current observers with the provided error.
     * If an observer's error handler throws an error, it is caught and collected. All errors
     * from handlers are thrown together as an {@link AggregateError} after all observers
     * have been notified.
     *
     * If an observer does not provide an error handler, it is skipped without any effect.
     *
     * The observers are iterated over a snapshot of the collection to allow observers to
     * unsubscribe during emission without affecting iteration.
     *
     * After an error is emitted, the subject behaves as completed (no further emissions allowed).
     *
     * @example
     * ```ts
     * const subject = new SubjectService<number>();
     *
     * subject.subscribe({
     *   error: (err) => console.log('Observer A error:', err)
     * });
     *
     * subject.subscribe({
     *   error: () => { throw new Error('Handler failed'); }
     * });
     *
     * try {
     *   subject.error(new Error('Something went wrong'));
     * } catch (err) {
     *   if (err instanceof AggregateError) {
     *     console.log(`${err.errors.length} observer(s) failed`);
     *   }
     * }
     * ```
     *
     * @see AggregateError
     * @since 2.0.0
     */

    error(err: unknown): void {
        if (this.isCompleted) return;
        const errors: Array<unknown> = [];

        for (const o of [ ...this.observers ]) {
            try {
                o.error?.(err);
            } catch (e) {
                errors.push(e);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `${ errors.length } observer(s) failed in error()`);
        }
    }

    /**
     * Signals completion to all observers and clears all subscriptions.
     *
     * @returns void
     *
     * @throws AggregateError - If one or more observer's `complete` handler throws an error.
     *
     * @remarks
     * This method calls the `complete` handler on all current observers, then clears the
     * observers collection to prevent further emissions. If an observer's complete handler
     * throws an error, it is caught and collected. All errors from handlers are thrown
     * together as an {@link AggregateError} after all observers have been notified.
     *
     * If an observer does not provide a complete handler, it is skipped without any effect.
     *
     * The observers are iterated over a snapshot of the collection to allow safe completion.
     * After completion, the subject will accept no further emissions and new subscribers
     * will immediately receive the complete notification.
     *
     * @example
     * ```ts
     * const subject = new SubjectService<number>();
     *
     * subject.subscribe({
     *   complete: () => console.log('Observer A completed')
     * });
     *
     * subject.subscribe({
     *   complete: () => { throw new Error('Handler failed'); }
     * });
     *
     * try {
     *   subject.complete();
     * } catch (err) {
     *   if (err instanceof AggregateError) {
     *     console.log(`${err.errors.length} observer(s) failed`);
     *   }
     * }
     * ```
     *
     * @see AggregateError
     * @since 2.0.0
     */

    complete(): void {
        if (this.isCompleted) return;
        const errors: Array<unknown> = [];


        for (const o of [ ...this.observers ]) {
            try {
                o.complete?.();
            } catch (err) {
                errors.push(err);
            }
        }

        this.observers.clear();
        this.isCompleted = true;
        if (errors.length > 0) {
            throw new AggregateError(errors, `${ errors.length } observer(s) failed in complete()`);
        }
    }
}
