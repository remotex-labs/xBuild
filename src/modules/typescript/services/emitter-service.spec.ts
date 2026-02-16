/**
 * Imports
 */

import { resolve } from 'path';
import { join } from 'path/posix';
import { mkdir, writeFile } from 'fs/promises';
import { EmitterService } from '@typescript/services/emitter.service';

/**
 * Tests
 */

describe('EmitterService', () => {
    let emitter: EmitterService;
    let languageService: any;
    let languageHostService: any;

    const fakeSourceFileName = '/project/root/src/index.ts';
    const fakeOutDir = '/project/root/dist/types';
    const fakeOutputDtsPath = '/project/root/dist/types/index.d.ts';

    beforeEach(() => {
        xJet.resetAllMocks();

        EmitterService.clearCache();

        languageHostService = {
            getCompilationSettings: () => ({ outDir: fakeOutDir }),
            getScriptVersion: () => '1',
            aliasRegex: /@app\/[^'"]*/
        };

        languageService = {
            getProgram: () => ({
                getSourceFiles: () => [{ fileName: fakeSourceFileName, isDeclarationFile: false }],
                isSourceFileFromExternalLibrary: () => false
            }),
            getEmitOutput: () => ({ emitSkipped: false, outputFiles: [{ text: 'export declare const x: number;' }] })
        } as any;

        emitter = new EmitterService(languageService, languageHostService);

        xJet.mock(resolve).mockImplementation((path: string): string => {
            if(path.includes('/project/root')) return path;

            return join('/project/root', path);
        });
    });

    afterAll(() => {
        xJet.restoreAllMocks();
    });

    describe('clearCache (static)', () => {
        test('clears static emittedVersions map', () => {
            (EmitterService as any).emittedVersions.set(fakeOutputDtsPath, '5');

            expect((EmitterService as any).emittedVersions.size).toBe(1);

            EmitterService.clearCache();

            expect((EmitterService as any).emittedVersions.size).toBe(0);
        });
    });

    describe('emit', () => {
        test('does nothing when no files need emission', async () => {
            const writeSpy = xJet.mock(writeFile);

            languageService.getProgram = () => ({
                getSourceFiles: () => [{ fileName: fakeSourceFileName, isDeclarationFile: true }],
                isSourceFileFromExternalLibrary: () => false
            }) as any;

            await emitter.emit();

            expect(writeSpy).not.toHaveBeenCalled();
        });

        test('emits declaration file when version is new or changed', async () => {
            const writeSpy = xJet.mock(writeFile).mockImplementation(() => {});
            const mkdirSpy = xJet.mock(mkdir).mockImplementation((() => {}) as any);

            languageHostService.getScriptVersion = () => '3';
            languageHostService.resolveAliases = (content: string) => content;

            await emitter.emit();

            expect(mkdirSpy).toHaveBeenCalledWith('/project/root/dist/types', { recursive: true });
            expect(writeSpy).toHaveBeenCalledTimes(1);
            expect(writeSpy).toHaveBeenCalledWith(
                expect.stringContaining('index.d.ts'),
                expect.any(String),
                'utf8'
            );

            mkdirSpy.mockClear();
            writeSpy.mockClear();

            await emitter.emit();

            expect(writeSpy).not.toHaveBeenCalled();
        });

        test('uses custom outdir when provided', async () => {
            const writeSpy = xJet.mock(writeFile);
            languageHostService.resolveAliases = (content: string) => content;

            await emitter.emit('/custom/types');
            expect(writeSpy).toHaveBeenCalledWith(
                expect.stringContaining('/custom/types/'),
                expect.any(String),
                'utf8'
            );
        });
    });

    describe('shouldEmitFile (private)', () => {
        test('skips declaration files', () => {
            const file = { isDeclarationFile: true, fileName: fakeSourceFileName } as any;
            const program = { isSourceFileFromExternalLibrary: () => false } as any;

            const should = (emitter as any).shouldEmitFile(file, program, { outDir: fakeOutDir });

            expect(should).toBe(false);
        });

        test('skips external library files', () => {
            const file = { isDeclarationFile: false, fileName: fakeSourceFileName } as any;
            const program = { isSourceFileFromExternalLibrary: () => true } as any;

            const should = (emitter as any).shouldEmitFile(file, program, { outDir: fakeOutDir });

            expect(should).toBe(false);
        });

        test('emits when no previous version exists', () => {
            const file = { fileName: fakeSourceFileName, isDeclarationFile: false } as any;
            const program = { isSourceFileFromExternalLibrary: () => false } as any;

            const should = (emitter as any).shouldEmitFile(file, program, { outDir: fakeOutDir });

            expect(should).toBe(true);
        });

        test('emits when version changed', () => {
            const file = { fileName: fakeSourceFileName, isDeclarationFile: false } as any;
            const program = { isSourceFileFromExternalLibrary: () => false } as any;

            languageHostService.getScriptVersion = () => '2';

            (EmitterService as any).emittedVersions.set(fakeOutputDtsPath, '1');

            const should = (emitter as any).shouldEmitFile(file, program, { outDir: fakeOutDir });

            expect(should).toBe(true);
        });

        test('skips when version unchanged', () => {
            const file = { fileName: fakeSourceFileName, isDeclarationFile: false } as any;
            const program = { isSourceFileFromExternalLibrary: () => false } as any;
            languageHostService.getScriptVersion = () => '1';
            (EmitterService as any).emittedVersions.set(fakeOutputDtsPath, '1');

            const should = (emitter as any).shouldEmitFile(file, program, { outDir: fakeOutDir });

            expect(should).toBe(false);
        });
    });
});
