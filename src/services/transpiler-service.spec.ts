/**
 * Imports
 */

import { build } from 'esbuild';
import { analyzeDependencies } from '@services/transpiler.service';

/**
 * Tests
 */

describe('analyzeDependencies', () => {
    const mockResult: any = {
        metafile: { inputs: {}, outputs: {} },
        outputFiles: []
    };

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(build).mockResolvedValue(<any> mockResult);
    });

    test('should call esbuild.build with correct default options', async () => {
        const entryPoints = [ 'src/index.ts' ];
        const result = await analyzeDependencies(entryPoints);

        expect(result).toBe(mockResult);
        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                outdir: 'tmp',
                write: false,
                bundle: true,
                metafile: true,
                packages: 'external',
                logLevel: 'silent',
                entryPoints
            })
        );
    });

    test('should merge user-provided buildOptions correctly', async () => {
        const entryPoints = [ 'src/app.ts' ];
        const customOptions: any = { minify: true, sourcemap: 'inline' };
        await analyzeDependencies(entryPoints, customOptions);

        expect(build).toHaveBeenCalledWith(
            expect.objectContaining({
                outdir: 'tmp',
                write: false,
                bundle: true,
                metafile: true,
                packages: 'external',
                logLevel: 'silent',
                entryPoints,
                minify: true,
                sourcemap: 'inline'
            })
        );
    });

    test('should propagate errors from esbuild.build', async () => {
        const fakeError = new Error('ESBuild failed');
        (<any> build).mockRejectedValue(fakeError);

        await expect(analyzeDependencies([ 'src/fail.ts' ])).rejects.toThrow(Error);

        try {
            await analyzeDependencies([ 'src/fail.ts' ]);
        } catch (err: any) {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toContain('ESBuild failed');
        }
    });
});
