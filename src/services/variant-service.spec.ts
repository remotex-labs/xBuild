/**
 * Import will remove at compile time
 */

import type { Message, Plugin } from 'esbuild';
import type { MockState } from '@remotex-labs/xjet';
import type { BuildConfigInterface } from '@interfaces/configuration.interface';

/**
 * Imports
 */

import { build } from 'esbuild';
import { readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { TypesError } from '@errors/types.error';
import { xBuildError } from '@errors/xbuild.error';
import { inject } from '@symlinks/symlinks.module';
import { VariantService } from '@services/variant.service';
import { Typescript } from '@typescript/typescript.module';
import { LifecycleProvider } from '@providers/lifecycle.provider';
import { analyzeDependencies } from '@services/transpiler.service';
import { ConfigurationService } from '@services/configuration.service';
import { extractEntryPoints } from '@components/entry-points.component';

/**
 * Tests
 */

describe('VariantService', () => {
    let plugin: Plugin;
    let disposeSpy: MockState;
    let touchFilesSpy: MockState;
    let lifecycle: LifecycleProvider;
    let subscribeCallbackMock: MockState;
    let buildConfig: BuildConfigInterface;
    let configService: ConfigurationService<any> & { select: MockState };
    let typescriptMock: MockState & Typescript;

    const variantName = 'production';
    const argv = { watch: false, minify: true };
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    beforeAll(() => {
        disposeSpy = xJet.fn();
        touchFilesSpy = xJet.fn();

        typescriptMock = xJet.mock(Typescript).mockImplementation((): any => {
            return {
                dispose: disposeSpy,
                touchFiles: touchFilesSpy,
                languageHostService: {
                    touchFiles: xJet.fn()
                },
                config: {
                    options: {
                        rootDir: process.cwd()
                    }
                }
            };
        }) as any;
    });

    beforeEach(() => {
        disposeSpy.mockReset();
        touchFilesSpy.mockReset();
        xJet.resetAllMocks();

        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
        xJet.mock(mkdir).mockImplementation(() => undefined);
        xJet.mock(writeFile).mockImplementation(() => undefined);

        xJet.mock(extractEntryPoints).mockReturnValue({
            'src/index': 'src/index.ts'
        });

        xJet.mock(analyzeDependencies).mockResolvedValue({
            metafile: {
                inputs: {
                    'src/index.ts': { bytes: 1 }
                }
            }
        } as any);

        lifecycle = new LifecycleProvider(variantName, argv);
        buildConfig = {
            variants: {
                production: {
                    esbuild: {
                        entryPoints: [ 'src/index.ts' ],
                        outdir: 'dist',
                        bundle: true,
                        tsconfig: 'tsconfig.json'
                    },
                    types: true,
                    declaration: true
                }
            },
            common: {
                esbuild: {
                    format: 'esm',
                    target: 'es2020'
                }
            }
        };

        configService = {
            getValue: xJet.fn().mockReturnValue(buildConfig),
            select: xJet.fn().mockImplementation(() => ({
                subscribe: (callback: any) => {
                    subscribeCallbackMock = xJet.fn(callback);

                    return subscribeCallbackMock;
                }
            }))
        } as any;

        // Mock inject to return configService
        xJet.mock(inject).mockImplementation((token: any) => {
            if (token === ConfigurationService) {
                return configService;
            }

            return xJet.mock(inject).original(token);
        });

        plugin = lifecycle.create();
    });

    describe('constructor', () => {
        test('initializes with valid variant configuration', () => {
            const extractEntryPointsMock = xJet.mock(extractEntryPoints);
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            expect(configService.getValue).toHaveBeenCalled();
            expect(typescriptMock).toHaveBeenCalledWith('tsconfig.json');
            expect(extractEntryPointsMock).toHaveBeenCalledWith(process.cwd(), [ 'src/index.ts' ]);
            extractEntryPointsMock.mockRestore();
        });

        test('throws error when variant config is missing', () => {
            expect(() => {
                new VariantService('nonexistent', lifecycle, undefined as any, argv);
            }).toThrow(xBuildError);

            expect(() => {
                new VariantService('nonexistent', lifecycle, undefined as any, argv);
            }).toThrow('Variant \'nonexistent\' not found configuration');
        });

        test('throws error when entry points are missing', () => {
            buildConfig.variants.production.esbuild.entryPoints = <any> undefined;

            expect(() => {
                new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            }).toThrow(xBuildError);

            expect(() => {
                new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            }).toThrow('Entry points are required in esbuild configuration');
        });

        test('merges common and variant configuration', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const mergedConfig = (service as any).buildConfig;
            expect(mergedConfig.esbuild.format).toBe('esm');
            expect(mergedConfig.esbuild.target).toBe('es2020');
            expect(mergedConfig.esbuild.bundle).toBe(true);
        });

        test('registers core start hook', () => {
            const onStartSpy = xJet.spyOn(lifecycle, 'onStart');
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            expect(onStartSpy).toHaveBeenCalledWith(
                expect.any(Function),
                `${ variantName }-core`
            );
        });

        test('subscribes to configuration changes', () => {
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            expect(configService.select).toHaveBeenCalledWith(expect.any(Function));
        });

        test('uses default tsconfig when not specified', () => {
            delete buildConfig.variants.production.esbuild.tsconfig;
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            expect(Typescript).toHaveBeenCalledWith('tsconfig.json');
        });
    });

    describe('dispose', () => {
        test('unsubscribes from configuration changes', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const unsubscribeSpy = xJet.fn();
            (service as any).configUnsubscribe = unsubscribeSpy;

            service.dispose();
            expect(unsubscribeSpy).toHaveBeenCalled();
        });

        test('disposes TypeScript module', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            service.dispose();

            expect(disposeSpy).toHaveBeenCalledWith('tsconfig.json');
        });
    });

    describe('build', () => {
        let service: VariantService;
        const buildMock = xJet.mock(build)
            .mockResolvedValue({ errors: [], warnings: [] });

        beforeEach(() => {
            xJet.resetAllMocks();

            xJet.mock(extractEntryPoints).mockReturnValue({
                'src/index': 'src/index.ts'
            });

            xJet.mock(analyzeDependencies).mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/index.ts': { bytes: 1 }
                    }
                }
            } as any);

            service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
        });

        test('executes esbuild with variant configuration', async () => {
            const result = await service.build();

            expect(buildMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    entryPoints: { 'src/index': 'src/index.ts' },
                    outdir: 'dist',
                    bundle: true
                })
            );

            expect(result).toBeDefined();
            expect(result?.errors).toEqual([]);
        });

        test('returns undefined when variant is inactive', async () => {
            (service as any).active = false;
            const result = await service.build();

            expect(result).toBeUndefined();
            expect(buildMock).not.toHaveBeenCalled();
        });

        test('applies banner injections before build', async () => {
            buildConfig.variants.production.banner = {
                js: '// Banner text'
            };

            service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            await service.build();

            expect(buildMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    banner: { js: '// Banner text' }
                })
            );
        });

        test('applies footer injections before build', async () => {
            buildConfig.variants.production.footer = {
                js: '// Footer text'
            };

            service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            await service.build();

            expect(buildMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    footer: { js: '// Footer text' }
                })
            );
        });

        test('handles esbuild errors gracefully', async () => {
            const buildError = {
                errors: [{ text: 'Build failed', location: null }],
                warnings: [{ text: 'Warning', location: null }]
            } as any;

            xJet.mock(buildMock).mockRejectedValue(buildError);

            const result = await service.build();

            expect(result).toBeDefined();
            expect(result?.errors).toEqual(buildError.errors);
            expect(result?.warnings).toEqual(buildError.warnings);
        });

        test('returns undefined for unexpected errors', async () => {
            xJet.mock(buildMock).mockRejectedValueOnce(new Error('Unexpected error') as any);
            await expect(service.build()).rejects.toThrow('Unexpected error');
        });

        test('applies dynamic banner function', async () => {
            buildConfig.variants.production.banner = {
                js: (name: string) => `// Build: ${ name }`
            };

            service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            await service.build();

            expect(buildMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    banner: { js: `// Build: ${ variantName }` }
                })
            );
        });
    });

    describe('touchFiles', () => {
        test('delegates to TypeScript module', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const files = [ 'src/index.ts', 'src/utils.ts' ];
            service.touchFiles(files);

            expect(touchFilesSpy).toHaveBeenCalledWith(files);
        });
    });

    describe('type checking', () => {
        const checkSpy: Typescript['check'] & MockState = xJet.fn(() => []) as any;
        const emitBundleSpy = xJet.fn();
        const diagnostics = [{ file: 'index.ts', message: 'Type error' }];

        beforeEach(() => {
            checkSpy.mockClear();
            emitBundleSpy.mockClear();

            typescriptMock.mockImplementation((): any => ({
                dispose: disposeSpy,
                touchFiles: touchFilesSpy,
                languageHostService: {
                    touchFiles: xJet.fn()
                },
                config: {
                    options: {
                        rootDir: process.cwd()
                    }
                },
                check: checkSpy,
                emitBundle: emitBundleSpy
            }));

            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
        });

        test('runs type checking on start hook', async () => {
            let startCallback: any;

            const mockBuild = {
                initialOptions: {},
                onStart: (cb: any) => {
                    startCallback = cb;
                },
                onEnd: xJet.fn(),
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any;

            plugin.setup(mockBuild);
            await startCallback();

            expect(checkSpy).toHaveBeenCalled();
        });

        test('adds type errors when type checking fails', async () => {
            checkSpy.mockReturnValue(diagnostics);
            let startCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: (cb: any) => { startCallback = cb; },
                onEnd: xJet.fn(),
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            const result = await startCallback();

            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].detail).toBeInstanceOf(TypesError);
        });

        test('adds type warnings when failOnError is false', async () => {
            buildConfig.variants.production.types = { failOnError: false };
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            checkSpy.mockReturnValue(diagnostics);
            let startCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: (cb: any) => { startCallback = cb; },
                onEnd: xJet.fn(),
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            const result = await startCallback();

            expect(result.warnings).toHaveLength(1);
            expect(result.errors).toHaveLength(0);
        });

        test('skips type checking when types is false', async () => {
            buildConfig.variants.production.types = false;
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            let startCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: (cb: any) => { startCallback = cb; },
                onEnd: xJet.fn(),
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            await startCallback();

            expect(checkSpy).not.toHaveBeenCalled();
        });
    });

    describe('declaration generation', () => {
        const emitSpy = xJet.fn();
        const checkSpy = xJet.fn(() => []);
        const emitBundleSpy = xJet.fn();

        beforeEach(() => {
            emitSpy.mockRestore();
            checkSpy.mockRestore();
            emitBundleSpy.mockRestore();

            typescriptMock.mockImplementation((): any => ({
                dispose: disposeSpy,
                touchFiles: touchFilesSpy,
                languageHostService: {
                    touchFiles: xJet.fn()
                },
                config: {
                    options: {
                        rootDir: process.cwd()
                    }
                },
                emit: emitSpy,
                check: checkSpy,
                emitBundle: emitBundleSpy
            }));
        });

        test('emits bundled declarations by default', async () => {
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            let endCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: xJet.fn(),
                onEnd: (cb: any) => { endCallback = cb; },
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            await endCallback({ errors: [], warnings: [] });

            expect(emitBundleSpy).toHaveBeenCalledWith(
                { 'src/index': 'src/index.ts' },
                undefined
            );
        });

        test('emits individual declarations when bundle is false', async () => {
            buildConfig.variants.production.declaration = { bundle: false };
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            let endCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: xJet.fn(),
                onEnd: (cb: any) => { endCallback = cb; },
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            await endCallback({ errors: [], warnings: [] });

            expect(emitSpy).toHaveBeenCalledWith(undefined);
            expect(emitBundleSpy).not.toHaveBeenCalled();
        });

        test('uses custom output directory', async () => {
            buildConfig.variants.production.declaration = {
                bundle: true,
                outDir: 'dist/types'
            };
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            let endCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: xJet.fn(),
                onEnd: (cb: any) => { endCallback = cb; },
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            await endCallback({ errors: [], warnings: [] });

            expect(emitBundleSpy).toHaveBeenCalledWith(
                expect.any(Object),
                'dist/types'
            );
        });

        test('adds warnings when declaration generation fails', () => {
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            emitBundleSpy.mockRejectedValue(new Error('Emit failed'));
            let endCallback: any;
            const buildResult: { errors: Array<Message>, warnings: Array<Message> } = { errors: [], warnings: [] };

            plugin.setup({
                initialOptions: {},
                onStart: xJet.fn(),
                onEnd: (cb: any) => { endCallback = cb; },
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            return endCallback(buildResult).then((result: any) => {
                expect(result).toBeUndefined();
                expect(buildResult.warnings).toHaveLength(1);
                expect(buildResult.warnings[0].detail).toBeInstanceOf(Error);
            });
        });

        test('skips declaration generation when disabled', async () => {
            buildConfig.variants.production.declaration = false;
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            let endCallback: any;

            plugin.setup({
                initialOptions: {},
                onStart: xJet.fn(),
                onEnd: (cb: any) => { endCallback = cb; },
                onResolve: xJet.fn(),
                onLoad: xJet.fn()
            } as any);

            await endCallback({ errors: [], warnings: [] });

            expect(emitBundleSpy).not.toHaveBeenCalled();
            expect(emitSpy).not.toHaveBeenCalled();
        });
    });

    describe('define replacements', () => {
        test('applies define replacements to esbuild config', () => {
            buildConfig.variants.production.define = {
                'process.env.NODE_ENV': 'production',
                'DEBUG': false,
                'VERSION': '1.0.0'
            };

            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const esbuildConfig = (service as any).buildConfig.esbuild;
            expect(esbuildConfig.define).toEqual({
                'process.env.NODE_ENV': '"production"',
                'DEBUG': 'false',
                'VERSION': '"1.0.0"'
            });
        });

        test('JSON stringifies all define values', () => {
            buildConfig.variants.production.define = {
                'OBJECT': { key: 'value' },
                'ARRAY': [ 1, 2, 3 ],
                'NULL': null
            };

            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const esbuildConfig = (service as any).buildConfig.esbuild;
            expect(esbuildConfig.define['OBJECT']).toBe('{"key":"value"}');
            expect(esbuildConfig.define['ARRAY']).toBe('[1,2,3]');
            expect(esbuildConfig.define['NULL']).toBe('null');
        });

        test('handles missing define configuration', () => {
            delete buildConfig.variants.production.define;
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const esbuildConfig = (service as any).buildConfig.esbuild;
            expect(esbuildConfig.define).toBeUndefined();
        });
    });

    describe('lifecycle hooks registration', () => {
        test('registers hooks from configuration', () => {
            const onStartHook = xJet.fn();
            const onEndHook = xJet.fn();
            buildConfig.variants.production.lifecycle = {
                onEnd: onEndHook,
                onStart: onStartHook
            } as any;

            const onStartSpy = xJet.spyOn(lifecycle, 'onStart');
            const onEndSpy = xJet.spyOn(lifecycle, 'onEnd');

            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            subscribeCallbackMock({
                variantConfig: buildConfig.variants.production,
                commonConfig: buildConfig.common
            });

            expect(onStartSpy).toHaveBeenCalledWith(onStartHook);
            expect(onEndSpy).toHaveBeenCalledWith(onEndHook);
        });

        test('registers all hook types', () => {
            const hooks = {
                onStart: xJet.fn(),
                onResolve: xJet.fn(),
                onLoad: xJet.fn(),
                onEnd: xJet.fn(),
                onSuccess: xJet.fn()
            };

            buildConfig.variants.production.lifecycle = <any> hooks;

            const spies = {
                onStart: xJet.spyOn(lifecycle, 'onStart'),
                onResolve: xJet.spyOn(lifecycle, 'onResolve'),
                onLoad: xJet.spyOn(lifecycle, 'onLoad'),
                onEnd: xJet.spyOn(lifecycle, 'onEnd'),
                onSuccess: xJet.spyOn(lifecycle, 'onSuccess')
            };

            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            subscribeCallbackMock({
                variantConfig: buildConfig.variants.production,
                commonConfig: buildConfig.common
            });

            expect(spies.onStart).toHaveBeenCalledWith(hooks.onStart);
            expect(spies.onResolve).toHaveBeenCalledWith(hooks.onResolve);
            expect(spies.onLoad).toHaveBeenCalledWith(hooks.onLoad);
            expect(spies.onEnd).toHaveBeenCalledWith(hooks.onEnd);
            expect(spies.onSuccess).toHaveBeenCalledWith(hooks.onSuccess);
        });

        test('handles missing lifecycle configuration', () => {
            delete buildConfig.variants.production.lifecycle;

            expect(() => {
                new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            }).not.toThrow();
        });
    });

    describe('configuration hot-reloading', () => {
        beforeEach(() => {
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
        });

        test('deactivates variant during config reload', async () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const newConfig = {
                ...buildConfig.variants.production,
                esbuild: { ...buildConfig.variants.production.esbuild, minify: true }
            };

            await subscribeCallbackMock({
                variantConfig: undefined,
                commonConfig: undefined
            });

            // Variant should be inactive during reload
            expect((service as any).active).toBe(false);

            await subscribeCallbackMock({
                variantConfig: newConfig,
                commonConfig: buildConfig.common
            });

            // Variant should be active after reload
            expect((service as any).active).toBe(true);
        });

        test('updates build configuration', async () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const newConfig = {
                ...buildConfig.variants.production,
                esbuild: {
                    ...buildConfig.variants.production.esbuild,
                    minify: true,
                    sourcemap: true
                }
            };

            await subscribeCallbackMock({
                variantConfig: newConfig,
                commonConfig: buildConfig.common
            });

            const updatedConfig = (service as any).buildConfig;
            expect(updatedConfig.esbuild.minify).toBe(true);
            expect(updatedConfig.esbuild.sourcemap).toBe(true);
        });

        test('recreates TypeScript module when tsconfig changes', async () => {
            new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const newConfig = {
                ...buildConfig.variants.production,
                esbuild: {
                    ...buildConfig.variants.production.esbuild,
                    tsconfig: 'tsconfig.prod.json'
                }
            };

            await subscribeCallbackMock({
                variantConfig: newConfig,
                commonConfig: buildConfig.common
            });

            expect(disposeSpy).toHaveBeenCalledWith('tsconfig.json');
            expect(Typescript).toHaveBeenCalledWith('tsconfig.prod.json');
        });

        test('preserves TypeScript module when tsconfig unchanged', async () => {
            await subscribeCallbackMock({
                variantConfig: buildConfig.variants.production,
                commonConfig: buildConfig.common
            });

            expect(disposeSpy).toHaveBeenCalledTimes(0);
        });

        test('rebuilds entry points on config change', async () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const newConfig = {
                ...buildConfig.variants.production,
                esbuild: {
                    ...buildConfig.variants.production.esbuild,
                    entryPoints: [ 'src/main.ts', 'src/worker.ts' ]
                }
            };

            xJet.mock(extractEntryPoints).mockReturnValue({
                main: '/project/src/main.ts',
                worker: '/project/src/worker.ts'
            });

            await subscribeCallbackMock({
                variantConfig: newConfig,
                commonConfig: buildConfig.common
            });

            expect(extractEntryPoints).toHaveBeenCalledWith(process.cwd(), [
                'src/main.ts',
                'src/worker.ts'
            ]);

            const entryPoints = (service as any).buildConfig.esbuild.entryPoints;
            expect(entryPoints).toEqual({
                main: '/project/src/main.ts',
                worker: '/project/src/worker.ts'
            });
        });

        test('handles variant removal from configuration', async () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            await subscribeCallbackMock({
                variantConfig: undefined,
                commonConfig: buildConfig.common
            });

            expect((service as any).active).toBe(false);
        });

        test('reapplies define replacements on config change', async () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const newConfig = {
                ...buildConfig.variants.production,
                define: {
                    NEW_DEFINE: 'value'
                }
            };

            await subscribeCallbackMock({
                variantConfig: newConfig,
                commonConfig: buildConfig.common
            });

            const esbuildConfig = (service as any).buildConfig.esbuild;
            expect(esbuildConfig.define['NEW_DEFINE']).toBe('"value"');
        });
    });

    describe('esbuild configuration', () => {
        test('sets log level to silent', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);

            const esbuildConfig = (service as any).buildConfig.esbuild;
            expect(esbuildConfig.logLevel).toBe('silent');
        });

        test('includes lifecycle provider plugin', () => {
            const service = new VariantService(variantName, lifecycle, buildConfig.variants.production as any, argv);
            const esbuildConfig = (service as any).buildConfig.esbuild;

            expect(esbuildConfig.plugins).toHaveLength(1);
            expect(esbuildConfig.plugins[0].name).toBe(variantName);
        });
    });
});
