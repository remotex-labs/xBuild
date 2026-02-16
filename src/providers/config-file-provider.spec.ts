/**
 * Import will remove at compile time
 */

import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { runInThisContext } from 'vm';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { inject } from '@symlinks/symlinks.module';
import { resolve } from '@components/path.component';
import { buildFiles } from '@services/transpiler.service';
import { configFileProvider } from './config-file.provider';

/**
 * Tests
 */

describe('configFileProvider', () => {
    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'config.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    const dummyCode = `
        module.exports.config = {
            variants: {
                esm: {
                    esbuild: {
                        format: 'esm'
                    }
                }
            }
        };
    `;

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
        globalThis.module = { exports: {} } as any;
        globalThis.require = undefined as any;

        // Default mock for runInThisContext that simulates code execution
        xJet.mock(runInThisContext).mockImplementation((() => {
            // Simulate basic module.exports setup
            globalThis.module.exports = { config: {} };
        }) as any);
    });

    describe('file validation', () => {
        test('should return empty object when path is not provided', async () => {
            const result = await configFileProvider('');

            expect(result).toEqual({});
        });

        test('should return empty object when path is null', async () => {
            const result = await configFileProvider(null as any);

            expect(result).toEqual({});
        });

        test('should return empty object when path is undefined', async () => {
            const result = await configFileProvider(undefined as any);

            expect(result).toEqual({});
        });

        test('should return empty object when file does not exist', async () => {
            const existsSyncMock = xJet.mock(existsSync).mockReturnValue(false);

            const result = await configFileProvider('non-existent.config.ts');

            expect(existsSyncMock).toHaveBeenCalledWith('non-existent.config.ts');
            expect(result).toEqual({});
        });

        test('should proceed when file exists', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const buildFilesMock = xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: { esm: { esbuild: { format: 'esm' } } }
                };
            }) as any);

            await configFileProvider('config.xbuild.ts');

            expect(buildFilesMock).toHaveBeenCalled();
        });
    });

    describe('transpilation', () => {
        test('should call buildFiles with correct path and options', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const buildFilesMock = xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            await configFileProvider('config.xbuild.ts');

            expect(buildFilesMock).toHaveBeenCalledWith(
                [ 'config.xbuild.ts' ],
                expect.objectContaining({
                    outdir: 'tmp',
                    format: 'cjs',
                    platform: 'node',
                    packages: 'external',
                    preserveSymlinks: true,
                    minify: false,
                    minifySyntax: true,
                    minifyWhitespace: true,
                    minifyIdentifiers: false,
                    logLevel: 'silent'
                })
            );
        });

        test('should use CommonJS format for transpilation', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const buildFilesMock = xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            await configFileProvider('config.xbuild.ts');

            const callArgs = buildFilesMock.mock.calls[0][1];
            expect(callArgs?.format).toBe('cjs');
        });

        test('should preserve symlinks during transpilation', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const buildFilesMock = xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            await configFileProvider('config.xbuild.ts');

            const callArgs = buildFilesMock.mock.calls[0][1];
            expect(callArgs?.preserveSymlinks).toBe(true);
        });

        test('should mark packages as external', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const buildFilesMock = xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            await configFileProvider('config.xbuild.ts');

            const callArgs = buildFilesMock.mock.calls[0][1];
            expect(callArgs?.packages).toBe('external');
        });
    });

    describe('source map registration', () => {
        test('should register source map with FrameworkService', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const mockFramework = {
                setSource: xJet.fn()
            };

            xJet.mock(inject).mockReturnValueOnce({ touchFile: xJet.fn() });
            xJet.mock(inject).mockReturnValueOnce(mockFramework);

            await configFileProvider('test.config.ts');

            expect(mockFramework.setSource).toHaveBeenCalledWith(dummySourceMap, 'test.config.ts');
        });

        test('should pass correct file path to setSource', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const mockFramework = {
                setSource: xJet.fn()
            };

            xJet.mock(inject).mockReturnValueOnce({ touchFile: xJet.fn() });
            xJet.mock(inject).mockReturnValueOnce(mockFramework);
            const configPath = 'custom/path/config.ts';
            await configFileProvider(configPath);

            expect(mockFramework.setSource).toHaveBeenCalledWith(
                expect.any(String),
                configPath
            );
        });
    });

    describe('module context setup', () => {
        test('should set up globalThis.module with exports object', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            await configFileProvider('config.ts');

            expect(globalThis.module).toBeDefined();
            expect(globalThis.module.exports).toBeDefined();
            expect(typeof globalThis.module.exports).toBe('object');
        });

        test('should set up globalThis.require function', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            xJet.mock(createRequire).mockReturnValue((() => {
            }) as any);

            await configFileProvider('/absolute/path/config.ts');

            expect(globalThis.require).toBeDefined();
            expect(typeof globalThis.require).toBe('function');
        });

        test('should create require with resolved path', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const createRequireMock = xJet.mock(createRequire)
                .mockReturnValue((() => {
                }) as any);

            xJet.mock(resolve).mockImplementationOnce((path: string) => `/resolved/${ path }`);

            await configFileProvider('config.ts');

            expect(createRequireMock).toHaveBeenCalled();
        });
    });

    describe('code execution', () => {
        test('should execute transpiled code in VM context', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const runInThisContextMock = xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: { esm: { esbuild: { format: 'esm' } } }
                };
            }) as any);

            await configFileProvider('config.ts');

            expect(runInThisContextMock).toHaveBeenCalledWith(
                dummyCode,
                { filename: 'config.ts' }
            );
        });

        test('should use original filename in VM context', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const runInThisContextMock = xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {};
            }) as any);

            await configFileProvider('custom.config.ts');

            expect(runInThisContextMock).toHaveBeenCalledWith(
                expect.any(String),
                { filename: 'custom.config.ts' }
            );
        });
    });

    describe('export extraction', () => {
        test('should return config from named export', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const namedExportCode = `
                module.exports.config = {
                    variants: { esm: { esbuild: { format: 'esm' } } }
                };
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: namedExportCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: { esm: { esbuild: { format: 'esm' } } }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result.variants).toBeDefined();
            expect(result.variants?.esm).toBeDefined();
        });

        test('should fallback to default export when config is not present', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const defaultExportCode = `
                module.exports.default = {
                    common: { types: true }
                };
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: defaultExportCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.default = {
                    common: { types: true }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result.common).toBeDefined();
            expect(result.common?.types).toBe(true);
        });

        test('should return empty object when no valid export is found', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const noExportCode = `
                module.exports = {};
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: noExportCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports = {};
            }) as any);

            const result = await configFileProvider('config.ts');

            expect(result).toEqual({});
        });

        test('should return empty object when exports are undefined', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const undefinedExportCode = `
                module.exports.config = undefined;
                module.exports.default = undefined;
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: undefinedExportCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = undefined;
                globalThis.module.exports.default = undefined;
            }) as any);

            const result = await configFileProvider('config.ts');

            expect(result).toEqual({});
        });

        test('should prefer named config export over default', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const bothExportsCode = `
                module.exports.config = { source: 'named' };
                module.exports.default = { source: 'default' };
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: bothExportsCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = { source: 'named' };
                globalThis.module.exports.default = { source: 'default' };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(result.source).toBe('named');
        });
    });

    describe('type safety', () => {
        test('should support generic type parameter', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const customCode = `
                module.exports.config = {
                    customField: 'test',
                    variants: {}
                };
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: customCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    customField: 'test',
                    variants: {}
                };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(result.customField).toBe('test');
        });

        test('should return properly typed empty object', async () => {
            xJet.mock(existsSync).mockReturnValue(false);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result).toEqual({});
            expect(typeof result).toBe('object');
        });
    });

    describe('complex configurations', () => {
        test('should handle configuration with multiple variants', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            const multiVariantCode = `
                module.exports.config = {
                    variants: {
                        esm: { esbuild: { format: 'esm' } },
                        cjs: { esbuild: { format: 'cjs' } },
                        production: { esbuild: { minify: true } }
                    }
                };
            `;

            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: multiVariantCode }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: { esbuild: { format: 'esm' } },
                        cjs: { esbuild: { format: 'cjs' } },
                        production: { esbuild: { minify: true } }
                    }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result.variants?.esm).toBeDefined();
            expect(result.variants?.cjs).toBeDefined();
            expect(result.variants?.production).toBeDefined();
        });

        test('should handle configuration with common settings', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    common: {
                        types: true,
                        declaration: { bundle: true }
                    },
                    variants: {
                        esm: { esbuild: { format: 'esm' } }
                    }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result.common?.types).toBe(true);
            expect(result.common?.declaration).toBeDefined();
        });

        test('should handle configuration with lifecycle hooks', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: {
                            esbuild: { format: 'esm' },
                            lifecycle: {
                                onStart: async () => {
                                },
                                onEnd: async () => {
                                }
                            }
                        }
                    }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('config.ts');

            expect(result.variants?.esm?.lifecycle).toBeDefined();
        });

        test('should handle nested configuration objects', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: {
                            esbuild: {
                                format: 'esm',
                                define: {
                                    'process.env.NODE_ENV': 'production'
                                },
                                alias: {
                                    '@': './src'
                                }
                            }
                        }
                    }
                };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(result.variants.esm.esbuild.define).toBeDefined();
            expect(result.variants.esm.esbuild.alias).toBeDefined();
        });
    });

    describe('error handling', () => {
        test('should propagate buildFiles errors', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockRejectedValue(new Error('Transpilation failed') as any);

            await expect(configFileProvider('config.ts')).rejects.toThrow('Transpilation failed');
        });

        test('should propagate VM execution errors', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation(() => {
                throw new Error('Invalid config syntax');
            });

            await expect(configFileProvider('config.ts')).rejects.toThrow('Invalid config syntax');
        });

        test('should handle missing outputFiles', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: undefined
            } as any);

            await expect(configFileProvider('config.ts')).rejects.toThrow();
        });

        test('should handle empty outputFiles array', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: []
            } as any);

            await expect(configFileProvider('config.ts')).rejects.toThrow();
        });
    });

    describe('integration scenarios', () => {
        test('should load real-world configuration structure', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    common: {
                        types: true,
                        declaration: { bundle: true, outDir: 'types' }
                    },
                    variants: {
                        esm: {
                            esbuild: {
                                format: 'esm',
                                entryPoints: [ 'src/index.ts' ],
                                outdir: 'dist/esm',
                                bundle: true,
                                minify: false,
                                sourcemap: true
                            }
                        },
                        cjs: {
                            esbuild: {
                                format: 'cjs',
                                entryPoints: [ 'src/index.ts' ],
                                outdir: 'dist/cjs',
                                bundle: true
                            }
                        }
                    }
                };
            }) as any);

            const result = await configFileProvider<xBuildConfigInterface>('xbuild.config.ts');

            expect(result.common?.types).toBe(true);
            expect(result.common?.declaration).toBeDefined();
            expect(result.variants?.esm).toBeDefined();
            expect(result.variants?.cjs).toBeDefined();
            expect(result.variants?.esm?.esbuild.format).toBe('esm');
            expect(result.variants?.cjs?.esbuild.format).toBe('cjs');
        });

        test('should handle absolute file paths', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const absolutePath = '/absolute/path/to/config.ts';
            const result = await configFileProvider(absolutePath);

            expect(result).toBeDefined();
        });

        test('should handle relative file paths', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const relativePath = './config/xbuild.config.ts';
            const result = await configFileProvider(relativePath);

            expect(result).toBeDefined();
        });

        test('should support .js configuration files', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: dummyCode }
                ]
            } as any);

            const result = await configFileProvider('xbuild.config.js');

            expect(result).toBeDefined();
        });
    });

    describe('edge cases', () => {
        test('should handle configuration with null values', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: null
                    }
                };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(result.variants.esm).toBeNull();
        });

        test('should handle configuration with array values', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: {
                            esbuild: {
                                entryPoints: [ 'src/index.ts', 'src/utils.ts' ]
                            }
                        }
                    }
                };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(Array.isArray(result.variants.esm.esbuild.entryPoints)).toBe(true);
            expect(result.variants.esm.esbuild.entryPoints).toHaveLength(2);
        });

        test('should handle very large configurations', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            const largeConfig = {
                variants: {} as Record<string, any>
            };

            for (let i = 0; i < 100; i++) {
                largeConfig.variants[`variant${ i }`] = {
                    esbuild: { format: 'esm' }
                };
            }

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = largeConfig;
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(Object.keys(result.variants)).toHaveLength(100);
        });

        test('should handle configuration with special characters in strings', async () => {
            xJet.mock(existsSync).mockReturnValue(true);
            xJet.mock(buildFiles).mockResolvedValue({
                outputFiles: [
                    { text: dummySourceMap },
                    { text: '' }
                ]
            } as any);

            xJet.mock(runInThisContext).mockImplementation((() => {
                globalThis.module.exports.config = {
                    variants: {
                        esm: {
                            esbuild: {
                                banner: { js: '// Copyright © 2024\n// "Special" \'chars\'' }
                            }
                        }
                    }
                };
            }) as any);

            const result = await configFileProvider<any>('config.ts');

            expect(result.variants.esm.esbuild.banner).toBeDefined();
        });
    });
});
