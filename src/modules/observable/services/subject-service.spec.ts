/**
 * Imports
 */
import { SubjectService } from './subject.service'; // adjust path

/**
 * Tests
 */

describe('SubjectService', () => {
    beforeAll(() => {
        xJet.useFakeTimers();
    });

    afterAll(() => {
        xJet.useRealTimers();
    });

    describe('basic multicasting', () => {
        test('multiple subscribers receive the same values', () => {
            const s = new SubjectService<number>();

            const a = xJet.fn();
            const b = xJet.fn();
            const c = xJet.fn();

            s.subscribe(a);
            s.subscribe(b);
            s.subscribe({ next: c });

            s.next(7);
            s.next(11);

            expect(a).toHaveBeenCalledTimes(2);
            expect(a).toHaveBeenNthCalledWith(1, 7);
            expect(a).toHaveBeenNthCalledWith(2, 11);

            expect(b).toHaveBeenCalledTimes(2);
            expect(c).toHaveBeenCalledTimes(2);
        });

        test('late subscriber does NOT receive previous values', () => {
            const s = new SubjectService<string>();

            const early = xJet.fn();
            s.subscribe(early);

            s.next('first');
            s.next('second');

            const late = xJet.fn();
            s.subscribe(late);

            s.next('third');

            expect(early).toHaveBeenCalledTimes(3);
            expect(late).toHaveBeenCalledTimes(1);
            expect(late).toHaveBeenCalledWith('third');
        });
    });

    describe('unsubscribe', () => {
        test('unsubscribing removes observer — no more notifications', () => {
            const s = new SubjectService<number>();
            const spy = xJet.fn();

            const sub = s.subscribe(spy);

            s.next(1);
            expect(spy).toHaveBeenCalledTimes(1);

            sub();
            s.next(2);
            s.next(3);

            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('unsubscribe during next() is safe (snapshot behavior)', () => {
            const s = new SubjectService<number>();
            const valuesA: number[] = [];
            const valuesB: number[] = [];

            s.subscribe((v) => {
                valuesA.push(v);
                if (v === 2) {
                    subB(); // unsubscribe B while emitting
                }
            });

            const subB = s.subscribe((v) => valuesB.push(v));

            s.next(1);
            s.next(2);
            s.next(3);

            expect(valuesA).toEqual([ 1, 2, 3 ]);
            expect(valuesB).toEqual([ 1, 2 ]); // did not receive 3
        });
    });

    describe('error handling', () => {
        test('error is delivered to all current observers', () => {
            const s = new SubjectService<number>();

            const a = xJet.fn();
            const b = xJet.fn();

            s.subscribe({ error: a });
            s.subscribe({ error: b });

            const err = new Error('test error');
            s.error(err);

            expect(a).toHaveBeenCalledTimes(1);
            expect(a).toHaveBeenCalledWith(err);
            expect(b).toHaveBeenCalledTimes(1);
            expect(b).toHaveBeenCalledWith(err);
        });

        test('throws AggregateError when some error handlers throw', () => {
            const s = new SubjectService<any>();

            s.subscribe({
                error: () => { throw new Error('handler A failed'); }
            });

            s.subscribe({
                error: (e: any) => { throw new Error(`handler B failed: ${ e.message }`); }
            });

            s.subscribe({
                error: () => {} // this one succeeds
            });

            expect(() => {
                s.error(new Error('boom'));
            }).toThrow(AggregateError);

            try { s.error(new Error('boom')); } catch (e: any) {
                expect(e.errors).toHaveLength(2);
            }
        });
    });

    describe('completion', () => {
        test('complete() notifies all observers and clears subscriptions', () => {
            const s = new SubjectService<number>();

            const completeA = xJet.fn();
            const completeB = xJet.fn();

            s.subscribe({ complete: completeA });
            s.subscribe({ complete: completeB });
            s.complete();

            expect(completeA).toHaveBeenCalledTimes(1);
            expect(completeB).toHaveBeenCalledTimes(1);

            // no more notifications after complete
            const spy = xJet.fn();
            s.subscribe(spy);
            s.next(999);
            expect(spy).not.toHaveBeenCalled();
        });

        test('throws AggregateError if some complete handlers throw', () => {
            const s = new SubjectService<string>();

            s.subscribe({ complete: () => { throw new Error('A failed'); } });
            s.subscribe({ complete: () => {} });
            s.subscribe({ complete: () => { throw new Error('C failed'); } });

            expect(() => s.complete()).toThrow(AggregateError);

            // Optional: check message or errors.length
        });
    });

    describe('edge cases', () => {
        test('calling next/error/complete after complete has no effect', () => {
            const s = new SubjectService<number>();
            const spy = xJet.fn();

            s.subscribe(spy);
            s.complete();

            s.next(100);
            s.error(new Error('late error'));
            s.complete();

            expect(spy).not.toHaveBeenCalled();
        });

        test('subject with zero subscribers does not throw on next/error/complete', () => {
            const s = new SubjectService<boolean>();

            expect(() => s.next(true)).not.toThrow();
            expect(() => s.error('oops')).not.toThrow();
            expect(() => s.complete()).not.toThrow();
        });
    });
});
