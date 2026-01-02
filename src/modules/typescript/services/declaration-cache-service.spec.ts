/**
 * Import will remove at compile time
 */

import type { SourceFile } from 'typescript';
import type { DeclarationInterface } from '@typescript/services/interfaces/declaration-cache-service.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { DeclarationCache } from '@typescript/services/declaration-cache.service';

/**
 * Helper
 */

function createSourceFile(fileName: string, content: string): SourceFile {
    return ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
}

/**
 * Tests
 */

describe('DeclarationCache', () => {
    let cache: DeclarationCache;

    const mockHost = {
        getScriptVersion: xJet.fn(() => 'v1')
    } as any;

    const mockLanguageService = {
        getProgram: xJet.fn(),
        getEmitOutput: xJet.fn()
    } as any;

    beforeEach(() => {
        mockHost.getScriptVersion.mockReset();
        mockLanguageService.getProgram.mockReset();
        mockLanguageService.getEmitOutput.mockReset();
        cache = new DeclarationCache(mockLanguageService, mockHost);
    });

    describe('basic cache operations', () => {
        test('should store and retrieve declarations', () => {
            const declaration: DeclarationInterface = {
                fileName: 'test.ts',
                content: 'content',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [ 'x' ], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            };

            // Insert manually into cache
            (cache as any).cache.set('test.ts', declaration);

            const result = cache.get('test.ts');
            expect(result).toBe(declaration);
            expect(cache.has('test.ts')).toBe(true);

            cache.delete('test.ts');
            expect(cache.has('test.ts')).toBe(false);
        });

        test('should clear all cache entries', () => {
            const decl: DeclarationInterface = {
                fileName: 'a.ts',
                content: '',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            };
            (cache as any).cache.set('a.ts', decl);

            cache.clear();
            expect((cache as any).cache.size).toBe(0);
        });
    });

    describe('getOrUpdate', () => {
        test('should reuse cached declaration when version matches', () => {
            const source = createSourceFile('x.ts', '');
            const cached: DeclarationInterface = {
                fileName: 'x.ts',
                content: 'abc',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            };
            (cache as any).cache.set('x.ts', cached);

            const result = cache.getOrUpdate(source, 'v1');
            expect(result).toBe(cached);
        });

        test('should reprocess declaration when version changes', () => {
            const source = createSourceFile('x.ts', '');
            const cached: DeclarationInterface = {
                fileName: 'x.ts',
                content: 'old',
                version: 'v1',
                dependency: new Set(),
                imports: { named: {}, default: {}, namespace: {} },
                exports: { star: [], exports: [], namespace: {} },
                externalExports: { star: [], exports: {}, namespace: {} }
            };
            (cache as any).cache.set('x.ts', cached);

            mockLanguageService.getEmitOutput.mockReturnValue({
                outputFiles: [{ text: 'declare const x: number;' }],
                emitSkipped: false
            } as any);

            mockHost.getScriptVersion.mockReturnValueOnce('v2');
            mockLanguageService.getProgram.mockReturnValue({ getCompilerOptions: xJet.fn(() => ({})) } as any);

            const result = cache.getOrUpdate(source, 'v2');
            expect(result).not.toBe(cached);
            expect(result.content).toContain('declare');
            expect(result.version).toBe('v2');
        });
    });

    describe('emitDeclaration', () => {
        test('should emit declaration source', () => {
            const source = createSourceFile('file.ts', 'export const x = 1;');

            mockLanguageService.getEmitOutput.mockReturnValue({
                outputFiles: [{ text: 'declare const x: number;' }],
                emitSkipped: false
            } as any);

            const result = (cache as any).emitDeclaration(source);
            expect(result.fileName).toBe('file.d.ts');
            expect(result.text).toContain('declare const x');
        });

        test('should throw if emit fails', () => {
            const source = createSourceFile('file.ts', '');
            mockLanguageService.getEmitOutput.mockReturnValue({ outputFiles: [] } as any);

            expect(() => (cache as any).emitDeclaration(source)).toThrow(/Failed to emit declaration/);
        });
    });

    describe('processDeclaration', () => {
        test('should build a DeclarationInterface from a source file', () => {
            const source = createSourceFile('file.ts', 'export const value = 42;');

            mockLanguageService.getEmitOutput.mockReturnValue({
                outputFiles: [{ text: 'declare const value: number;' }],
                emitSkipped: false
            } as any);

            mockLanguageService.getProgram.mockReturnValue({ getCompilerOptions: xJet.fn(() => ({})) } as any);

            const result = (cache as any).processDeclaration(source);
            expect(result.fileName).toBe('file.ts');
            expect(result.content).toContain('declare const value');
            expect(result.version).toBe('v1');
        });
    });
});
