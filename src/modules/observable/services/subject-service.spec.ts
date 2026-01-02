/**
 * Imports
 */

import { SubjectService } from '@observable/services/subject.service';

/**
 * Tests
 */

describe('SubjectService', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor and initialization', () => {
        test('should initialize with empty observers collection', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).not.toHaveBeenCalled();
        });

        test('should not emit values until next is called', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('subscribe and observer management', () => {
        test('should add observer to collection on subscribe', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);
            subject.next(42);

            expect(callback).toHaveBeenCalledWith(42);
        });

        test('should support multiple observers', () => {
            const subject = new SubjectService<number>();
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();
            const callback3 = xJet.fn();

            subject.subscribe(callback1);
            subject.subscribe(callback2);
            subject.subscribe(callback3);

            subject.next(100);

            expect(callback1).toHaveBeenCalledWith(100);
            expect(callback2).toHaveBeenCalledWith(100);
            expect(callback3).toHaveBeenCalledWith(100);
        });

        test('should return unsubscribe function', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            const unsub = subject.subscribe(callback);

            expect(typeof unsub).toBe('function');
        });

        test('should remove observer on unsubscribe', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            const unsub = subject.subscribe(callback);
            subject.next(1);
            expect(callback).toHaveBeenCalledWith(1);

            unsub();
            callback.mockClear();

            subject.next(2);
            expect(callback).not.toHaveBeenCalled();
        });

        test('should support unsubscribing individual observers', () => {
            const subject = new SubjectService<number>();
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            const unsub1 = subject.subscribe(callback1);
            subject.subscribe(callback2);

            unsub1();
            subject.next(42);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith(42);
        });

        test('should support observer object', () => {
            const subject = new SubjectService<number>();
            const observer = {
                next: xJet.fn()
            };

            subject.subscribe(observer);
            subject.next(99);

            expect(observer.next).toHaveBeenCalledWith(99);
        });

        test('should support callback with separate handlers', () => {
            const subject = new SubjectService<number>();
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            subject.subscribe(next, error, complete);

            subject.next(50);
            expect(next).toHaveBeenCalledWith(50);

            subject.complete();
            expect(complete).toHaveBeenCalled();
        });

        test('should support partial observer', () => {
            const subject = new SubjectService<number>();
            const observer = {
                next: xJet.fn()
            };

            subject.subscribe(observer as any);
            subject.next(77);

            expect(observer.next).toHaveBeenCalledWith(77);
        });

        test('should support empty subscription', () => {
            const subject = new SubjectService<number>();

            expect(() => subject.subscribe()).not.toThrow();

            expect(() => subject.next(42)).not.toThrow();
        });
    });

    describe('next method - value emission', () => {
        test('should emit value to all subscribers', () => {
            const subject = new SubjectService<number>();
            const callbacks = Array.from({ length: 5 }, () => xJet.fn());

            callbacks.forEach((cb) => subject.subscribe(cb));

            subject.next(123);

            callbacks.forEach((cb) => {
                expect(cb).toHaveBeenCalledWith(123);
                expect(cb).toHaveBeenCalledTimes(1);
            });
        });

        test('should emit multiple values sequentially', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            subject.next(1);
            subject.next(2);
            subject.next(3);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 1);
            expect(callback).toHaveBeenNthCalledWith(2, 2);
            expect(callback).toHaveBeenNthCalledWith(3, 3);
        });

        test('should handle null values', () => {
            const subject = new SubjectService<number | null>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            subject.next(null);
            subject.next(42);
            subject.next(null);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, null);
            expect(callback).toHaveBeenNthCalledWith(3, null);
        });

        test('should handle undefined values', () => {
            const subject = new SubjectService<number | undefined>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            subject.next(undefined);
            subject.next(42);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, undefined);
        });

        test('should handle complex object types', () => {
            interface DataTypeInterface {
                id: number;
                name: string;
            }

            const subject = new SubjectService<DataTypeInterface>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            const data: DataTypeInterface = { id: 1, name: 'test' };
            subject.next(data);

            expect(callback).toHaveBeenCalledWith(data);
        });

        test('should handle array types', () => {
            const subject = new SubjectService<number[]>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            const array = [ 1, 2, 3 ];
            subject.next(array);

            expect(callback).toHaveBeenCalledWith(array);
        });
    });

    describe('next method - error handling', () => {
        test('should catch observer next handler errors', () => {
            const subject = new SubjectService<number>();
            const error = new Error('Handler error');
            const observer = {
                next: () => {
                    throw error;
                }
            };

            subject.subscribe(observer);

            expect(() => subject.next(42)).toThrow(AggregateError);
        });

        test('should pass error to observer error handler', () => {
            const subject = new SubjectService<number>();
            const nextError = new Error('Next handler error');
            const errorHandler = xJet.fn();
            const observer = {
                next: () => {
                    throw nextError;
                },
                error: errorHandler
            };

            subject.subscribe(observer);

            expect(() => subject.next(42)).toThrow(AggregateError);
            expect(errorHandler).toHaveBeenCalledWith(nextError);
        });

        test('should continue notifying other observers after error', () => {
            const subject = new SubjectService<number>();
            const callback1 = () => {
                throw new Error('First error');
            };
            const callback2 = xJet.fn();

            subject.subscribe(callback1);
            subject.subscribe(callback2);

            expect(() => subject.next(42)).toThrow(AggregateError);
            expect(callback2).toHaveBeenCalledWith(42);
        });

        test('should collect multiple errors in AggregateError', () => {
            const subject = new SubjectService<number>();
            const error1 = new Error('Error 1');
            const error2 = new Error('Error 2');

            subject.subscribe({
                next: () => {
                    throw error1;
                }
            });

            subject.subscribe({
                next: () => {
                    throw error2;
                }
            });

            try {
                subject.next(99);
            } catch (err) {
                expect(err).toBeInstanceOf(AggregateError);
                expect((err as AggregateError).errors).toHaveLength(2);
                expect((err as AggregateError).message).toContain('2 observer(s) failed');
            }
        });

        test('should suppress error handler exceptions', () => {
            const subject = new SubjectService<number>();
            const errorHandler = xJet.fn(() => {
                throw new Error('Error handler error');
            });

            subject.subscribe({
                next: () => {
                    throw new Error('Initial error');
                },
                error: errorHandler
            });

            expect(() => subject.next(42)).toThrow(AggregateError);
        });
    });

    describe('error method - error emission', () => {
        test('should emit error to all observers', () => {
            const subject = new SubjectService<number>();
            const errorHandler1 = xJet.fn();
            const errorHandler2 = xJet.fn();

            subject.subscribe({
                error: errorHandler1
            });
            subject.subscribe({
                error: errorHandler2
            });

            const testError = new Error('Test error');
            subject.error(testError);

            expect(errorHandler1).toHaveBeenCalledWith(testError);
            expect(errorHandler2).toHaveBeenCalledWith(testError);
        });

        test('should not throw if observer has no error handler', () => {
            const subject = new SubjectService<number>();
            subject.subscribe(() => {});

            const testError = new Error('Unhandled error');

            expect(() => subject.error(testError)).not.toThrow();
        });

        test('should handle various error types', () => {
            const subject = new SubjectService<number>();
            const errorHandler = xJet.fn();

            subject.subscribe({
                error: errorHandler
            });

            const stringError = 'String error';
            subject.error(stringError);

            expect(errorHandler).toHaveBeenCalledWith(stringError);
        });

        test('should throw AggregateError if error handler throws', () => {
            const subject = new SubjectService<number>();
            const handlerError = new Error('Handler error');

            subject.subscribe({
                error: () => {
                    throw handlerError;
                }
            });

            expect(() => subject.error(new Error('Initial error'))).toThrow(AggregateError);
        });

        test('should collect multiple errors from error handlers', () => {
            const subject = new SubjectService<number>();
            const error1 = new Error('Handler 1 error');
            const error2 = new Error('Handler 2 error');

            subject.subscribe({
                error: () => {
                    throw error1;
                }
            });

            subject.subscribe({
                error: () => {
                    throw error2;
                }
            });

            try {
                subject.error(new Error('Initial error'));
            } catch (err) {
                expect(err).toBeInstanceOf(AggregateError);
                expect((err as AggregateError).errors).toHaveLength(2);
                expect((err as AggregateError).message).toContain('2 observer(s) failed');
            }
        });

        test('should continue notifying other observers after error handler failure', () => {
            const subject = new SubjectService<number>();
            const errorHandler1 = () => {
                throw new Error('Handler error');
            };
            const errorHandler2 = xJet.fn();

            subject.subscribe({
                error: errorHandler1
            });
            subject.subscribe({
                error: errorHandler2
            });

            expect(() => subject.error(new Error('Test error'))).toThrow(AggregateError);
            expect(errorHandler2).toHaveBeenCalled();
        });
    });

    describe('complete method - completion', () => {
        test('should emit complete to all observers', () => {
            const subject = new SubjectService<number>();
            const completeHandler1 = xJet.fn();
            const completeHandler2 = xJet.fn();

            subject.subscribe({
                complete: completeHandler1
            });
            subject.subscribe({
                complete: completeHandler2
            });

            subject.complete();

            expect(completeHandler1).toHaveBeenCalled();
            expect(completeHandler2).toHaveBeenCalled();
        });

        test('should clear observers collection after completion', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);
            subject.next(1);
            callback.mockClear();

            subject.complete();
            subject.next(2);

            expect(callback).not.toHaveBeenCalled();
        });

        test('should handle observers without complete handler', () => {
            const subject = new SubjectService<number>();
            subject.subscribe(() => {});

            expect(() => subject.complete()).not.toThrow();
        });

        test('should handle empty subject completion', () => {
            const subject = new SubjectService<number>();

            expect(() => subject.complete()).not.toThrow();
        });

        test('should throw AggregateError if complete handler throws', () => {
            const subject = new SubjectService<number>();
            const handlerError = new Error('Handler error');

            subject.subscribe({
                complete: () => {
                    throw handlerError;
                }
            });

            expect(() => subject.complete()).toThrow(AggregateError);
        });

        test('should collect multiple errors from complete handlers', () => {
            const subject = new SubjectService<number>();
            const error1 = new Error('Complete 1 error');
            const error2 = new Error('Complete 2 error');

            subject.subscribe({
                complete: () => {
                    throw error1;
                }
            });

            subject.subscribe({
                complete: () => {
                    throw error2;
                }
            });

            try {
                subject.complete();
            } catch (err) {
                expect(err).toBeInstanceOf(AggregateError);
                expect((err as AggregateError).errors).toHaveLength(2);
                expect((err as AggregateError).message).toContain('2 observer(s) failed');
            }
        });

        test('should continue notifying other observers after complete handler failure', () => {
            const subject = new SubjectService<number>();
            const completeHandler1 = () => {
                throw new Error('Handler error');
            };
            const completeHandler2 = xJet.fn();

            subject.subscribe({
                complete: completeHandler1
            });
            subject.subscribe({
                complete: completeHandler2
            });

            expect(() => subject.complete()).toThrow(AggregateError);
            expect(completeHandler2).toHaveBeenCalled();
        });
    });

    describe('complex subscription scenarios', () => {
        test('should handle observer with all handlers', () => {
            const subject = new SubjectService<number>();
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            subject.subscribe({ next, error, complete });

            subject.next(42);
            expect(next).toHaveBeenCalledWith(42);

            subject.complete();
            expect(complete).toHaveBeenCalled();
            expect(error).not.toHaveBeenCalled();
        });

        test('should handle subscription during emission', () => {
            const subject = new SubjectService<number>();
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            subject.subscribe((value) => {
                callback1(value);
                subject.subscribe(callback2);
            });

            subject.next(1);

            expect(callback1).toHaveBeenCalledWith(1);
            expect(callback2).not.toHaveBeenCalled();

            callback1.mockClear();
            subject.next(2);

            expect(callback1).toHaveBeenCalledWith(2);
            expect(callback2).toHaveBeenCalledWith(2);
        });

        test('should handle unsubscribe during emission', () => {
            const subject = new SubjectService<number>();
            let unsub: (() => boolean) | null = null;
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            subject.subscribe((value) => {
                callback1(value);
                if (unsub) unsub();
            });
            unsub = subject.subscribe(callback2) as any;

            subject.next(42);

            expect(callback1).toHaveBeenCalledWith(42);
            expect(callback2).toHaveBeenCalledWith(42);

            callback1.mockClear();
            callback2.mockClear();

            subject.next(99);

            expect(callback1).toHaveBeenCalledWith(99);
            expect(callback2).not.toHaveBeenCalled();
        });

        test('should handle rapid successive emissions', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            for (let i = 0; i < 100; i++) {
                subject.next(i);
            }

            expect(callback).toHaveBeenCalledTimes(100);
            expect(callback).toHaveBeenLastCalledWith(99);
        });

        test('should handle mixed next and error emissions', () => {
            const subject = new SubjectService<number>();
            const next = xJet.fn();
            const error = xJet.fn();

            subject.subscribe({ next, error });

            subject.next(1);
            subject.next(2);

            const testError = new Error('Test');
            subject.error(testError);

            expect(next).toHaveBeenCalledTimes(2);
            expect(error).toHaveBeenCalledWith(testError);
        });
    });

    describe('pub-sub pattern', () => {
        test('should work as event bus', () => {
            const eventBus = new SubjectService<{ type: string; payload: any }>();
            const listeners = Array.from({ length: 3 }, () => xJet.fn());

            listeners.forEach((listener) => eventBus.subscribe(listener));

            const event = { type: 'click', payload: { x: 10, y: 20 } };
            eventBus.next(event);

            listeners.forEach((listener) => {
                expect(listener).toHaveBeenCalledWith(event);
            });
        });

        test('should support late subscribers', () => {
            const subject = new SubjectService<number>();
            const earlyCallback = xJet.fn();
            const lateCallback = xJet.fn();

            subject.subscribe(earlyCallback);
            subject.next(1);

            subject.subscribe(lateCallback);
            subject.next(2);

            expect(earlyCallback).toHaveBeenCalledTimes(2);
            expect(lateCallback).toHaveBeenCalledTimes(1);
            expect(lateCallback).toHaveBeenCalledWith(2);
        });

        test('should support dynamic subscriber management', () => {
            const subject = new SubjectService<number>();
            const unsubs = Array.from({ length: 5 }, () => {
                const callback = xJet.fn();
                const unsub = subject.subscribe(callback);

                return { callback, unsub };
            });

            subject.next(1);
            unsubs.forEach(({ callback }) => {
                expect(callback).toHaveBeenCalledWith(1);
            });

            unsubs[0].unsub();
            unsubs[2].unsub();

            unsubs.forEach(({ callback }) => callback.mockClear());

            subject.next(2);

            expect(unsubs[0].callback).not.toHaveBeenCalled();
            expect(unsubs[1].callback).toHaveBeenCalledWith(2);
            expect(unsubs[2].callback).not.toHaveBeenCalled();
            expect(unsubs[3].callback).toHaveBeenCalledWith(2);
            expect(unsubs[4].callback).toHaveBeenCalledWith(2);
        });
    });

    describe('edge cases and robustness', () => {
        test('should handle subject after complete', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);
            subject.complete();

            expect(() => subject.next(42)).not.toThrow();
            expect(callback).not.toHaveBeenCalled();
        });

        test('should handle multiple complete calls', () => {
            const subject = new SubjectService<number>();
            const completeHandler = xJet.fn();

            subject.subscribe({
                complete: completeHandler
            });

            subject.complete();
            expect(completeHandler).toHaveBeenCalledTimes(1);

            expect(() => subject.complete()).not.toThrow();
            expect(completeHandler).toHaveBeenCalledTimes(1);
        });

        test('should handle observer unsubscribing from within handler', () => {
            const subject = new SubjectService<number>();
            let unsub: (() => boolean) | null = null;
            const callback = xJet.fn();

            unsub = subject.subscribe((value) => {
                callback(value);
                if (value === 42) unsub?.();
            }) as any;

            subject.next(1);
            subject.next(42);
            subject.next(99);

            expect(callback).toHaveBeenCalledTimes(2);
        });

        test('should handle type conversions', () => {
            const subject = new SubjectService<number>();
            const callback = xJet.fn();

            subject.subscribe(callback);

            subject.next(0);
            subject.next(-1);
            subject.next(Infinity);
            subject.next(NaN);

            expect(callback).toHaveBeenCalledTimes(4);
        });
    });
});
