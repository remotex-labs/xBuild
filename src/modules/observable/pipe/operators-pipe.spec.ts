/**
 * Imports
 */

import { distinctUntilChanged, filter, map, tap } from './operators.pipe';
import { ObservableService } from '@observable/services/observable.service';

/**
 * Tests
 */

describe('Observable Operators', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('map operator', () => {
        test('should transform values using project function', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
            });
            const mapped = source.pipe(map((v: number) => v * 2));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith(10);
        });

        test('should transform multiple values', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const mapped = source.pipe(map((v: number) => v * 2));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 2);
            expect(callback).toHaveBeenNthCalledWith(2, 4);
            expect(callback).toHaveBeenNthCalledWith(3, 6);
        });

        test('should support type transformation', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(42);
            });
            const mapped = source.pipe(map((v: number) => String(v)));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('42');
        });

        test('should handle string transformation', () => {
            const source = new ObservableService<string>((observer) => {
                observer.next?.('hello');
            });
            const mapped = source.pipe(map((v: string) => v.toUpperCase()));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('HELLO');
        });

        test('should handle object transformation', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(10);
            });
            const mapped = source.pipe(map((v: number) => ({ value: v, doubled: v * 2 })));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith({ doubled: 20, value: 10 });
        });

        test('should catch and propagate transformation errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(0);
            });
            const mapped = source.pipe(map((v: number) => {
                if (v === 0) throw new Error('Cannot transform zero');

                return v * 2;
            }));
            const errorHandler = xJet.fn();

            mapped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
            expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
        });

        test('should propagate source errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.error?.(new Error('Source error'));
            });
            const mapped = source.pipe(map((v: number) => v * 2));
            const errorHandler = xJet.fn();

            mapped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate completion', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
                observer.complete?.();
            });
            const mapped = source.pipe(map((v: number) => v * 2));
            const completeHandler = xJet.fn();

            mapped.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalled();
        });

        test('should handle null values', () => {
            const source = new ObservableService<number | null>((observer) => {
                observer.next?.(null);
                observer.next?.(5);
            });
            const mapped = source.pipe(map((v: number | null) => (v === null ? 0 : v * 2)));
            const callback = xJet.fn();

            mapped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 0);
            expect(callback).toHaveBeenNthCalledWith(2, 10);
        });
    });

    describe('filter operator', () => {
        test('should filter values based on predicate', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.next?.(4);
                observer.next?.(5);
            });
            const filtered = source.pipe(filter((v: number) => v > 2));
            const callback = xJet.fn();

            filtered.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 3);
            expect(callback).toHaveBeenNthCalledWith(2, 4);
            expect(callback).toHaveBeenNthCalledWith(3, 5);
        });

        test('should filter even numbers', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.next?.(4);
            });
            const filtered = source.pipe(filter((v: number) => v % 2 === 0));
            const callback = xJet.fn();

            filtered.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 2);
            expect(callback).toHaveBeenNthCalledWith(2, 4);
        });

        test('should filter string values by length', () => {
            const source = new ObservableService<string>((observer) => {
                observer.next?.('a');
                observer.next?.('hello');
                observer.next?.('hi');
            });
            const filtered = source.pipe(filter((v: string) => v.length > 2));
            const callback = xJet.fn();

            filtered.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith('hello');
        });

        test('should handle complex predicate', () => {
            interface UserTypeInterface {
                age: number;
                name: string;
            }

            const source = new ObservableService<UserTypeInterface>((observer) => {
                observer.next?.({ age: 16, name: 'Alice' });
                observer.next?.({ age: 25, name: 'Bob' });
                observer.next?.({ age: 17, name: 'Charlie' });
            });
            const filtered = source.pipe(filter((u: UserTypeInterface) => u.age >= 18));
            const callback = xJet.fn();

            filtered.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(1);
            expect(callback).toHaveBeenCalledWith({ age: 25, name: 'Bob' });
        });

        test('should catch and propagate predicate errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(0);
            });
            const filtered = source.pipe(filter((v: number) => {
                if (v === 0) throw new Error('Cannot filter zero');

                return v > 0;
            }));
            const errorHandler = xJet.fn();

            filtered.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate source errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.error?.(new Error('Source error'));
            });
            const filtered = source.pipe(filter((v: number) => v > 0));
            const errorHandler = xJet.fn();

            filtered.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate completion', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
                observer.complete?.();
            });
            const filtered = source.pipe(filter((v: number) => v > 0));
            const completeHandler = xJet.fn();

            filtered.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalled();
        });

        test('should emit nothing if no values match', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const filtered = source.pipe(filter((v: number) => v > 10));
            const callback = xJet.fn();

            filtered.subscribe(callback);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('distinctUntilChanged operator', () => {
        test('should emit only distinct consecutive values', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(2);
                observer.next?.(3);
            });
            const distinct = source.pipe(distinctUntilChanged());
            const callback = xJet.fn();

            distinct.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 1);
            expect(callback).toHaveBeenNthCalledWith(2, 2);
            expect(callback).toHaveBeenNthCalledWith(3, 3);
        });

        test('should use default equality comparison', () => {
            const source = new ObservableService<string>((observer) => {
                observer.next?.('hello');
                observer.next?.('hello');
                observer.next?.('world');
                observer.next?.('world');
            });
            const distinct = source.pipe(distinctUntilChanged());
            const callback = xJet.fn();

            distinct.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 'hello');
            expect(callback).toHaveBeenNthCalledWith(2, 'world');
        });

        test('should support custom comparison function', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.next?.(4);
            });

            const distinct = source.pipe(distinctUntilChanged(
                (a, b) => Math.floor(a / 2) === Math.floor(b / 2)
            ));

            const callback = xJet.fn();
            distinct.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 1);
            expect(callback).toHaveBeenNthCalledWith(2, 2);
            expect(callback).toHaveBeenNthCalledWith(3, 4);
        });

        test('should handle rapid alternating values', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(1);
            });
            const distinct = source.pipe(distinctUntilChanged());
            const callback = xJet.fn();

            distinct.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(5);
        });

        test('should catch and propagate comparison errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
            });
            const distinct = source.pipe(distinctUntilChanged(() => {
                throw new Error('Comparison error');
            }));
            const errorHandler = xJet.fn();

            distinct.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate source errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.error?.(new Error('Source error'));
            });
            const distinct = source.pipe(distinctUntilChanged());
            const errorHandler = xJet.fn();

            distinct.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate completion', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.complete?.();
            });
            const distinct = source.pipe(distinctUntilChanged());
            const completeHandler = xJet.fn();

            distinct.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalled();
        });

        test('should handle null values', () => {
            const source = new ObservableService<number | null>((observer) => {
                observer.next?.(null);
                observer.next?.(null);
                observer.next?.(1);
                observer.next?.(1);
            });
            const distinct = source.pipe(distinctUntilChanged());
            const callback = xJet.fn();

            distinct.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, null);
            expect(callback).toHaveBeenNthCalledWith(2, 1);
        });
    });

    describe('tap operator', () => {
        test('should execute side effect without changing values', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
            });
            const sideEffect: any = xJet.fn();
            const tapped = source.pipe(tap(sideEffect));
            const callback = xJet.fn();

            tapped.subscribe(callback);

            expect(sideEffect).toHaveBeenCalledWith(5);
            expect(callback).toHaveBeenCalledWith(5);
        });

        test('should execute side effect for multiple values', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const sideEffect: any = xJet.fn();
            const tapped = source.pipe(tap(sideEffect));
            const callback = xJet.fn();

            tapped.subscribe(callback);

            expect(sideEffect).toHaveBeenCalledTimes(3);
            expect(sideEffect).toHaveBeenNthCalledWith(1, 1);
            expect(sideEffect).toHaveBeenNthCalledWith(2, 2);
            expect(sideEffect).toHaveBeenNthCalledWith(3, 3);
        });

        test('should pass values unchanged', () => {
            const source = new ObservableService<string>((observer) => {
                observer.next?.('hello');
            });
            const tapped = source.pipe(tap(() => {
                // no-op
            }));
            const callback = xJet.fn();

            tapped.subscribe(callback);

            expect(callback).toHaveBeenCalledWith('hello');
        });

        test('should allow access to values for logging', () => {
            const logs: Array<number> = [];
            const source = new ObservableService<number>((observer) => {
                observer.next?.(10);
                observer.next?.(20);
                observer.next?.(30);
            });
            const tapped = source.pipe(tap((v) => {
                logs.push(v);
            }));
            const callback = xJet.fn();

            tapped.subscribe(callback);

            expect(logs).toEqual([ 10, 20, 30 ]);
        });

        test('should catch and propagate side effect errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
            });
            const tapped = source.pipe(tap(() => {
                throw new Error('Side effect error');
            }));
            const errorHandler = xJet.fn();

            tapped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate source errors', () => {
            const source = new ObservableService<number>((observer) => {
                observer.error?.(new Error('Source error'));
            });
            const tapped = source.pipe(tap(() => {}));
            const errorHandler = xJet.fn();

            tapped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate completion', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(5);
                observer.complete?.();
            });
            const tapped = source.pipe(tap(() => {}));
            const completeHandler = xJet.fn();

            tapped.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalled();
        });

        test('should work with complex objects', () => {
            interface DataTypeInterface {
                id: number;
                value: string;
            }

            const data: Array<DataTypeInterface> = [];
            const source = new ObservableService<DataTypeInterface>((observer) => {
                observer.next?.({ id: 1, value: 'a' });
                observer.next?.({ id: 2, value: 'b' });
            });
            const tapped = source.pipe(tap((obj) => {
                data.push(obj);
            }));
            const callback = xJet.fn();

            tapped.subscribe(callback);

            expect(data).toHaveLength(2);
            expect(data[0]).toEqual({ id: 1, value: 'a' });
            expect(data[1]).toEqual({ id: 2, value: 'b' });
        });
    });

    describe('operator composition', () => {
        test('should chain map and filter', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
                observer.next?.(4);
                observer.next?.(5);
            });
            const piped = source.pipe(
                map((v: number) => v * 2),
                filter((v: number) => v > 5)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(3);
            expect(callback).toHaveBeenNthCalledWith(1, 6);
            expect(callback).toHaveBeenNthCalledWith(2, 8);
            expect(callback).toHaveBeenNthCalledWith(3, 10);
        });

        test('should chain map, filter, and distinctUntilChanged', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(2);
                observer.next?.(3);
                observer.next?.(3);
            });
            const piped = source.pipe(
                map((v: number) => v * 2),
                distinctUntilChanged(),
                filter((v: number) => v > 2)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 4);
            expect(callback).toHaveBeenNthCalledWith(2, 6);
        });

        test('should chain with tap for debugging', () => {
            const logs: Array<number> = [];
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const piped = source.pipe(
                tap((v) => logs.push(v)),
                map((v: number) => v * 2),
                tap((v) => logs.push(v)),
                filter((v: number) => v > 2)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(logs).toEqual([ 1, 2, 2, 4, 3, 6 ]);
            expect(callback).toHaveBeenCalledTimes(2);
        });

        test('should handle errors in operator chain', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(0);
            });
            const piped = source.pipe(
                map((v: number) => {
                    if (v === 0) throw new Error('Cannot map zero');

                    return v * 2;
                }),
                filter((v: number) => v > 0)
            );
            const errorHandler = xJet.fn();

            piped.subscribe({
                error: errorHandler
            });

            expect(errorHandler).toHaveBeenCalled();
        });

        test('should propagate completion through chain', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.complete?.();
            });
            const piped = source.pipe(
                map((v: number) => v * 2),
                filter((v: number) => v > 2)
            );
            const completeHandler = xJet.fn();

            piped.subscribe({
                complete: completeHandler
            });

            expect(completeHandler).toHaveBeenCalled();
        });
    });

    describe('complex scenarios', () => {
        test('should handle state filtering and transformation', () => {
            interface StateTypeInterface {
                count: number;
            }

            const source = new ObservableService<StateTypeInterface>((observer) => {
                observer.next?.({ count: 0 });
                observer.next?.({ count: 0 });
                observer.next?.({ count: 1 });
                observer.next?.({ count: 1 });
                observer.next?.({ count: 2 });
            });
            const piped = source.pipe(
                distinctUntilChanged((a, b) => a.count === b.count),
                map((s: StateTypeInterface) => s.count),
                filter((v: number) => v > 0)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(callback).toHaveBeenNthCalledWith(1, 1);
            expect(callback).toHaveBeenNthCalledWith(2, 2);
        });

        test('should handle rapid emissions', () => {
            const source = new ObservableService<number>((observer) => {
                for (let i = 0; i < 100; i++) {
                    observer.next?.(i);
                }
            });
            const piped = source.pipe(
                filter((v: number) => v % 2 === 0),
                map((v: number) => v * 2)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(50);
        });

        test('should handle operators with mixed data types', () => {
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);
                observer.next?.(2);
                observer.next?.(3);
            });
            const piped = source.pipe(
                map((v: number) => ({ num: v, str: String(v) })),
                tap(console.log),
                filter((obj) => obj.num > 1)
            );
            const callback = xJet.fn();

            piped.subscribe(callback);

            expect(callback).toHaveBeenCalledTimes(2);
        });
    });

    describe('unsubscription in operators', () => {
        test('should respect unsubscription cleanup', () => {
            let subscriptionCount = 0;
            const source = new ObservableService<number>((observer) => {
                subscriptionCount++;
                observer.next?.(1);
                observer.next?.(2);

                return () => {
                    subscriptionCount--;
                };
            });
            const mapped = source.pipe(map((v: number) => v * 2));
            const unsub = mapped.subscribe(() => {});

            expect(subscriptionCount).toBe(1);

            unsub();

            expect(subscriptionCount).toBe(0);
        });

        test('should call cleanup when operator chain is unsubscribed', () => {
            const cleanup = xJet.fn();
            const source = new ObservableService<number>((observer) => {
                observer.next?.(1);

                return cleanup;
            });
            const piped = source.pipe(
                map((v: number) => v * 2),
                filter((v: number) => v > 0)
            );
            const unsub = piped.subscribe(() => {});

            expect(cleanup).not.toHaveBeenCalled();

            unsub();

            expect(cleanup).toHaveBeenCalled();
        });
    });
});
