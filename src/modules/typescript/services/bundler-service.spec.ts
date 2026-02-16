/**
 * Imports
 */

import { mkdir, writeFile } from 'fs/promises';
import { BundlerService } from '@typescript/services/bundler.service';

/**
 * Tests
 */

describe('BundlerService', () => {
    let bundler: BundlerService;
    let languageService: any;
    let languageHostService: any;
    let graphModel: any;

    const fakeEntryFile = '/project/root/src/index.ts';
    const fakeOutDir = '/project/root/dist';
    const fakeOutputDts = '/project/root/dist/my-bundle.d.ts';

    beforeEach(() => {
        xJet.resetAllMocks();
        languageHostService = {
            getCompilationSettings: () => ({ outDir: fakeOutDir }),
            getScriptVersion: () => '1',
            aliasRegex: /@app\/[^'"]*/
        };

        languageService = {
            getProgram: () => ({
                getSourceFile: (fileName: string) => ({
                    fileName,
                    isDeclarationFile: false
                })
            }),
            getEmitOutput: () => ({ emitSkipped: false, outputFiles: [{ text: 'export declare const x: number;' }] })
        } as any;

        // Minimal mock for graphModel (injected)
        graphModel = {
            scan: xJet.fn(),
            get: xJet.fn()
        };

        bundler = new BundlerService(languageService, languageHostService);
        (bundler as any).graphModel = graphModel; // override injected mock
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('emit', () => {
        test('writes bundled declaration for each entry point', async () => {
            const writeSpy = xJet.mock(writeFile).mockImplementation(() => {});
            const mkdirSpy = xJet.mock(mkdir).mockImplementation((() => {}) as any);

            graphModel.scan.mockReturnValue({
                fileName: fakeEntryFile,
                content: 'declare const x: number;',
                internalDeps: new Set([ '/project/root/src/utils.ts' ]),
                internalExports: { exports: [ 'x' ], star: [], namespace: {} },
                externalImports: { default: {}, named: {}, namespace: {} },
                externalExports: { exports: {}, star: [], namespace: {} }
            });

            graphModel.get.mockReturnValue({
                content: 'declare const util: () => void;',
                internalDeps: new Set(),
                internalExports: { exports: [ 'util' ], star: [], namespace: {} }
            });

            await bundler.emit({ 'my-bundle': fakeEntryFile });

            expect(mkdirSpy).toHaveBeenCalled();
            expect(writeSpy).toHaveBeenCalledTimes(1);
            expect(writeSpy).toHaveBeenCalledWith(
                fakeOutputDts,
                expect.stringContaining('declare const x: number'),
                'utf-8'
            );
        });

        test('uses custom outdir when provided', async () => {
            const writeSpy = xJet.mock(writeFile).mockImplementation(() => {});
            xJet.mock(mkdir).mockImplementation((() => {}) as any);

            const fullNodeMock = {
                fileName: fakeEntryFile,
                content: '',
                internalDeps: new Set(),
                internalExports: { exports: [], star: [], namespace: {} },
                externalImports: { default: {}, named: {}, namespace: {} },
                externalExports: { exports: {}, star: [], namespace: {} }
            };

            graphModel.scan.mockReturnValue(fullNodeMock);
            await bundler.emit({ 'custom-bundle': fakeEntryFile }, '/custom/dist');

            expect(writeSpy).toHaveBeenCalledWith(
                expect.stringContaining('/custom/dist/custom-bundle.d.ts'),
                expect.any(String),
                'utf-8'
            );
        });

        test('skips missing source file', async () => {
            const writeSpy = xJet.mock(writeFile);

            languageService.getProgram = () => ({
                getSourceFile: () => undefined
            }) as any;

            await bundler.emit({ 'missing': '/does/not/exist.ts' });

            expect(writeSpy).not.toHaveBeenCalled();
        });
    });

    describe('bundle content generation', () => {
        test('collects and orders declarations from dependency graph', async () => {
            const writeSpy = xJet.mock(writeFile).mockImplementation(() => {});
            xJet.mock(mkdir).mockImplementation((() => {}) as any);

            graphModel.scan.mockImplementation((source: any) => ({
                fileName: source.fileName,
                content: `declare const ${ source.fileName.split('/').pop()?.split('.')[0] }: any;`,
                internalDeps: new Set(),
                internalExports: {
                    exports: [ source.fileName.split('/').pop()?.split('.')[0] ],
                    star: [],
                    namespace: {}
                },
                externalImports: { default: {}, named: {}, namespace: {} },
                externalExports: { exports: {}, star: [], namespace: {} }
            }));

            await bundler.emit({ 'entry': fakeEntryFile });

            expect(writeSpy).toHaveBeenCalledWith(
                expect.any(String), expect.stringContaining('declare const index: any'), expect.any(String)
            );
        });

        test('includes external imports at top', async () => {
            const writeSpy = xJet.mock(writeFile);

            graphModel.scan.mockReturnValue({
                fileName: fakeEntryFile,
                content: 'declare const x: number;',
                internalDeps: new Set(),
                internalExports: { exports: [ 'x' ], star: [], namespace: {} },
                externalImports: {
                    default: { react: 'React' },
                    named: { 'ui-lib': [ 'Button' ] },
                    namespace: {}
                },
                externalExports: { exports: {}, star: [], namespace: {} }
            });

            await bundler.emit({ 'bundle': fakeEntryFile });
            const written = writeSpy.mock.calls[0][1] as string;

            expect(written).toContain('import React from \'react\'');
            expect(written).toContain('import { Button } from \'ui-lib\'');
        });

        test('handles namespace exports with generated const', async () => {
            const writeSpy = xJet.mock(writeFile).mockImplementation(() => {});
            xJet.mock(mkdir).mockImplementation((() => {}) as any);

            const entryNode = {
                fileName: fakeEntryFile,
                content: '',
                internalDeps: new Set([ '/project/root/src/utils.ts' ]),
                internalExports: { exports: [], star: [], namespace: { Utils: '/project/root/src/utils.ts' } },
                externalImports: { default: {}, named: {}, namespace: {} },
                externalExports: { exports: {}, star: [], namespace: {} }
            };

            const utilsNode = {
                fileName: '/project/root/src/utils.ts',
                content: 'declare const add: (a: number, b: number) => number;',
                internalDeps: new Set(),
                internalExports: { exports: [ 'add' ], star: [], namespace: {} },
                externalImports: { default: {}, named: {}, namespace: {} },
                externalExports: { exports: {}, star: [], namespace: {} }
            };

            graphModel.scan.mockReturnValue(entryNode);
            graphModel.get.mockReturnValue(utilsNode);

            await bundler.emit({ 'bundle': fakeEntryFile });
            expect(writeSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('const Utils = { add };'), expect.any(String));
        });
    });
});
