/**
 * Import will remove at compile time
 */

import type { PartialBuildConfigType } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { inject } from '@symlinks/symlinks.module';
import { BuildService } from '@services/build.service';
import { ConfigurationService } from '@services/configuration.service';

/**
 * Tests
 */

const dummySourceMap = JSON.stringify({
    version: 3,
    sources: [ 'framework.ts' ],
    names: [],
    mappings: 'AAAA'
});

beforeAll(() => {
    xJet.mock(inject).mockImplementation((target: any, ...args: any[]) => new target(...args));
    xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
});

afterEach(() => {
    xJet.resetAllMocks();
});

describe('BuildService', () => {
    describe('constructor', () => {
        const subscribeSpy = xJet.spyOn(ConfigurationService.prototype, 'subscribe');
        const parseVariantsSpy = xJet.spyOn(<any> BuildService.prototype, 'parseVariants').mockReturnValue(<any> '');

        afterAll(() => {
            parseVariantsSpy.mockRestore();
        });

        test('initializes with default config', () => {
            xJet.mock(ConfigurationService);
            new BuildService();

            expect(ConfigurationService).toHaveBeenCalled();
            expect(subscribeSpy).toHaveBeenCalled();
        });

        test('initializes with provided config', () => {
            const customConfig: PartialBuildConfigType = {
                variants: {
                    custom: {
                        esbuild: {
                            entryPoints: [ 'src/custom.ts' ],
                            outdir: 'dist/custom'
                        }
                    }
                }
            };

            new BuildService(customConfig);

            expect(subscribeSpy).toHaveBeenCalled();
        });

        test('initializes with argv parameters', () => {
            const argv = { watch: true, minify: false };
            new BuildService(undefined, argv);

            expect(subscribeSpy).toHaveBeenCalled();
        });

        test('subscribes to configuration changes', () => {
            new BuildService();

            expect(subscribeSpy).toHaveBeenCalledWith(expect.any(Function));
        });
    });
});
