
/**
 * Import will remove at compile time
 */

import type { ObserverInterface } from '@observable/interfaces/observable.interface';

/**
 * Imports
 */

import { ObservableService } from './observable.service';

/**
 * Tests
 */

describe('ObservableService', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor and basic subscription', () => {
        test('should call handler immediately on subscribe', () => {
            const handler = xJet.fn((observer: ObserverInterface<any>) => {
                observer.next?.(42);
            });
            const service = new ObservableService(handler);
            const callback = xJet.fn();

            service.subscribe(callback);

            expect(handler).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(42);
        });

        test('should support subscribing with observer object', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(10);
                observer.next?.(20);
            });
            const observer: ObserverInterface<any> = {
                next: xJet.fn()
            };

            service.subscribe(observer);

            expect(observer.next).toHaveBeenCalledTimes(2);
            expect(observer.next).toHaveBeenNthCalledWith(1, 10);
            expect(observer.next).toHaveBeenNthCalledWith(2, 20);
        });

        test('should support subscribing with callback function', () => {
            const service = new ObservableService<string>((observer) => {
                observer.next?.('hello');
                observer.next?.('world');
            });
            const callback = xJet.fn();

            service.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 'hello');
            expect(callback).toHaveBeenNthCalledWith(2, 'world');
        });

        test('should support subscribing with separate error and complete handlers', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.complete?.();
            });
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            service.subscribe(next, error, complete);

            expect(next).toHaveBeenCalledTimes(2);
            expect(complete).toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });

        test('should handle empty subscription', () => {
            const handler = xJet.fn((observer: ObserverInterface<any>) => {
                observer.next?.(99);
            });
            const service = new ObservableService(handler);

            expect(() => service.subscribe()).not.toThrow();
            expect(handler).toHaveBeenCalled();
        });
    });

    describe('handler cleanup and unsubscription', () => {
        test('should return unsubscribe function from subscribe', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const unsub = service.subscribe(() => {});

            expect(typeof unsub).toBe('function');
        });

        test('should call cleanup function on unsubscribe', () => {
            const cleanup = xJet.fn();
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);

                return cleanup;
            });
            const unsub = service.subscribe(() => {});

            expect(cleanup).not.toHaveBeenCalled();
            unsub();
            expect(cleanup).toHaveBeenCalledTimes(1);
        });

        test('should handle handler that returns no cleanup', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const unsub = service.subscribe(() => {});

            expect(() => unsub()).not.toThrow();
        });

        test('should call observer error handler if cleanup throws', () => {
            const cleanupError = new Error('Cleanup failed');
            const service = new ObservableService<number>(() => {
                return () => {
                    throw cleanupError;
                };
            });
            const errorHandler = xJet.fn();

            service.subscribe({
                error: errorHandler
            }).call(undefined);

            expect(errorHandler).toHaveBeenCalledWith(cleanupError);
        });

        test('should handle multiple subscriptions independently', () => {
            const handler = xJet.fn((observer: ObserverInterface<any>) => {
                observer.next?.(1);
            });
            const service = new ObservableService(handler);
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            service.subscribe(callback1);
            service.subscribe(callback2);

            expect(handler).toHaveBeenCalledTimes(2);
            expect(callback1).toHaveBeenCalledWith(1);
            expect(callback2).toHaveBeenCalledWith(1);
        });
    });

    describe('error handling', () => {
        test('should call error handler when handler throws', () => {
            const thrownError = new Error('Handler error');
            const service = new ObservableService<number>(() => {
                throw thrownError;
            });
            const errorHandler = xJet.fn();

            service.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalledWith(thrownError);
        });

        test('should call error handler when observer.next throws', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const nextError = new Error('Next handler error');
            const errorHandler = xJet.fn();

            service.subscribe({
                next: () => {
                    throw nextError;
                },
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalledWith(nextError);
        });

        test('should call observer error handler on explicit error emission', () => {
            const service = new ObservableService<number>((observer) => {
                const err = new Error('Observable error');
                observer.error?.(err);
            });
            const errorHandler = xJet.fn();

            service.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalledTimes(1);
            expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        });

        test('should handle errors of various types', () => {
            const service = new ObservableService<number>((observer) => {
                observer.error?.('String error');
            });
            const errorHandler = xJet.fn();

            service.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalledWith('String error');
        });

        test('should not throw if no error handler is provided', () => {
            const service = new ObservableService<number>(() => {
                throw new Error('Unhandled error');
            });

            expect(() => service.subscribe(() => {})).not.toThrow();
        });
    });

    describe('completion handling', () => {
        test('should call complete handler when observer.complete is called', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
                observer.complete?.();
            });
            const completeHandler = xJet.fn();

            service.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalledTimes(1);
        });

        test('should support next and complete handlers together', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.complete?.();
            });
            const nextHandler = xJet.fn();
            const completeHandler = xJet.fn();

            service.subscribe(nextHandler, undefined, completeHandler);

            expect(nextHandler).toHaveBeenCalledTimes(3);
            expect(completeHandler).toHaveBeenCalledTimes(1);
        });

        test('should handle observable that never completes', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const completeHandler = xJet.fn();

            service.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).not.toHaveBeenCalled();
        });

        test('should not throw if complete handler is not provided', () => {
            const service = new ObservableService<number>((observer) => {
                observer.complete?.();
            });

            expect(() => service.subscribe(() => {})).not.toThrow();
        });
    });

    describe('pipe operator single overload', () => {
        test('should apply single operator', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
            });
            const doubleOperator = (src: ObservableService<number>) => new ObservableService<number>((observer) => {
                src.subscribe((value: number) => observer.next?.(value * 2));
            });

            const piped = source.pipe(doubleOperator);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(10);
        });

        test('should transform type with single operator', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const stringify = (src: ObservableService<number>) => new ObservableService<string>((observer) => {
                src.subscribe((value: number) => observer.next?.(String(value)));
            });

            const piped = source.pipe(stringify);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('42');
        });
    });

    describe('pipe operator dual overload', () => {
        test('should chain two operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(3);
            });
            const double = (src: ObservableService<number>) => new ObservableService<number>((observer) => {
                src.subscribe((v: number) => observer.next?.(v * 2));
            });
            const addFive = (src: ObservableService<number>) => new ObservableService<number>((observer) => {
                src.subscribe((v: number) => observer.next?.(v + 5));
            });

            const piped = source.pipe(double, addFive);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(11);
        });

        test('should handle type transformation across two operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(100);
            });
            const stringify = (src: ObservableService<number>) => new ObservableService<string>((observer) => {
                src.subscribe((v: number) => observer.next?.(String(v)));
            });
            const uppercase = (src: ObservableService<string>) => new ObservableService<string>((observer) => {
                src.subscribe((v: string) => observer.next?.(v.toUpperCase()));
            });

            const piped = source.pipe(stringify, uppercase);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('100');
        });
    });

    describe('pipe operator triple overload', () => {
        test('should chain three operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(2);
            });
            const op1 = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe((v: number) => obs.next?.(v * 2));
            });
            const op2 = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe((v: number) => obs.next?.(v + 3));
            });
            const op3 = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe((v: number) => obs.next?.(v * 5));
            });

            const piped = source.pipe(op1, op2, op3);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(35);
        });
    });

    describe('pipe operator quad overload', () => {
        test('should chain four operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
            });
            const ops = [
                (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v + 1));
                }),
                (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v * 2));
                }),
                (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v - 1));
                }),
                (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v / 2));
                })
            ];

            const piped = source.pipe(...ops);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(1.5);
        });
    });

    describe('pipe operator variadic overload', () => {
        test('should chain five operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
            });
            const ops = Array.from({ length: 5 }, () => (src: ObservableService<number>) =>
                new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v + 1));
                })
            );

            const piped = source.pipe(...ops);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(6);
        });

        test('should chain many operators', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(10);
            });
            const createOp = (multiplier: number) => (src: ObservableService<number>) =>
                new ObservableService<number>((obs) => {
                    src.subscribe((v: number) => obs.next?.(v * multiplier));
                });

            const piped = source.pipe(
                createOp(2),
                createOp(3),
                createOp(1),
                createOp(2)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(120);
        });
    });

    describe('normalizeObserver helper', () => {
        test('should normalize observer object', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const observer = {
                next: xJet.fn(),
                error: xJet.fn(),
                complete: xJet.fn()
            };

            service.subscribe(observer);

            expect(observer.next).toHaveBeenCalledWith(42);
        });

        test('should normalize callback function with handlers', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.complete?.();
            });
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            service.subscribe(next, error, complete);

            expect(next).toHaveBeenCalledWith(1);
            expect(complete).toHaveBeenCalled();
        });

        test('should normalize empty observer', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });

            expect(() => service.subscribe()).not.toThrow();
        });

        test('should normalize partial observer', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
                observer.complete?.();
            });
            const observer = {
                next: xJet.fn()
            };

            service.subscribe(observer as any);

            expect(observer.next).toHaveBeenCalledWith(42);
        });
    });

    describe('complex scenarios', () => {
        test('should handle multiple emissions with operator chain', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const double = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe((v: number) => obs.next?.(v * 2));
            });

            const piped = source.pipe(double);
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 2);
            expect(callback).toHaveBeenNthCalledWith(2, 4);
            expect(callback).toHaveBeenNthCalledWith(3, 6);
        });

        test('should propagate error through operator chain', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(5);
                observer.error?.(new Error('Test error'));
            });
            const double = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe({
                    next: (v: number) => obs.next?.(v * 2),
                    error: (err) => obs.error?.(err)
                });
            });

            const piped = service.pipe(double);
            const errorHandler = xJet.fn();

            piped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
            expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        });

        test('should handle cleanup in operator chain', () => {
            const cleanup1 = xJet.fn();
            const cleanup2 = xJet.fn();

            const source = new ObservableService<number>((observer) => {
                observer.next?.(42);

                return cleanup1;
            });
            const op = (src: ObservableService<number>) => new ObservableService<number>((observer) => {
                const unsub = src.subscribe((v: number) => observer.next?.(v * 2));

                return () => {
                    cleanup2();
                    unsub();
                };
            });

            const piped = source.pipe(op);
            const unsub = piped.subscribe(() => {});

            unsub();

            expect(cleanup1).toHaveBeenCalled();
            expect(cleanup2).toHaveBeenCalled();
        });

        test('should handle observer with all handlers in complex chain', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.complete?.();
            });
            const double = (src: ObservableService<number>) => new ObservableService<number>((obs) => {
                src.subscribe({
                    next: (v: number) => obs.next?.(v * 2),
                    error: (err) => obs.error?.(err),
                    complete: () => obs.complete?.()
                });
            });

            const piped = source.pipe(double);
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            piped.subscribe(next, error, complete);

            expect(next).toHaveBeenCalledTimes(2);
            expect(next).toHaveBeenNthCalledWith(1, 2);
            expect(next).toHaveBeenNthCalledWith(2, 4);
            expect(complete).toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });
    });

    describe('edge cases and robustness', () => {
        test('should handle null values', () => {
            const service = new ObservableService<number | null>((observer) => {
                observer.next?.(null);
                observer.next?.(42);
                observer.next?.(null);
            });
            const callback = xJet.fn();

            service.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, null);
            expect(callback).toHaveBeenNthCalledWith(3, null);
        });

        test('should handle undefined values', () => {
            const service = new ObservableService<number | undefined>((observer) => {
                observer.next?.(undefined);
                observer.next?.(42);
            });
            const callback = xJet.fn();

            service.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, undefined);
        });

        test('should handle rapid successive subscriptions', () => {
            let emissionCount = 0;
            const service = new ObservableService<number>((observer) => {
                emissionCount++;
                observer.next?.(emissionCount);
            });

            const callbacks = Array.from({ length: 10 }, () => xJet.fn());
            callbacks.forEach((cb) => service.subscribe(cb));

            expect(emissionCount).toBe(10);
            callbacks.forEach((cb, index) => {
                expect(cb).toHaveBeenCalledWith(index + 1);
            });
        });

        test('should handle handler that returns void', () => {
            const service = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const callback = xJet.fn();

            expect(() => {
                const unsub = service.subscribe(callback);
                unsub();
            }).not.toThrow();

            expect(callback).toHaveBeenCalledWith(42);
        });
    });
});
