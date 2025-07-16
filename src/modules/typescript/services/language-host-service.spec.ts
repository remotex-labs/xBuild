/**
 * Imports
 */

import ts from 'typescript';
import { resolve } from 'path';
import { LanguageHostService } from '@typescript/services/language-host.service';

/**
 * Mock dependencies
 */

jest.mock('typescript', () => {
    const originalTs = jest.requireActual('typescript');

    return {
        ...originalTs,
        sys: {
            fileExists: jest.fn(),
            readFile: jest.fn(),
            readDirectory: jest.fn(),
            getDirectories: jest.fn(),
            directoryExists: jest.fn(),
            getCurrentDirectory: jest.fn()
        },
        ScriptSnapshot: {
            fromString: jest.fn()
        },
        getDefaultLibFilePath: jest.fn()
    };
});

/**
 * Tests
 */

describe('LanguageHostService', () => {
    let languageHostService: LanguageHostService;
    const mockCompilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS
    };

    beforeEach(() => {
        jest.clearAllMocks();
        languageHostService = new LanguageHostService(mockCompilerOptions);
    });

    describe('touchFiles', () => {
        test('should increment file version when touching a file', () => {
            const filePath = 'test/file.ts';

            // Initially version should be 0
            expect(languageHostService.getScriptVersion(filePath)).toBe('0');

            // Touch the file
            languageHostService.touchFiles(filePath);
            expect(languageHostService.getScriptVersion(filePath)).toBe('1');

            // Touch again should increment version
            languageHostService.touchFiles(filePath);
            expect(languageHostService.getScriptVersion(filePath)).toBe('2');
        });
    });

    describe('fileExists', () => {
        test('should delegate to ts.sys.fileExists', () => {
            const filePath = 'test/file.ts';
            (ts.sys.fileExists as jest.Mock).mockReturnValue(true);

            const result = languageHostService.fileExists(filePath);

            expect(result).toBe(true);
            expect(ts.sys.fileExists).toHaveBeenCalledWith(filePath);
        });
    });

    describe('readFile', () => {
        test('should delegate to ts.sys.readFile', () => {
            const filePath = 'test/file.ts';
            const fileContent = 'export const test = 123;';
            (ts.sys.readFile as jest.Mock).mockReturnValue(fileContent);

            const result = languageHostService.readFile(filePath);

            expect(result).toBe(fileContent);
            expect(ts.sys.readFile).toHaveBeenCalledWith(filePath, undefined);
        });

        test('should respect encoding parameter', () => {
            const filePath = 'test/file.ts';
            const encoding = 'utf8';

            languageHostService.readFile(filePath, encoding);

            expect(ts.sys.readFile).toHaveBeenCalledWith(filePath, encoding);
        });
    });

    describe('getScriptFileNames', () => {
        test('should return keys from fileVersions map', () => {
            const filePath1 = 'test/file1.ts';
            const filePath2 = 'test/file2.ts';

            languageHostService.touchFiles(filePath1);
            languageHostService.touchFiles(filePath2);

            const result = languageHostService.getScriptFileNames();

            expect(result.length).toBe(2);
            expect(result).toContain(resolve(filePath1));
            expect(result).toContain(resolve(filePath2));
        });
    });

    describe('getCompilationSettings', () => {
        test('should return the compiler options passed to constructor', () => {
            const result = languageHostService.getCompilationSettings();

            expect(result).toBe(mockCompilerOptions);
        });
    });

    describe('getDefaultLibFileName', () => {
        test('should delegate to ts.getDefaultLibFilePath', () => {
            const expectedPath = 'lib.d.ts';
            (ts.getDefaultLibFilePath as jest.Mock).mockReturnValue(expectedPath);

            const result = languageHostService.getDefaultLibFileName(mockCompilerOptions);

            expect(result).toBe(expectedPath);
            expect(ts.getDefaultLibFilePath).toHaveBeenCalledWith(mockCompilerOptions);
        });
    });

    describe('getScriptSnapshot', () => {
        test('should return undefined if file does not exist', () => {
            const filePath = 'test/non-existent.ts';
            (ts.sys.fileExists as jest.Mock).mockReturnValue(false);

            const result = languageHostService.getScriptSnapshot(filePath);

            expect(result).toBeUndefined();
        });

        test('should return script snapshot if file exists', () => {
            const filePath = 'test/file.ts';
            const fileContent = 'export const test = 123;';
            const mockSnapshot = { getText: jest.fn() };

            (ts.sys.fileExists as jest.Mock).mockReturnValue(true);
            (ts.sys.readFile as jest.Mock).mockReturnValue(fileContent);
            (ts.ScriptSnapshot.fromString as jest.Mock).mockReturnValue(mockSnapshot);

            const result = languageHostService.getScriptSnapshot(filePath);

            expect(result).toBe(mockSnapshot);
            expect(ts.ScriptSnapshot.fromString).toHaveBeenCalledWith(fileContent);
        });

        test('should return undefined if file exists but content is null', () => {
            const filePath = 'test/file.ts';

            (ts.sys.fileExists as jest.Mock).mockReturnValue(true);
            (ts.sys.readFile as jest.Mock).mockReturnValue(null);

            const result = languageHostService.getScriptSnapshot(filePath);

            expect(result).toBeUndefined();
        });
    });

    describe('File system operations', () => {
        test('should delegate readDirectory to ts.sys.readDirectory', () => {
            const directoryPath = 'test/';
            const extensions = [ '.ts' ];
            const exclude = [ 'node_modules' ];
            const include = [ 'src' ];
            const depth = 5;
            const expectedResult = [ 'file1.ts', 'file2.ts' ];

            (ts.sys.readDirectory as jest.Mock).mockReturnValue(expectedResult);

            const result = languageHostService.readDirectory(
                directoryPath,
                extensions,
                exclude,
                include,
                depth
            );

            expect(result).toBe(expectedResult);
            expect(ts.sys.readDirectory).toHaveBeenCalledWith(
                directoryPath,
                extensions,
                exclude,
                include,
                depth
            );
        });

        test('should delegate getDirectories to ts.sys.getDirectories', () => {
            const directoryPath = 'test/';
            const expectedResult = [ 'dir1', 'dir2' ];

            (ts.sys.getDirectories as jest.Mock).mockReturnValue(expectedResult);

            const result = languageHostService.getDirectories(directoryPath);

            expect(result).toBe(expectedResult);
            expect(ts.sys.getDirectories).toHaveBeenCalledWith(directoryPath);
        });

        test('should delegate directoryExists to ts.sys.directoryExists', () => {
            const directoryPath = 'test/';

            (ts.sys.directoryExists as jest.Mock).mockReturnValue(true);

            const result = languageHostService.directoryExists(directoryPath);

            expect(result).toBe(true);
            expect(ts.sys.directoryExists).toHaveBeenCalledWith(directoryPath);
        });

        test('should delegate getCurrentDirectory to ts.sys.getCurrentDirectory', () => {
            const expectedDir = '/home/user/project';

            (ts.sys.getCurrentDirectory as jest.Mock).mockReturnValue(expectedDir);

            const result = languageHostService.getCurrentDirectory();

            expect(result).toBe(expectedDir);
            expect(ts.sys.getCurrentDirectory).toHaveBeenCalled();
        });
    });
});
