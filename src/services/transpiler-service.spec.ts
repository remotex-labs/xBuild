/**
 * Imports
 */

import { cwd } from 'process';
import { build } from 'esbuild';
import { buildFiles, buildFromString, analyzeDependencies } from '@services/transpiler.service';

/**
 * Tests
 */

const mockResult: any = {
    errors: [],
    warnings: [],
    outputFiles: [],
    metafile: { inputs: {}, outputs: {} }
};

beforeEach(() => {
    xJet.restoreAllMocks();
    xJet.mock(build).mockResolvedValue(<any> mockResult);
});

describe('buildFiles', () => {
    test('should build with the default options, the working directory, and the metafile when given nothing', async () => {
        const result = await buildFiles();

        expect(result).toBe(mockResult);
        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                write: false,
                bundle: true,
                minify: true,
                outdir: 'dist',
                format: 'cjs',
                target: 'esnext',
                logLimit: 0,
                logLevel: 'silent',
                platform: 'browser',
                sourcemap: 'external',
                metafile: true,
                absWorkingDir: cwd()
            })
        );
    });

    test('should carry the entry points in the options like any other setting', async () => {
        await buildFiles({ entryPoints: [ 'src/index.ts' ] });

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({ entryPoints: [ 'src/index.ts' ] })
        );
    });

    test('should fix the metafile over the caller and leave every other option theirs', async () => {
        await buildFiles({
            write: true,
            bundle: false,
            minify: false,
            outdir: 'out',
            format: 'esm',
            target: 'es2020',
            logLimit: 10,
            logLevel: 'info',
            metafile: false,
            platform: 'node',
            sourcemap: 'inline',
            absWorkingDir: 'D:/app'
        });

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                write: true,
                bundle: false,
                minify: false,
                outdir: 'out',
                format: 'esm',
                target: 'es2020',
                logLimit: 10,
                logLevel: 'info',
                metafile: true,
                platform: 'node',
                sourcemap: 'inline',
                absWorkingDir: 'D:/app'
            })
        );
    });

    test('should propagate errors from esbuild.build', async () => {
        const fakeError = new Error('ESBuild failed');
        (<any> build).mockRejectedValue(fakeError);

        await expect(buildFiles({ entryPoints: [ 'src/fail.ts' ] })).rejects.toBe(fakeError);
    });
});

describe('buildFromString', () => {
    test('should feed the source through stdin with the default options', async () => {
        const result = await buildFromString('export const x: number = 42;', 'virtual.ts');

        expect(result).toBe(mockResult);
        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                bundle: true,
                minify: true,
                outdir: 'dist',
                format: 'cjs',
                target: 'esnext',
                logLimit: 0,
                logLevel: 'silent',
                platform: 'browser',
                absWorkingDir: cwd(),
                stdin: {
                    loader: 'ts',
                    contents: 'export const x: number = 42;',
                    resolveDir: '.',
                    sourcefile: 'virtual.ts'
                }
            })
        );
    });

    test('should fix its own stdin, in-memory output, metafile, and source map, leaving logging the caller\'s', async () => {
        await buildFromString('const x = 1;', 'virtual.ts', {
            write: true,
            minify: false,
            target: 'es2020',
            metafile: false,
            logLevel: 'info',
            sourcemap: 'inline',
            stdin: { contents: 'other', loader: 'js', sourcefile: 'other.js' }
        });

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                write: false,
                minify: false,
                target: 'es2020',
                metafile: true,
                logLevel: 'info',
                sourcemap: 'external',
                stdin: {
                    loader: 'ts',
                    contents: 'const x = 1;',
                    resolveDir: '.',
                    sourcefile: 'virtual.ts'
                }
            })
        );
    });

    test('should resolve the source imports against the directory the path names', async () => {
        await buildFromString('const x = 1;', 'src/config/virtual.ts', { absWorkingDir: 'D:/app' });

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                absWorkingDir: 'D:/app',
                stdin: expect.objectContaining({ resolveDir: 'src/config' })
            })
        );
    });

    test('should report the source under the file the path names rather than the whole of it', async () => {
        await buildFromString('const x = 1;', 'src/config/virtual.ts');

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                stdin: expect.objectContaining({ resolveDir: 'src/config', sourcefile: 'virtual.ts' })
            })
        );
    });

    test('should resolve against the directory an absolute path names', async () => {
        await buildFromString('const x = 1;', '/project/src/config.ts');

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                stdin: expect.objectContaining({ resolveDir: '/project/src' })
            })
        );
    });

    test('should resolve against the current directory for a path naming none', async () => {
        await buildFromString('const x = 1;', 'virtual.ts');

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                stdin: expect.objectContaining({ resolveDir: '.' })
            })
        );
    });

    test('should propagate errors from esbuild.build', async () => {
        const fakeError = new Error('ESBuild failed');
        (<any> build).mockRejectedValue(fakeError);

        await expect(buildFromString('const x = 1;', 'virtual.ts')).rejects.toBe(fakeError);
    });
});

describe('analyzeDependencies', () => {
    test('should call esbuild.build with the fixed analysis options', async () => {
        const result = await analyzeDependencies({ entryPoints: [ 'src/index.ts' ] });

        expect(result).toBe(mockResult);
        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                outdir: 'tmp',
                write: false,
                bundle: true,
                outfile: undefined,
                metafile: true,
                packages: 'external',
                logLevel: 'silent',
                entryPoints: [ 'src/index.ts' ]
            })
        );
    });

    test('should merge the caller options and override the ones it fixes', async () => {
        await analyzeDependencies({
            write: true,
            bundle: false,
            minify: true,
            outfile: 'dist/bundle.js',
            packages: 'bundle',
            platform: 'node',
            sourcemap: 'inline',
            entryPoints: [ 'src/app.ts' ]
        });

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                write: false,
                bundle: true,
                minify: true,
                outfile: undefined,
                packages: 'external',
                platform: 'node',
                sourcemap: 'inline',
                entryPoints: [ 'src/app.ts' ]
            })
        );
    });

    test('should not apply the default build options', async () => {
        await analyzeDependencies({ entryPoints: [ 'src/index.ts' ] });
        const [ options ] = (<any> build).mock.calls[0];

        expect(options.minify).toBeUndefined();
        expect(options.format).toBeUndefined();
        expect(options.platform).toBeUndefined();
        expect(options.absWorkingDir).toBeUndefined();
    });

    test('should propagate errors from esbuild.build', async () => {
        const fakeError = new Error('ESBuild failed');
        (<any> build).mockRejectedValue(fakeError);

        await expect(analyzeDependencies({ entryPoints: [ 'src/fail.ts' ] })).rejects.toBe(fakeError);
    });
});
