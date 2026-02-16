/**
 * Import will remove at compile time
 */

import type { ConfigurationInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { URL } from 'url';
import { ConfigurationService } from '@services/configuration.service';
import { DEFAULTS_COMMON_CONFIG } from '@constants/configuration.constant';

/**
 * Tests
 */

describe('ConfigurationService', () => {
    (<any> globalThis).URL = URL;
    let configService: ConfigurationService<any>;

    const defaultConfig = DEFAULTS_COMMON_CONFIG;
    const customConfig: ConfigurationInterface = <any> {
        name: 'test-app',
        verbose: true,
        variants: {
            dev: {
                debug: true
            }
        }
    };

    beforeEach(() => {
        xJet.resetAllMocks();
        configService = new ConfigurationService(customConfig);
    });

    describe('constructor & initial value', () => {
        test('uses provided initial config and deep copies it', () => {
            const service = new ConfigurationService(customConfig);

            expect(service.getValue()).toEqual(customConfig);
            expect(service.getValue()).not.toBe(customConfig); // deep copy
        });

        test('falls back to DEFAULTS_COMMON_CONFIG when no initial provided', () => {
            const service = new ConfigurationService();

            expect(service.getValue()).toEqual(defaultConfig);
        });
    });

    describe('getValue', () => {
        test('returns full config without selector', () => {
            expect(configService.getValue()).toEqual(customConfig);
        });

        test('returns selected value with selector', () => {
            expect(configService.getValue(cfg => cfg.name)).toBe('test-app');
            expect(configService.getValue(cfg => cfg.variants?.dev?.debug ?? false)).toBe(true);
        });

        test('handles undefined paths safely in selector', () => {
            expect(configService.getValue(cfg => cfg.unknown?.deep?.path ?? 'fallback')).toBe('fallback');
        });
    });

    describe('subscribe', () => {
        test('immediately calls observer with current value', () => {
            const observer = xJet.fn();

            configService.subscribe(observer);

            expect(observer).toHaveBeenCalledTimes(1);
            expect(observer).toHaveBeenCalledWith(customConfig);
        });

        test('emits new value after patch', () => {
            const observer = xJet.fn();

            configService.subscribe(observer);

            configService.patch({ name: 'updated' });

            expect(observer).toHaveBeenCalledTimes(2);
            expect(observer).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'updated' }));
        });

        test('returns unsubscribe function that stops emissions', () => {
            const observer = xJet.fn();

            const unsubscribe = configService.subscribe(observer);

            configService.patch({ name: 'updated' });

            unsubscribe();

            configService.patch({ name: 'final' });

            expect(observer).toHaveBeenCalledTimes(2);
        });
    });

    describe('select', () => {
        test('emits selected value immediately and on change', () => {
            const observer = xJet.fn();
            configService.select(cfg => cfg.name).subscribe(observer);

            expect(observer).toHaveBeenCalledTimes(1);
            expect(observer).toHaveBeenCalledWith('test-app');

            configService.patch({ name: 'changed' });

            expect(observer).toHaveBeenCalledTimes(2);
            expect(observer).toHaveBeenNthCalledWith(2, 'changed');
        });

        test('uses distinctUntilChanged with deep equals', () => {
            const observer = xJet.fn();

            configService.select(cfg => cfg.variants).subscribe(observer);

            // Same value (deep equal) → no emission
            configService.patch({ variants: { dev: { debug: true } } });

            expect(observer).toHaveBeenCalledTimes(1);
        });

        test('handles selector returning undefined/null', () => {
            const observer = xJet.fn();

            configService.select(cfg => cfg.unknown?.path).subscribe(observer);

            expect(observer).toHaveBeenCalledWith(undefined);
        });
    });

    describe('patch (deep merge)', () => {
        test('merges partial update and emits new config', () => {
            const observer = xJet.fn();
            configService.subscribe(observer);

            configService.patch({
                name: 'patched',
                verbose: false,
                variants: { prod: { minify: true } }
            });

            expect(observer).toHaveBeenCalledTimes(2);
            const updated: any = observer.mock.calls[1][0];

            expect(updated.name).toBe('patched');
            expect(updated.verbose).toBe(false);
            expect(updated.variants).toEqual({
                dev: { debug: true },
                prod: { minify: true }
            });
        });

        test('preserves unchanged nested properties', () => {
            configService.patch({ variants: { dev: { logLevel: 'debug' } } });

            const updated = configService.getValue();

            expect(updated.variants.dev.debug).toBe(true); // preserved
            expect(updated.variants.dev.logLevel).toBe('debug'); // added
        });
    });

    describe('reload (full replace)', () => {
        test('replaces entire config with new value', () => {
            const observer = xJet.fn();
            configService.subscribe(observer);

            const newConfig = {
                name: 'reloaded',
                verbose: false
            };

            configService.reload(newConfig);
            expect(observer).toHaveBeenCalledTimes(2);
            expect(observer.mock.calls[1][0]).toEqual(expect.objectContaining(newConfig));
            expect(configService.getValue().variants).toEqual({
                dev: {
                    debug: true
                }
            });
        });

        test('merges with initial config when partial reload', () => {
            configService.reload({ name: 'partial-reload', verbose: false });

            const reloaded = configService.getValue();
            expect(reloaded.name).toBe('partial-reload');
            expect(reloaded.verbose).toBe(defaultConfig.verbose);
        });
    });
});
