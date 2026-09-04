/**
 * Imports
 */

import { resolve } from 'path';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { ArgvModule } from '@argv/argv.module';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { sandboxExecute } from '@services/vm.service';
import { FrameworkService } from '@services/framework.service';
import { buildFromString } from '@services/transpiler.service';
import { configFileProvider, execConfigFile } from './config-file.provider';

/**
 * Tests
 */

describe('config-file.provider', () => {
    const path = 'xbuild.config.ts';
    const cache = inject(FilesModel);
    const source = 'export const config = { variants: {} };';
    const sourceMap = '{"version":3,"file":"config.js","sources":["config.ts"],"names":[],"mappings":"AAAA"}';
    const defaults = { watch: { filter: [ '**/*.{js,ts,json}', '!**/*.d.ts' ], recursive: true } };

    let touchMock: any;
    let buildMock: any;
    let sandboxMock: any;
    let requireMock: any;
    let sourceMapMock: any;
    let parseMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockReturnValue(<any> sourceMap);

        touchMock = xJet.spyOn(cache, 'touch').mockReturnValue(<any> { version: 1, snapshot: { text: source } });
        sourceMapMock = xJet.spyOn(inject(FrameworkService), 'addSourceMap').mockReturnValue(undefined);
        requireMock = xJet.mock(createRequire).mockReturnValue(<any> 'require-of-config');
        parseMock = xJet.spyOn(ArgvModule.prototype, 'enhancedParse')
            .mockReturnValue(<any> { config: path, watch: true });

        buildMock = xJet.mock(buildFromString).mockResolvedValue(<any> {
            outputFiles: [{ text: 'map-text' }, { text: 'built' }]
        });

        sandboxMock = xJet.mock(sandboxExecute).mockImplementation(async (_: string, sandbox: any) => {
            sandbox.module.exports.config = { variants: { esm: {} } };
        });
    });

    describe('execConfigFile', () => {
        test('should run the code with a module to export through', async () => {
            await execConfigFile('built', path);

            expect(sandboxMock).toHaveBeenCalledWith(
                'built',
                { require: 'require-of-config', module: expect.any(Object), $argv: {} },
                { filename: path },
                false
            );
        });

        test('should bind require to the file the configuration sits in', async () => {
            await execConfigFile('built', path);

            expect(requireMock).toHaveBeenCalledWith(resolve(path));
        });

        test('should hand the code the arguments it was given', async () => {
            const args = { watch: true };
            await execConfigFile('built', path, args);

            expect(sandboxMock.mock.calls[0][1].$argv).toBe(args);
        });

        test('should isolate the logs of the run when it is told to', async () => {
            await execConfigFile('built', path, {}, true);

            expect(sandboxMock.mock.calls[0][3]).toBe(true);
        });

        test('should give back what the file exported as config', async () => {
            expect(await execConfigFile('built', path)).toEqual({ variants: { esm: {} } });
        });

        test('should give back what the file exported by default', async () => {
            sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                sandbox.module.exports = { default: { variants: { cjs: {} } } };
            });

            expect(await execConfigFile('built', path)).toEqual({ variants: { cjs: {} } });
        });

        test('should keep the config export over the default one', async () => {
            sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                sandbox.module.exports = { config: { minify: true }, default: { minify: false } };
            });

            expect(await execConfigFile('built', path)).toEqual({ minify: true });
        });

        test('should give back nothing for a file that exported neither', async () => {
            sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                sandbox.module.exports = {};
            });

            expect(await execConfigFile('built', path)).toEqual({});
        });

        test('should give back nothing for a file whose exports stayed empty', async () => {
            sandboxMock.mockResolvedValue(undefined);

            expect(await execConfigFile('built', path)).toEqual({});
        });

        test('should reject with what the configuration threw as it ran', async () => {
            sandboxMock.mockRejectedValue(new Error('region is not defined'));

            await expect(execConfigFile('built', path)).rejects.toThrow('region is not defined');
        });
    });

    describe('configFileProvider', () => {
        describe('the file it reads', () => {
            test('should read the file through the cache', async () => {
                await configFileProvider(path);

                expect(touchMock).toHaveBeenCalledWith(path);
            });

            test('should give back nothing for a file that is not there', async () => {
                touchMock.mockReturnValue(<any> { version: 1, snapshot: undefined });

                expect(await configFileProvider(path)).toEqual({});
                expect(buildMock).not.toHaveBeenCalled();
            });

            test('should give back nothing for a file carrying no text', async () => {
                touchMock.mockReturnValue(<any> { version: 1, snapshot: { text: '' } });

                expect(await configFileProvider(path)).toEqual({});
                expect(buildMock).not.toHaveBeenCalled();
            });
        });

        describe('the build it runs the file through', () => {
            test('should build the file as a node module the runtime can require from', async () => {
                await configFileProvider(path);

                expect(buildMock).toHaveBeenCalledWith(source, path, {
                    minify: false,
                    format: 'cjs',
                    platform: 'node',
                    logLevel: 'silent',
                    packages: 'external',
                    minifySyntax: true,
                    minifyWhitespace: true,
                    minifyIdentifiers: false
                });
            });

            test('should register the map beside the code it built', async () => {
                await configFileProvider(path);

                expect(sourceMapMock).toHaveBeenCalledWith(path, 'map-text');
            });

            test('should reject with what the build threw', async () => {
                buildMock.mockRejectedValue(new Error('Expected ";" but found "}"'));

                await expect(configFileProvider(path)).rejects.toThrow('Expected ";" but found "}"');
                expect(sandboxMock).not.toHaveBeenCalled();
            });
        });

        describe('the two runs it makes', () => {
            test('should run the built code twice, the first run knowing no arguments', async () => {
                await configFileProvider(path);

                expect(sandboxMock).toHaveBeenCalledTimes(2);
                expect(sandboxMock.mock.calls[0][0]).toBe('built');
                expect(sandboxMock.mock.calls[0][1].$argv).toEqual({});
            });

            test('should isolate the logs of the first run alone', async () => {
                await configFileProvider(path);

                expect(sandboxMock.mock.calls[0][3]).toBe(true);
                expect(sandboxMock.mock.calls[1][3]).toBe(false);
            });

            test('should hand the second run the arguments the first run made sense of', async () => {
                const args = { config: path, env: 'prod' };
                parseMock.mockReturnValue(args);

                await configFileProvider(path);

                expect(sandboxMock.mock.calls[1][1].$argv).toBe(args);
            });

            test('should parse the command line with the options the file declares', async () => {
                const userArgv = { env: { type: 'string' } };
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports.config = { userArgv, variants: {} };
                });

                await configFileProvider(path);

                expect(parseMock).toHaveBeenCalledWith(process.argv, userArgv);
            });

            test('should parse the command line with no user options when the file declares none', async () => {
                await configFileProvider(path);

                expect(parseMock).toHaveBeenCalledWith(process.argv, {});
            });

            test('should write the parsed arguments into the record the caller handed it', async () => {
                const argv: Record<string, unknown> = {};
                parseMock.mockReturnValue({ config: path, watch: true });

                await configFileProvider(path, argv);

                expect(argv).toEqual({ config: path, watch: true });
            });
        });

        describe('the configuration it gives back', () => {
            test('should lay what the file exported over the defaults', async () => {
                expect(await configFileProvider(path)).toEqual({ ...defaults, variants: { esm: {} } });
            });

            test('should give back the defaults alone for a file that exported nothing', async () => {
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports = {};
                });

                expect(await configFileProvider(path)).toEqual(defaults);
            });

            test('should lay what the file names over the block the defaults name', async () => {
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports.config = { watch: { paths: [ 'src' ] } };
                });

                expect(await configFileProvider(path)).toEqual({
                    watch: { ...defaults.watch, paths: [ 'src' ] }
                });
            });

            test('should add to a list the defaults name rather than replacing it', async () => {
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports.config = { watch: { filter: [ 'docs/**' ] } };
                });

                expect(await configFileProvider(path)).toEqual({
                    watch: { recursive: true, filter: [ '**/*.{js,ts,json}', '!**/*.d.ts', 'docs/**' ] }
                });
            });

            test('should let the file overwrite a value the defaults name', async () => {
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports.config = { watch: { recursive: false } };
                });

                expect(await configFileProvider(path)).toEqual({
                    watch: { filter: defaults.watch.filter, recursive: false }
                });
            });

            test('should give back a record of its own rather than the exported one', async () => {
                const config = { variants: { esm: {} } };
                sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
                    sandbox.module.exports = { config };
                });

                const loaded: any = await configFileProvider(path);

                expect(loaded).not.toBe(config);
                expect(loaded.variants).not.toBe(config.variants);
            });
        });
    });
});
