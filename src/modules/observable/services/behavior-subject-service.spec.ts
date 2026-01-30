/**
 * Imports
 */

import { BehaviorSubjectService } from '@observable/services/behavior-subject.service';

/**
 * Tests
 */

describe('BehaviorSubjectService', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor and initialization', () => {
        test('should initialize with direct value', () => {
            const subject = new BehaviorSubjectService<number>(42);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(42);
        });

        test('should initialize with factory function', () => {
            const factory = xJet.fn(() => 99);
            const subject = new BehaviorSubjectService<number>(factory);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(factory).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(99);
        });

        test('should support factory function with side effects', () => {
            let computedValue = 0;
            const subject = new BehaviorSubjectService<number>(() => {
                computedValue += 10;

                return computedValue;
            });
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(10);
        });

        test('should support string initial value', () => {
            const subject = new BehaviorSubjectService<string>('initial');
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('initial');
        });

        test('should support null initial value', () => {
            const subject = new BehaviorSubjectService<number | null>(null);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(null);
        });

        test('should support undefined initial value', () => {
            const subject = new BehaviorSubjectService<number | undefined>(undefined);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(undefined);
        });

        test('should support complex object initial value', () => {
            interface StateTypeInterface {
                id: number;
                name: string;
            }

            const initialState: StateTypeInterface = { id: 1, name: 'test' };
            const subject = new BehaviorSubjectService<StateTypeInterface>(initialState);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(initialState);
        });
    });

    describe('value getter', () => {
        test('should return initial value', () => {
            const subject = new BehaviorSubjectService<number>(42);

            expect(subject.value).toBe(42);
        });

        test('should return current value after next', () => {
            const subject = new BehaviorSubjectService<number>(10);

            subject.next(20);
            expect(subject.value).toBe(20);

            subject.next(30);
            expect(subject.value).toBe(30);
        });

        test('should return value computed by factory', () => {
            const factory = () => 555;
            const subject = new BehaviorSubjectService<number>(factory);

            expect(subject.value).toBe(555);
        });

        test('should handle multiple value accesses', () => {
            const subject = new BehaviorSubjectService<number>(42);

            expect(subject.value).toBe(42);
            expect(subject.value).toBe(42);
            expect(subject.value).toBe(42);
        });
    });

    describe('subscribe with immediate replay', () => {
        test('should replay initial value to new subscriber', () => {
            const subject = new BehaviorSubjectService<number>(100);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(100);
            expect(callback).toHaveBeenCalledTimes(1);
        });

        test('should replay updated value to late subscriber', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const earlyCallback = xJet.fn();

            subject.subscribe(earlyCallback);
            subject.next(42);

            const lateCallback = xJet.fn();
            subject.subscribe(lateCallback);

            expect(lateCallback).toHaveBeenCalledWith(42);
            expect(lateCallback).toHaveBeenCalledTimes(1);
        });

        test('should replay to multiple late subscribers', () => {
            const subject = new BehaviorSubjectService<number>(0);

            subject.next(100);

            const callbacks = Array.from({ length: 5 }, () => xJet.fn());
            callbacks.forEach((cb) => subject.subscribe(cb));

            callbacks.forEach((cb) => {
                expect(cb).toHaveBeenCalledWith(100);
                expect(cb).toHaveBeenCalledTimes(1);
            });
        });

        test('should support observer object subscription with replay', () => {
            const subject = new BehaviorSubjectService<number>(50);
            const observer = {
                next: xJet.fn()
            };

            subject.subscribe(observer);

            expect(observer.next).toHaveBeenCalledWith(50);
        });

        test('should support callback subscription with separate handlers', () => {
            const subject = new BehaviorSubjectService<number>(75);
            const next = xJet.fn();
            const error = xJet.fn();
            const complete = xJet.fn();

            subject.subscribe(next, error, complete);

            expect(next).toHaveBeenCalledWith(75);
            expect(error).not.toHaveBeenCalled();
            expect(complete).not.toHaveBeenCalled();
        });

        test('should support empty subscription with replay', () => {
            const subject = new BehaviorSubjectService<number>(25);

            expect(() => subject.subscribe()).not.toThrow();
        });

        test('should support partial observer subscription with replay', () => {
            const subject = new BehaviorSubjectService<number>(33);
            const observer = { next: xJet.fn() };

            subject.subscribe(observer as any);

            expect(observer.next).toHaveBeenCalledWith(33);
        });
    });

    describe('next method with state update', () => {
        test('should update internal value', () => {
            const subject = new BehaviorSubjectService<number>(0);

            subject.next(42);

            expect(subject.value).toBe(42);
        });

        test('should emit to current subscribers', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);
            callback.mockClear();

            subject.next(100);

            expect(callback).toHaveBeenCalledWith(100);
        });

        test('should replay updated value to new subscribers', () => {
            const subject = new BehaviorSubjectService<number>(0);

            subject.next(50);

            const callback = xJet.fn();
            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(50);
        });

        test('should handle multiple successive emissions', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);
            callback.mockClear();

            subject.next(1);
            subject.next(2);
            subject.next(3);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(subject.value).toBe(3);
        });

        test('should preserve latest value through emissions', () => {
            const subject = new BehaviorSubjectService<number>(0);

            subject.next(10);
            subject.next(20);
            subject.next(30);

            const callback = xJet.fn();
            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(30);
        });

        test('should handle null value emission', () => {
            const subject = new BehaviorSubjectService<number | null>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);
            callback.mockClear();

            subject.next(null);

            expect(callback).toHaveBeenCalledWith(null);
            expect(subject.value).toBeNull();
        });

        test('should handle undefined value emission', () => {
            const subject = new BehaviorSubjectService<number | undefined>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);
            callback.mockClear();

            subject.next(undefined);

            expect(callback).toHaveBeenCalledWith(undefined);
            expect(subject.value).toBeUndefined();
        });

        test('should throw AggregateError if observer throws', () => {
            const subject = new BehaviorSubjectService<number>(0);

            try {
                subject.subscribe(() => {
                    throw new Error('Observer error');
                });
            } catch {}

            expect(() => subject.next(42)).toThrow(AggregateError);
        });
    });

    describe('multi-subscriber behavior', () => {
        test('should replay to each new subscriber individually', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callbacks = Array.from({ length: 3 }, () => xJet.fn());

            subject.next(100);

            callbacks.forEach((cb) => {
                subject.subscribe(cb);
                expect(cb).toHaveBeenCalledWith(100);
                expect(cb).toHaveBeenCalledTimes(1);
            });
        });

        test('should maintain separate subscriptions', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            subject.subscribe(callback1);
            subject.next(50);
            subject.subscribe(callback2);

            callback1.mockClear();
            callback2.mockClear();

            subject.next(100);

            expect(callback1).toHaveBeenCalledWith(100);
            expect(callback2).toHaveBeenCalledWith(100);
        });

        test('should handle unsubscription', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback = xJet.fn();

            const unsub = subject.subscribe(callback);
            callback.mockClear();

            subject.next(42);
            expect(callback).toHaveBeenCalledWith(42);

            unsub();
            callback.mockClear();

            subject.next(99);
            expect(callback).not.toHaveBeenCalled();
        });

        test('should support selective unsubscription', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            const unsub1 = subject.subscribe(callback1);
            subject.subscribe(callback2);

            unsub1();

            callback1.mockClear();
            callback2.mockClear();

            subject.next(75);

            expect(callback1).not.toHaveBeenCalled();
            expect(callback2).toHaveBeenCalledWith(75);
        });
    });

    describe('complex subscription patterns', () => {
        test('should handle state management pattern', () => {
            interface StateTypeInterface {
                count: number;
                name: string;
            }

            const initialState: StateTypeInterface = { count: 0, name: 'test' };
            const subject = new BehaviorSubjectService<StateTypeInterface>(initialState);

            const subscribers = Array.from({ length: 3 }, () => xJet.fn());
            subscribers.forEach((sub) => subject.subscribe(sub));

            subscribers.forEach((sub) => {
                expect(sub).toHaveBeenCalledWith(initialState);
            });

            const newState: StateTypeInterface = { count: 1, name: 'updated' };
            subject.next(newState);

            subscribers.forEach((sub) => {
                expect(sub).toHaveBeenNthCalledWith(2, newState);
            });
        });

        test('should handle form state updates', () => {
            interface FormStateInterface {
                email: string;
                password: string;
                submitted: boolean;
            }

            const initialForm: FormStateInterface = {
                email: '',
                password: '',
                submitted: false
            };

            const formSubject = new BehaviorSubjectService<FormStateInterface>(initialForm);
            const listeners = Array.from({ length: 2 }, () => xJet.fn());

            listeners.forEach((listener) => formSubject.subscribe(listener));

            listeners.forEach((listener) => {
                expect(listener).toHaveBeenCalledWith(initialForm);
            });

            const updatedForm: FormStateInterface = {
                email: 'test@example.com',
                password: 'secret',
                submitted: true
            };

            formSubject.next(updatedForm);

            listeners.forEach((listener) => {
                expect(listener).toHaveBeenNthCalledWith(2, updatedForm);
            });
        });

        test('should handle subscription and emission interleaving', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback1 = xJet.fn();

            subject.subscribe(callback1);
            subject.next(1);

            const callback2 = xJet.fn();
            subject.subscribe(callback2);

            expect(callback1).toHaveBeenNthCalledWith(1, 0);
            expect(callback1).toHaveBeenNthCalledWith(2, 1);
            expect(callback2).toHaveBeenNthCalledWith(1, 1);

            callback1.mockClear();
            callback2.mockClear();

            subject.next(2);

            expect(callback1).toHaveBeenCalledWith(2);
            expect(callback2).toHaveBeenCalledWith(2);
        });

        test('should handle rapid value changes', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const values: Array<number> = [];

            subject.subscribe((value) => {
                values.push(value);
            });

            for (let i = 1; i <= 100; i++) {
                subject.next(i);
            }

            expect(values).toContain(0);
            expect(values).toHaveLength(101);
            expect(subject.value).toBe(100);
        });
    });

    describe('error handling', () => {
        test('should propagate errors from observer next handler', () => {
            const subject = new BehaviorSubjectService<number>(0);

            try {
                subject.subscribe(() => {
                    throw new Error('Handler error');
                });
            } catch {}

            expect(() => subject.next(42)).toThrow(AggregateError);
        });

        test('should collect multiple observer errors', () => {
            const subject = new BehaviorSubjectService<number>(0);

            try {
                subject.subscribe(() => {
                    throw new Error('Error 1');
                });
            } catch {}

            try {
                subject.subscribe(() => {
                    throw new Error('Error 2');
                });
            } catch {}

            try {
                subject.next(42);
            } catch (err) {
                expect(err).toBeInstanceOf(AggregateError);
                expect((err as AggregateError).errors).toHaveLength(2);
            }
        });

        test('should continue notifying after error', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback1 = () => {
                throw new Error('First error');
            };
            const callback2 = xJet.fn();

            try {
                subject.subscribe(callback2);
                subject.subscribe(callback1);
            } catch {}

            expect(() => subject.next(42)).toThrow(AggregateError);
            expect(callback2).toHaveBeenCalledWith(42);
        });

        test('should handle error in replay subscription', () => {
            const subject = new BehaviorSubjectService<number>(10);
            const callback = () => {
                throw new Error('Replay error');
            };

            expect(() => subject.subscribe(callback)).toThrow(Error);
        });

        test('should pass errors to error handler', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const errorHandler = xJet.fn();

            try {
                subject.subscribe({
                    next: () => {
                        throw new Error('Test error');
                    },
                    error: errorHandler
                });
            } catch {}

            expect(() => subject.next(42)).toThrow(AggregateError);
            expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe('completion handling', () => {
        test('should complete subject', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const completeHandler = xJet.fn();

            subject.subscribe({
                complete: completeHandler
            });

            subject.complete();

            expect(completeHandler).toHaveBeenCalled();
        });

        test('should prevent emissions after complete', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);
            subject.complete();

            callback.mockClear();
            subject.next(42);

            expect(callback).not.toHaveBeenCalled();
        });

        test('should not replay to subscribers after complete', () => {
            const subject = new BehaviorSubjectService<number>(0);

            subject.next(100);
            subject.complete();

            const callback = xJet.fn();
            subject.subscribe(callback);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('lazy initialization', () => {
        test('should call factory only once', () => {
            const factory = xJet.fn(() => 42);

            const subject = new BehaviorSubjectService<number>(factory);

            expect(factory).toHaveBeenCalledTimes(1);

            const callback = xJet.fn();
            subject.subscribe(callback);

            expect(factory).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith(42);
        });

        test('should support factory with complex computation', () => {
            const factory = xJet.fn(() => {
                const result = Array.from({ length: 10 }, (_, i) => i).reduce((a, b) => a + b, 0);

                return result;
            });

            const subject = new BehaviorSubjectService<number>(factory);

            expect(subject.value).toBe(45);
            expect(factory).toHaveBeenCalledTimes(1);
        });

        test('should handle factory returning object', () => {
            const factory = xJet.fn(() => ({
                id: 1,
                timestamp: Date.now()
            }));

            const subject = new BehaviorSubjectService(factory);
            const value = subject.value;

            expect(value.id).toBe(1);
            expect(typeof value.timestamp).toBe('number');
        });
    });

    describe('edge cases', () => {
        test('should handle zero as initial value', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(0);
        });

        test('should handle false as initial value', () => {
            const subject = new BehaviorSubjectService<boolean>(false);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(false);
        });

        test('should handle empty string as initial value', () => {
            const subject = new BehaviorSubjectService<string>('');
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('');
        });

        test('should handle empty array as initial value', () => {
            const subject = new BehaviorSubjectService<Array<number>>([]);
            const callback = xJet.fn();

            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith([]);
        });

        test('should distinguish between multiple empty value types', () => {
            const falseSubject = new BehaviorSubjectService<boolean>(false);
            const zeroSubject = new BehaviorSubjectService<number>(0);
            const emptySubject = new BehaviorSubjectService<string>('');

            expect(falseSubject.value).toBe(false);
            expect(zeroSubject.value).toBe(0);
            expect(emptySubject.value).toBe('');
        });

        test('should handle subscription during emission', () => {
            const subject = new BehaviorSubjectService<number>(0);
            const callback1 = xJet.fn();
            const callback2 = xJet.fn();

            subject.subscribe((value) => {
                callback1(value);
                subject.subscribe(callback2);
            });

            subject.next(1);

            expect(callback1).toHaveBeenNthCalledWith(1, 0);
            expect(callback1).toHaveBeenNthCalledWith(2, 1);
            expect(callback2).toHaveBeenCalledWith(1);
        });

        test('should handle unsubscribe during emission', () => {
            const subject = new BehaviorSubjectService<number>(0);
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
        });
    });

    describe('comparison with parent SubjectService', () => {
        test('should replay value on subscribe unlike parent', () => {
            const subject = new BehaviorSubjectService<number>(42);
            const callback = xJet.fn();

            // BehaviorSubject replays immediately
            subject.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(42);
        });

        test('should provide value getter', () => {
            const subject = new BehaviorSubjectService<number>(100);

            // BehaviorSubject provides value property
            expect(subject.value).toBe(100);
        });

        test('should preserve value through operations', () => {
            const subject = new BehaviorSubjectService<number>(10);

            subject.next(20);
            subject.next(30);
            subject.next(40);

            // Value is always accessible
            expect(subject.value).toBe(40);
        });
    });
});
