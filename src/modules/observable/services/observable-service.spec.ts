/**
 * Imports
 */

import { Observable } from '@observable/observable.module';

/**
 * Tests
 */

describe('Observable', () => {
    beforeAll(() => {
        xJet.useFakeTimers();   // crucial for timer tests
    });

    afterAll(() => {
        xJet.useRealTimers();
    });

    describe('basic subscription', () => {
        test('should call next for each emitted value', () => {
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            const obs = new Observable<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.complete?.();
            });

            obs.subscribe({
                next,
                error,
                complete
            });

            expect(next).toHaveBeenCalledTimes(3);
            expect(next).toHaveBeenNthCalledWith(1, 1);
            expect(next).toHaveBeenNthCalledWith(2, 2);
            expect(next).toHaveBeenNthCalledWith(3, 3);
            expect(complete).toHaveBeenCalledTimes(1);
            expect(error).not.toHaveBeenCalled();
        });

        test('should support function-only subscription (next only)', () => {
            const next = xJet.fn();

            const obs = new Observable<string>((observer) => {
                observer.next?.('hello');
                observer.next?.('world');
            });

            obs.subscribe(next);

            expect(next).toHaveBeenCalledTimes(2);
            expect(next).toHaveBeenNthCalledWith(1, 'hello');
            expect(next).toHaveBeenNthCalledWith(2, 'world');
        });

        test('should call error handler when thrown inside subscribe setup', () => {
            const errorHandler = xJet.fn();
            const error = new Error('boom!');

            const obs = new Observable<number>(() => {
                throw error;
            });

            obs.subscribe({
                next: xJet.fn(),
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
            expect(errorHandler).toHaveBeenCalledWith(error);
        });
    });

    describe('unsubscribe', () => {
        test('should call cleanup function when unsubscribing', () => {
            const cleanup = xJet.fn();

            const obs = new Observable<number>((observer) => {
                observer.next?.(42);

                return cleanup;
            });

            const sub = obs.subscribe((v) => {
                expect(v).toBe(42);
            });

            sub();

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        test('should not call next after unsubscribe', () => {
            const next = xJet.fn();

            let emit: null | ((v: number) => void) = () => {};
            const obs = new Observable<number>((observer) => {
                emit = (v) => observer.next?.(v);

                return () => {
                    emit = null;
                };
            });

            const unsubscribe = obs.subscribe(next);

            emit(1);
            expect(next).toHaveBeenCalledWith(1);

            unsubscribe();
            emit?.(2);
            emit?.(3);

            expect(next).toHaveBeenCalledTimes(1);
        });

        test('should stop delivering values after unsubscribe', () => {
            const cleanup = xJet.fn();

            const obs = new Observable<number>((observer) => {
                setInterval(() => observer.next?.(1), 100);

                return cleanup;
            });

            const sub = obs.subscribe(() => {});

            xJet.advanceTimersByTime(150);
            sub();
            xJet.advanceTimersByTime(500);

            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        test('should handle error in cleanup gracefully', () => {
            const errorHandler = xJet.fn();

            const obs = new Observable<number>(() => {
                return () => {
                    throw new Error('cleanup failed');
                };
            });

            const sub = obs.subscribe({
                next: () => {
                },
                error: errorHandler
            });

            sub();

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('pipe / operators', () => {
        test('pipe() with no operators returns the same observable', () => {
            const obs = new Observable<number>((o) => o.next?.(100));
            const piped = obs.pipe();

            expect(piped).toBe(obs);
        });

        test('should correctly chain one operator', () => {
            const double = (source: Observable<number>): Observable<number> =>
                new Observable((observer) => {
                    return source.subscribe({
                        next: (v) => observer.next?.(v * 2),
                        error: (e) => observer.error?.(e),
                        complete: () => observer.complete?.()
                    });
                });

            const next = xJet.fn();

            const obs = new Observable<number>((o) => {
                o.next?.(5);
                o.next?.(10);
                o.complete?.();
            });

            obs.pipe(double).subscribe(next);

            expect(next).toHaveBeenNthCalledWith(1, 10);
            expect(next).toHaveBeenNthCalledWith(2, 20);
        });

        test('should chain multiple operators', () => {
            const add2 = (src: Observable<number>) =>
                new Observable<number>((obs) =>
                    src.subscribe({
                        next: (v) => obs.next?.(v + 2)
                    })
                );

            const times3 = (src: Observable<number>) =>
                new Observable<number>((obs) =>
                    src.subscribe({
                        next: (v) => obs.next?.(v * 3)
                    })
                );

            const values: number[] = [];

            new Observable<number>((o) => {
                o.next?.(1);
                o.next?.(4);
                o.complete?.();
            })
                .pipe(add2, times3)
                .subscribe((v: number) => values.push(v));

            expect(values).toEqual([ 9, 18 ]); // (1+2)*3 = 9, (4+2)*3 = 18
        });

        test('pipe with many operators infers type (smoke test)', () => {
            // Just checking that it compiles and runs
            const obs = new Observable<string>((o) => o.next?.('hello'));

            const upper = (s: Observable<string>) =>
                new Observable<string>((o) =>
                    s.subscribe((v) => o.next?.(v.toUpperCase()))
                );

            const exclaim = (s: Observable<string>) =>
                new Observable<string>((o) => s.subscribe((v) => o.next?.(v + '!')));

            obs.pipe(upper, exclaim, upper).subscribe((v: string) => {
                expect(v).toBe('HELLO!!');
            });
        });
    });

    describe('edge cases', () => {
        test('should handle observer with missing methods gracefully', () => {
            const next = xJet.fn();

            const obs = new Observable<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.complete?.();
            });

            // incomplete observer
            obs.subscribe({
                next
                // missing error & complete
            });

            expect(next).toHaveBeenCalledTimes(2);
        });

        test('should not crash when error is called but no handler', () => {
            const obs = new Observable<number>((observer) => {
                observer.error?.(new Error('oops'));
            });

            expect(() => {
                obs.subscribe(() => {
                });
            }).not.toThrow();
        });
    });
});
