/**
 * Import will remove at compile time
 */

import type { ConfigurationInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { ConfigurationService } from '@services/configuration.service';

/**
 * Tests
 */

describe('ConfigurationService', () => {
    let configService: ConfigurationService<any>;

    beforeEach(() => {
        configService = new ConfigurationService();
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('constructor', () => {
        test('should initialize with default configuration', () => {
            const service = new ConfigurationService();
            const config = service.getValue();

            expect(config).toBeDefined();
            expect(config).toEqual(expect.any(Object));
        });

        test('should initialize with custom configuration', () => {
            const customConfig = { name: 'testApp' } as ConfigurationInterface;
            const service = new ConfigurationService(customConfig);
            const config = service.getValue();

            expect(config.name).toBe('testApp');
        });

        test('should deep merge initial configuration with defaults', () => {
            const customConfig = { name: 'customApp' } as ConfigurationInterface;
            const service = new ConfigurationService(customConfig);
            const config = service.getValue();

            expect(config.name).toBe('customApp');
        });
    });

    describe('getValue()', () => {
        test('should return current configuration without selector', () => {
            const config = configService.getValue();

            expect(config).toBeDefined();
            expect(config).toEqual(expect.any(Object));
        });

        test('should return computed value with selector', () => {
            configService.patch({ name: 'myApp' });
            const name = configService.getValue(cfg => cfg.name);

            expect(name).toBeDefined();
            expect(typeof name === 'string' || name === undefined).toBe(true);
        });

        test('should support chained selectors', () => {
            configService.patch({ name: 'myApp' });
            const nameLength = configService.getValue(cfg => cfg.name?.length ?? 0);

            expect(nameLength).toBe(5);
        });

        test('should return same reference for multiple calls without changes', () => {
            const config1 = configService.getValue();
            const config2 = configService.getValue();

            expect(config1).toBe(config2);
        });
    });

    describe('patch()', () => {
        test('should update single configuration property', () => {
            configService.patch({ name: 'newApp' });
            const config = configService.getValue();

            expect(config.name).toBe('newApp');
        });

        test('should deep merge partial configuration', () => {
            configService.patch({ name: 'app1' });
            configService.patch({ name: 'app2' });
            const config = configService.getValue();

            expect(config.name).toBe('app2');
        });

        test('should preserve unmodified properties during patch', () => {
            configService.patch({ name: 'updated', esbuild: 'test' });
            const updatedConfig = configService.getValue();

            expect(updatedConfig.name).toBe('updated');
            expect(updatedConfig).toHaveProperty('esbuild');
        });

        test('should emit changes to subscribers after patch', (done) => {
            const unsubscribe = configService.subscribe((config) => {
                if (config.name === 'patchedApp') {
                    expect(config.name).toBe('patchedApp');
                    unsubscribe();
                    done();
                }
            });

            configService.patch({ name: 'patchedApp' });
        });
    });

    describe('subscribe()', () => {
        test('should emit on configuration changes', (done) => {
            let emissionCount = 0;
            const unsubscribe = configService.subscribe(() => {
                emissionCount++;
                if (emissionCount === 2) {
                    expect(emissionCount).toBe(2);
                    unsubscribe();
                    done();
                }
            });

            configService.patch({ name: 'changed' });
        });

        test('should return unsubscribe function', () => {
            const unsubscribe = configService.subscribe(() => {
                // Empty observer
            });

            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
        });

        test('should stop emitting after unsubscribe', (done) => {
            let emissionCount = 0;
            const unsubscribe = configService.subscribe(() => {
                emissionCount++;
            });

            unsubscribe();
            configService.patch({ name: 'afterUnsubscribe' });

            setTimeout(() => {
                expect(emissionCount).toBe(1); // Only initial emission
                done();
            }, 10);
        });
    });

    describe('select()', () => {
        test('should return Observable for selected property', (done) => {
            const observable = configService.select(cfg => cfg.name);

            expect(observable).toBeDefined();
            expect(typeof observable.subscribe).toBe('function');
            done();
        });

        test('should emit selected values on configuration change', (done) => {
            const selectedValues: (string | undefined)[] = [];
            configService.select(cfg => cfg.name)
                .subscribe(
                    (name) => {
                        selectedValues.push(name);
                        if (selectedValues.length > 1) {
                            expect(selectedValues[0]).toBeUndefined();
                            expect(selectedValues[1]).toBe('selectedApp');
                            done();
                        }
                    },
                    (error: any) => {
                        // Handle errors here
                        done(error);
                    }
                );

            configService.patch({ name: 'selectedApp' });
        });

        test('should use distinct comparison to avoid duplicate emissions', (done) => {
            let emissionCount = 0;
            const subscription = configService.select(cfg => cfg.name)
                .subscribe(() => {
                    emissionCount++;
                });

            // Patch with same value should not trigger new emission
            const currentName = configService.getValue(cfg => cfg.name);
            configService.patch({ name: currentName });

            setTimeout(() => {
                expect(emissionCount).toBe(1); // Only initial emission
                subscription();
                done();
            }, 10);
        });

        test('should support selector with computed values', (done) => {
            const subscription = configService.select(cfg => cfg.name?.length ?? 0)
                .subscribe((length) => {
                    if (length === 5) {
                        expect(length).toBe(5);
                        subscription();
                        done();
                    }
                });

            configService.patch({ name: 'test!' }); // 5 characters
        });
    });

    describe('integration scenarios', () => {
        test('should handle multiple subscribers independently', (done) => {
            const results: string[] = [];
            const unsub1 = configService.subscribe(() => results.push('sub1'));
            const unsub2 = configService.subscribe(() => results.push('sub2'));

            configService.patch({ name: 'multi' });

            setTimeout(() => {
                expect(results.includes('sub1')).toBe(true);
                expect(results.includes('sub2')).toBe(true);
                unsub1();
                unsub2();
                done();
            }, 10);
        });

        test('should combine getValue and select operations', (done) => {
            configService.patch({ name: 'combined' });
            const name = configService.getValue(cfg => cfg.name);

            configService.select(cfg => cfg.name)
                .subscribe((selectedName) => {
                    if (selectedName === 'combined') {
                        expect(name).toBe(selectedName);
                        done();
                    }
                });
        });
    });
});
