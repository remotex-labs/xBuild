/**
 * Import will remove at compile time
 */

import type { BuildOptions } from 'esbuild';

/**
 * Imports
 */

import { cwd } from 'process';
import { build } from 'esbuild';
import { xBuildLazy } from '@errors/stack.error';
import { analyzeDependencies, defaultBuildOptions, extractSourceMap, transpileFile } from '@services/transpiler.service';

/**
 * Mocks
 */

const buildMock = xJet.mock(build);

beforeEach(() => {
    xJet.resetAllMocks();
});

/**
 * Tests
 */

describe('RemoteX Transpiler', () => {
    describe('extractSourceMap', () => {
        test('should extract the source map and return the modified code and source map', () => {
            // eslint-disable-next-line max-len
            const dataString = 'console.log("hello world"); //# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvaW5kZXgudHMiLCJzb3VyY2VzIjpbInNyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9';
            const result = extractSourceMap(dataString);

            expect(result).toEqual({
                code: 'console.log("hello world"); ',
                // eslint-disable-next-line max-len
                sourceMap: 'eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvaW5kZXgudHMiLCJzb3VyY2VzIjpbInNyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9'
            });
        });

        test('should throw an error if the source map URL is not found', () => {
            const dataString = 'console.log("hello world");';
            xJet.mock(xBuildLazy).mockReturnValue(<any>{
                get service() {
                    return {
                        file: 'x'
                    };
                }
            });

            expect(() => extractSourceMap(dataString)).toThrow('Source map URL not found in the output.');
        });
    });

    describe('transpileFile', () => {
        const filePath = './src/index.ts';
        // eslint-disable-next-line max-len
        const transpiledCode = 'console.log("hello world"); //# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvaW5kZXgudHMiLCJzb3VyY2VzIjpbInNyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9';

        beforeEach(() => {
            buildMock.mockResolvedValue(<any> {
                outputFiles: [{ text: transpiledCode }]
            });
        });

        afterEach(() => {
            xJet.resetAllMocks();
        });

        test('should transpile a TypeScript file and extract the source map', async () => {
            const result = await transpileFile(filePath);

            expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
                absWorkingDir: cwd(),
                ...defaultBuildOptions,
                entryPoints: [ filePath ]
            }));
            expect(result).toEqual({
                code: 'console.log("hello world"); ',
                // eslint-disable-next-line max-len
                sourceMap: 'eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvaW5kZXgudHMiLCJzb3VyY2VzIjpbInNyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyJ9'
            });
        });

        test('should use provided build options to override default options', async () => {
            const customOptions: BuildOptions = {
                minify: false
            };

            await transpileFile(filePath, customOptions);

            expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
                absWorkingDir: cwd(),
                ...defaultBuildOptions,
                ...customOptions,
                entryPoints: [ filePath ]
            }));
        });

        test('should throw an error if the build process fails', async () => {
            buildMock.mockRejectedValue(new Error('Build failed') as any);

            await expect(transpileFile(filePath)).rejects.toThrow('Build failed');
        });
    });
});

describe('analyzeDependencies', () => {
    const mockMetafile = {
        inputs: {
            'src/index.js': {
                bytes: 1234,
                imports: []
            }
        },
        outputs: {
            'dist/output.js': {
                bytes: 5678,
                imports: []
            }
        }
    };

    beforeEach(() => {
        buildMock.mockResolvedValue(<any> {
            metafile: mockMetafile
        });
    });

    afterEach(() => {
        xJet.resetAllMocks();
    });

    test('should analyze dependencies for a browser platform', async () => {
        const entryPoint = [ './src/index.js' ];
        const platform = 'browser';

        const result = await analyzeDependencies(entryPoint, platform);

        expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
            entryPoints: entryPoint,
            bundle: true,
            write: false,
            metafile: true,
            platform: platform,
            logLevel: 'silent'
        }));
        expect(result).toEqual({ metafile: mockMetafile });
    });

    test('should analyze dependencies for a node platform', async () => {
        const entryPoint = [ './src/index.js' ];
        const platform = 'node';

        const result = await analyzeDependencies(entryPoint, platform);

        expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
            entryPoints: entryPoint,
            bundle: true,
            write: false,
            metafile: true,
            platform: platform,
            logLevel: 'silent'
        }));
        expect(result).toEqual({ metafile: mockMetafile });
    });

    test('should analyze dependencies for a neutral platform', async () => {
        const entryPoint = [ './src/index.js' ];
        const platform = 'neutral';

        const result = await analyzeDependencies(entryPoint, platform);

        expect(buildMock).toHaveBeenCalledWith(expect.objectContaining({
            entryPoints: entryPoint,
            bundle: true,
            write: false,
            metafile: true,
            platform: platform,
            logLevel: 'silent'
        }));
        expect(result).toEqual({ metafile: mockMetafile });
    });

    test('should throw an error if the build process fails', async () => {
        buildMock.mockRejectedValue(new Error('Build failed') as any);

        await expect(analyzeDependencies([ './src/index.js' ], 'browser')).rejects.toThrow('Build failed');
    });
});
