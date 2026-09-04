/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ConfigurationInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { URL } from 'url';
import { ConfigurationService } from './configuration.service';
import { DefaultsCommonConfig } from '@constants/configuration.constant';

/**
 * Tests
 */

describe('ConfigurationService', () => {
    beforeAll(() => {
        // `equals` reaches for a global URL, which the worker does not carry
        (<any> globalThis).URL = URL;
    });

    const initial: any = {
        variants: { esm: { esbuild: { format: 'esm', target: [ 'node22' ] } } },
        common: { types: true, esbuild: { minify: true } }
    };

    let service: ConfigurationService<ConfigurationInterface>;

    beforeEach(() => {
        xJet.restoreAllMocks();
        service = new ConfigurationService(<any> initial);
    });

    describe('constructor', () => {
        test('should copy the configuration it was given rather than hold on to it', () => {
            const value: any = service.getValue();

            expect(value).toEqual(initial);
            expect(value).not.toBe(initial);
            expect(value.common).not.toBe(initial.common);
        });

        test('should start from the built-in defaults when it is given nothing', () => {
            expect(new ConfigurationService().getValue()).toEqual(DefaultsCommonConfig);
        });

        test('should leave the frozen defaults untouched', () => {
            const defaults = new ConfigurationService();
            defaults.patch(<any> { common: { types: false } });

            expect(DefaultsCommonConfig.common?.types).toBe(true);
        });
    });

    describe('getValue', () => {
        test('should read the whole configuration when it is given no selector', () => {
            expect(service.getValue()).toEqual(initial);
        });

        test('should answer once with what the selector picked', () => {
            expect(service.getValue(config => Object.keys(config.variants))).toEqual([ 'esm' ]);
        });
    });

    describe('subscribe', () => {
        test('should hand the configuration over as it stands and again on every change', () => {
            const observer = xJet.fn();
            const stop = service.subscribe(observer);

            expect(observer).toHaveBeenCalledTimes(1);
            expect(observer).toHaveBeenCalledWith(expect.objectContaining({ variants: initial.variants }));

            service.patch(<any> { common: { types: false } });
            expect(observer).toHaveBeenCalledTimes(2);

            stop();
            service.patch(<any> { common: { types: true } });
            expect(observer).toHaveBeenCalledTimes(2);
        });
    });

    describe('select', () => {
        test('should report the value as it stands to a new subscriber', () => {
            const observer = xJet.fn();
            service.select(config => config.common?.types).subscribe(observer);

            expect(observer).toHaveBeenCalledWith(true);
        });

        test('should report only when the value it picked has actually moved', () => {
            const observer = xJet.fn();
            service.select(config => config.common?.types).subscribe(observer);

            service.patch(<any> { variants: { cjs: { esbuild: { format: 'cjs' } } } });
            expect(observer).toHaveBeenCalledTimes(1);

            service.patch(<any> { common: { types: false } });
            expect(observer).toHaveBeenCalledTimes(2);
            expect(observer).toHaveBeenLastCalledWith(false);
        });

        test('should compare the picked value by structure rather than by identity', () => {
            const observer = xJet.fn();
            service.select(config => ({ types: config.common?.types })).subscribe(observer);

            service.patch(<any> { common: { esbuild: { minify: false } } });

            expect(observer).toHaveBeenCalledTimes(1);
        });

        test('should stop reporting once its subscription ends', () => {
            const observer = xJet.fn();
            const stop = service.select(config => config.common?.types).subscribe(observer);

            stop();
            service.patch(<any> { common: { types: false } });

            expect(observer).toHaveBeenCalledTimes(1);
        });
    });

    describe('patch', () => {
        test('should merge the parts it was given and leave the rest standing', () => {
            service.patch(<any> { common: { esbuild: { minify: false } } });

            const value: any = service.getValue();

            expect(value.common.esbuild.minify).toBe(false);
            expect(value.common.types).toBe(true);
            expect(value.variants.esm.esbuild.format).toBe('esm');
        });

        test('should concatenate an array rather than replace it', () => {
            service.patch(<any> { variants: { esm: { esbuild: { target: [ 'node24' ] } } } });

            expect((<any> service.getValue()).variants.esm.esbuild.target).toEqual([ 'node22', 'node24' ]);
        });

        test('should publish a configuration of its own rather than the one it merged over', () => {
            const before = service.getValue();
            service.patch(<any> { common: { types: false } });

            expect(service.getValue()).not.toBe(before);
            expect((<any> before).common.types).toBe(true);
        });
    });

    describe('reload', () => {
        test('should start again from the initial configuration with the given one merged over it', () => {
            service.patch(<any> { common: { types: false } });
            service.reload(<any> { common: { declaration: false } });

            const value: any = service.getValue();

            expect(value.common.types).toBe(true);
            expect(value.common.declaration).toBe(false);
        });

        test('should tell every subscriber about the configuration it went back to', () => {
            const observer = xJet.fn();
            service.subscribe(observer);

            service.reload(<any> {});

            expect(observer).toHaveBeenCalledTimes(2);
            expect(observer).toHaveBeenLastCalledWith(expect.objectContaining({ variants: initial.variants }));
        });

        test('should leave the initial configuration untouched for the next reload', () => {
            service.reload(<any> { common: { declaration: false } });
            service.reload(<any> {});

            expect((<any> service.getValue()).common.declaration).toBeUndefined();
        });
    });
});
