/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ObserverInterface } from '@observable/observable.module';

/**
 * Imports
 */

import { ObservableService } from '@observable/services/observable.service';

/**
 * A multicast stream that is both an observable and an observer.
 *
 * @template T - The type of values emitted by the subject.
 *
 * @remarks
 * Unlike {@link ObservableService}, which runs its handler once per subscriber, a subject shares a single emission
 * sequence across all current observers. Values are pushed directly through {@link next}, {@link error}, and
 * {@link complete}. Unsubscribing removes the observer from the active set.
 *
 * @example
 * ```ts
 * const subject = new SubjectService<number>();
 * subject.subscribe(v => console.log('A', v));
 * subject.subscribe(v => console.log('B', v));
 * subject.next(42); // both observers receive 42
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
     * Whether the subject has completed.
     *
     * @remarks
     * Once completed, emissions are ignored and new subscribers receive completion immediately.
     *
     * @since 2.0.0
     */

    protected isCompleted = false;

    /**
     * The set of currently subscribed observers notified on each emission.
     *
     * @see ObserverInterface
     * @since 2.0.0
     */

    private observers = new Set<ObserverInterface<T>>();

    /**
     * Creates a subject that registers each subscriber in its observer set.
     *
     * @remarks
     * The subscription handler adds the observer to the set and returns a teardown that removes it. Subscribing after
     * completion delivers completion immediately and registers nothing.
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
     * Emits a value to all current observers.
     *
     * @param value - The value to emit.
     *
     * @throws AggregateError - When one or more observer `next` handlers throw.
     *
     * @remarks
     * No-op once completed. A throwing `next` handler is forwarded to that observer's `error` handler, and all
     * failures are rethrown together as an {@link AggregateError}.
     *
     * @see AggregateError
     * @since 2.0.0
     */

    next(value: T): void {
        if (this.isCompleted) return;

        this.broadcast('next', (observer) => {
            try {
                observer.next?.(value);
            } catch (err) {
                try {
                    observer.error?.(err);
                } catch { /* ignore a secondary failure from the error handler */ }

                throw err;
            }
        });
    }

    /**
     * Emits an error to all current observers.
     *
     * @param err - The error to emit.
     *
     * @throws AggregateError - When one or more observer `error` handlers throw.
     *
     * @remarks
     * No-op once completed. Observers without an `error` handler are skipped; handler failures are rethrown together
     * as an {@link AggregateError}.
     *
     * @see AggregateError
     * @since 2.0.0
     */

    error(err: unknown): void {
        if (this.isCompleted) return;

        this.broadcast('error', (observer) => observer.error?.(err));
    }

    /**
     * Completes the subject, notifying observers and clearing all subscriptions.
     *
     * @throws AggregateError - When one or more observer `complete` handlers throw.
     *
     * @remarks
     * No-op if already completed. Observers are notified, the set is cleared, and the subject is marked completed even
     * when a handler throws; failures are rethrown together as an {@link AggregateError}. Subsequent subscribers
     * receive completion immediately.
     *
     * @see AggregateError
     * @since 2.0.0
     */

    complete(): void {
        if (this.isCompleted) return;

        try {
            this.broadcast('complete', (observer) => observer.complete?.());
        } finally {
            this.observers.clear();
            this.isCompleted = true;
        }
    }

    /**
     * Notifies every current observer, collecting any handler failures.
     *
     * @param method - Name of the emission, used in the thrown error message.
     * @param notify - Applied to each observer in the snapshot.
     *
     * @throws AggregateError - When one or more observer handlers throw.
     *
     * @remarks
     * Iterates a snapshot of the observer set so handlers may subscribe or unsubscribe during emission without
     * disturbing iteration. Failures are gathered and rethrown together once every observer has been notified.
     *
     * @see AggregateError
     * @since 2.6.0
     */

    private broadcast(method: string, notify: (observer: ObserverInterface<T>) => void): void {
        const errors: Array<unknown> = [];

        for (const observer of [ ...this.observers ]) {
            try {
                notify(observer);
            } catch (err) {
                errors.push(err);
            }
        }

        if (errors.length > 0) {
            throw new AggregateError(errors, `${ errors.length } observer(s) failed in ${ method }()`);
        }
    }
}
