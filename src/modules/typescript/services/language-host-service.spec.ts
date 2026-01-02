/**
 * Import will remove at compile time
 */

import type { CompilerOptions } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { inject, SINGLETONS } from '@symlinks/symlinks.module';
import { LanguageHostService } from '@typescript/services/language-host.service';

/**
 * Tests
 */

describe('LanguageHostService', () => {
    let service: LanguageHostService;
    let compilerOptions: CompilerOptions;

    beforeEach(() => {
        SINGLETONS.clear();
        xJet.resetAllMocks();

        compilerOptions = {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.ESNext,
            strict: true
        };
    });

    test('should be injectable as a singleton', () => {
        const a = inject(LanguageHostService);
        const b = inject(LanguageHostService);

        expect(a).toBe(b);
    });

    test('should initialize with default compiler options', () => {
        service = new LanguageHostService();
        const settings = service.getCompilationSettings();

        expect(settings).toBeDefined();
        expect(settings).toEqual({});
    });

    test('should initialize with provided compiler options', () => {
        service = new LanguageHostService(compilerOptions);
        const settings = service.getCompilationSettings();

        expect(settings).toBe(compilerOptions);
        expect(settings.target).toBe(ts.ScriptTarget.ES2020);
        expect(settings.module).toBe(ts.ModuleKind.ESNext);
    });

    test('should return initial cache stats with zero values', () => {
        service = new LanguageHostService();
        const stats = service.getCacheStats();

        expect(stats.trackedFiles).toBe(0);
        expect(stats.pathCacheSize).toBe(0);
        expect(stats.snapshotCacheSize).toBe(0);
    });

    test('should track file versions when touchFile is called', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.touchFile(filePath);
        const version = service.getScriptVersion(filePath);

        expect(version).toBe('1');
    });

    test('should increment file version on multiple touches', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.touchFile(filePath);
        service.touchFile(filePath);
        service.touchFile(filePath);

        const version = service.getScriptVersion(filePath);
        expect(version).toBe('3');
    });

    test('should return version 0 for untracked files', () => {
        service = new LanguageHostService();
        const version = service.getScriptVersion('untracked.ts');

        expect(version).toBe('0');
    });

    test('should update cache stats after touching files', () => {
        service = new LanguageHostService();

        service.touchFile('src/file1.ts');
        service.touchFile('src/file2.ts');

        const stats = service.getCacheStats();
        expect(stats.trackedFiles).toBe(2);
        expect(stats.pathCacheSize).toBe(2);
    });

    test('should return tracked file names', () => {
        service = new LanguageHostService();

        service.touchFile('src/file1.ts');
        service.touchFile('src/file2.ts');

        const fileNames = service.getScriptFileNames();
        expect(fileNames.length).toBe(2);
        expect(fileNames.some(name => name.includes('file1.ts'))).toBe(true);
        expect(fileNames.some(name => name.includes('file2.ts'))).toBe(true);
    });

    test('should delegate fileExists to TypeScript sys', () => {
        service = new LanguageHostService();
        const fileExistsSpy = xJet.spyOn(ts.sys, 'fileExists');

        service.fileExists('test.ts');

        expect(fileExistsSpy).toHaveBeenCalledWith('test.ts');
    });

    test('should delegate readFile to TypeScript sys', () => {
        service = new LanguageHostService();
        const readFileSpy = xJet.spyOn(ts.sys, 'readFile');

        service.readFile('test.ts', 'utf-8');

        expect(readFileSpy).toHaveBeenCalledWith('test.ts', 'utf-8');
    });

    test('should delegate directoryExists to TypeScript sys', () => {
        service = new LanguageHostService();
        const directoryExistsSpy = xJet.spyOn(ts.sys, 'directoryExists');

        service.directoryExists('src');

        expect(directoryExistsSpy).toHaveBeenCalledWith('src');
    });

    test('should delegate getDirectories to TypeScript sys', () => {
        service = new LanguageHostService();
        const getDirectoriesSpy = xJet.spyOn(ts.sys, 'getDirectories');

        service.getDirectories('src');

        expect(getDirectoriesSpy).toHaveBeenCalledWith('src');
    });

    test('should delegate readDirectory to TypeScript sys', () => {
        service = new LanguageHostService();
        const readDirectorySpy = xJet.spyOn(ts.sys, 'readDirectory');

        service.readDirectory('src', [ '.ts' ], [ 'node_modules' ], [ '**/*.ts' ], 2);

        expect(readDirectorySpy).toHaveBeenCalledWith('src', [ '.ts' ], [ 'node_modules' ], [ '**/*.ts' ], 2);
    });

    test('should delegate getCurrentDirectory to TypeScript sys', () => {
        service = new LanguageHostService();
        const getCurrentDirectorySpy = xJet.spyOn(ts.sys, 'getCurrentDirectory');

        service.getCurrentDirectory();

        expect(getCurrentDirectorySpy).toHaveBeenCalled();
    });

    test('should return default lib file name', () => {
        service = new LanguageHostService(compilerOptions);
        const libFileName = service.getDefaultLibFileName(compilerOptions);

        expect(libFileName).toBeDefined();
        expect(libFileName).toContain('lib');
    });

    test('should return undefined for non-existent file snapshot', () => {
        service = new LanguageHostService();
        const fileExistsMock = xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(false);

        const snapshot = service.getScriptSnapshot('non-existent.ts');

        expect(snapshot).toBeUndefined();
        expect(fileExistsMock).toHaveBeenCalled();
    });

    test('should create script snapshot for existing file', () => {
        service = new LanguageHostService();
        const fileContent = 'const x = 42;';

        xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);
        xJet.spyOn(ts.sys, 'readFile').mockReturnValue(fileContent);

        service.touchFile('test.ts');
        const snapshot = service.getScriptSnapshot('test.ts');

        expect(snapshot).toBeDefined();
        expect(snapshot?.getText(0, fileContent.length)).toBe(fileContent);
    });

    test('should cache script snapshots', () => {
        service = new LanguageHostService();
        const fileContent = 'const x = 42;';

        xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);
        const readFileMock = xJet.spyOn(ts.sys, 'readFile').mockReturnValue(fileContent);

        service.touchFile('test.ts');
        const snapshot1 = service.getScriptSnapshot('test.ts');
        const snapshot2 = service.getScriptSnapshot('test.ts');

        expect(snapshot1).toBe(snapshot2);
        expect(readFileMock).toHaveBeenCalledTimes(1);
    });

    test('should invalidate snapshot cache when file version changes', () => {
        service = new LanguageHostService();
        const fileContent1 = 'const x = 42;';
        const fileContent2 = 'const x = 100;';

        xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);
        const readFileMock = xJet.spyOn(ts.sys, 'readFile')
            .mockReturnValueOnce(fileContent1)
            .mockReturnValueOnce(fileContent2);

        service.touchFile('test.ts');
        const snapshot1 = service.getScriptSnapshot('test.ts');

        service.touchFile('test.ts');
        const snapshot2 = service.getScriptSnapshot('test.ts');

        expect(snapshot1).not.toBe(snapshot2);
        expect(readFileMock).toHaveBeenCalledTimes(2);
    });

    test('should return undefined snapshot when readFile returns undefined', () => {
        service = new LanguageHostService();

        xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);
        xJet.spyOn(ts.sys, 'readFile').mockReturnValue(undefined);

        const snapshot = service.getScriptSnapshot('test.ts');

        expect(snapshot).toBeUndefined();
    });

    test('should update snapshot cache stats', () => {
        service = new LanguageHostService();
        const fileContent = 'const x = 42;';

        xJet.spyOn(ts.sys, 'fileExists').mockReturnValue(true);
        xJet.spyOn(ts.sys, 'readFile').mockReturnValue(fileContent);

        service.touchFile('test1.ts');
        service.touchFile('test2.ts');
        service.getScriptSnapshot('test1.ts');
        service.getScriptSnapshot('test2.ts');

        const stats = service.getCacheStats();
        expect(stats.snapshotCacheSize).toBe(2);
    });

    test('should resolve and cache file paths', () => {
        service = new LanguageHostService();

        service.touchFile('src/test.ts');
        service.touchFile('src/test.ts');

        const stats = service.getCacheStats();
        expect(stats.pathCacheSize).toBe(1);
    });

    test('should handle multiple files with different paths', () => {
        service = new LanguageHostService();

        service.touchFile('src/file1.ts');
        service.touchFile('src/file2.ts');
        service.touchFile('./src/file3.ts');

        const fileNames = service.getScriptFileNames();
        expect(fileNames.length).toBe(3);

        const stats = service.getCacheStats();
        expect(stats.trackedFiles).toBe(3);
        expect(stats.pathCacheSize).toBe(3);
    });

    test('should work with compilation settings', () => {
        const customOptions: CompilerOptions = {
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.CommonJS,
            declaration: true,
            sourceMap: true
        };

        service = new LanguageHostService(customOptions);
        const settings = service.getCompilationSettings();

        expect(settings.target).toBe(ts.ScriptTarget.ES5);
        expect(settings.module).toBe(ts.ModuleKind.CommonJS);
        expect(settings.declaration).toBe(true);
        expect(settings.sourceMap).toBe(true);
    });

    test('should return true for isTouched on first check of untracked file', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        const result = service.isTouched(filePath);

        expect(result).toBe(true);
    });

    test('should return false for isTouched on second check without modification', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.touchFile(filePath);
        service.isTouched(filePath);
        const result = service.isTouched(filePath);

        expect(result).toBe(false);
    });

    test('should return true for isTouched after touchFile is called', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.isTouched(filePath);
        service.touchFile(filePath);
        const result = service.isTouched(filePath);

        expect(result).toBe(true);
    });

    test('should return false for isTouched after checking again without modification', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.touchFile(filePath);
        service.isTouched(filePath);
        const result = service.isTouched(filePath);

        expect(result).toBe(false);
    });

    test('should handle multiple touchFile and isTouched calls correctly', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        expect(service.isTouched(filePath)).toBe(true);

        service.touchFile(filePath);
        expect(service.isTouched(filePath)).toBe(true);
        expect(service.isTouched(filePath)).toBe(false);

        service.touchFile(filePath);
        service.touchFile(filePath);
        expect(service.isTouched(filePath)).toBe(true);
        expect(service.isTouched(filePath)).toBe(false);
    });

    test('should track analyzed version independently for multiple files', () => {
        service = new LanguageHostService();

        expect(service.isTouched('file1.ts')).toBe(true);
        expect(service.isTouched('file2.ts')).toBe(true);

        service.touchFile('file1.ts');

        expect(service.isTouched('file1.ts')).toBe(true);
        expect(service.isTouched('file1.ts')).toBe(false);
        expect(service.isTouched('file2.ts')).toBe(true);
    });

    test('should update analyzedVersion to match version when returning true', () => {
        service = new LanguageHostService();
        const filePath = 'src/test.ts';

        service.touchFile(filePath);
        service.touchFile(filePath);
        service.touchFile(filePath);

        expect(service.getScriptVersion(filePath)).toBe('3');
        expect(service.isTouched(filePath)).toBe(true);
        expect(service.isTouched(filePath)).toBe(false);
    });
});
