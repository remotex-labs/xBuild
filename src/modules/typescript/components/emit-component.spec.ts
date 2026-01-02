/**
 * Import will remove at compile time
 */

import type { LanguageHostService } from '@typescript/services/language-host.service';
import type { CompilerOptions, LanguageService, Program, SourceFile } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { mkdir, writeFile } from 'fs/promises';
import { removeShebang, removeEmptyExports } from '@typescript/components/emit.component';
import { removeOrphanComments, removeExportModifiers } from '@typescript/components/emit.component';
import { resolveModuleName, shouldEmitFile, needsCleaning } from '@typescript/components/emit.component';
import { cleanContent, emitSingleDeclaration, resolveAliases } from '@typescript/components/emit.component';

/**
 * Tests
 */

beforeAll(() => {
    xJet.restoreAllMocks();
});

describe('shouldEmitFile', () => {
    let host: LanguageHostService;
    let file: SourceFile;
    let program: Program;

    beforeEach(() => {
        host = {
            isTouched: xJet.fn()
        } as unknown as LanguageHostService;

        file = {
            isDeclarationFile: false,
            fileName: 'src/test.ts'
        } as unknown as SourceFile;

        program = {
            isSourceFileFromExternalLibrary: xJet.fn().mockReturnValue(false)
        } as unknown as Program;
    });

    test('should return false for declaration files', () => {
        file.isDeclarationFile = true;
        const result = shouldEmitFile.call(host, file, program, false);
        expect(result).toBe(false);
    });

    test('should return false for external library files', () => {
        xJet.spyOn(program, 'isSourceFileFromExternalLibrary').mockReturnValueOnce(true);
        const result = shouldEmitFile.call(host, file, program, false);
        expect(result).toBe(false);
    });

    test('should return true if "force" is true', () => {
        const result = shouldEmitFile.call(host, file, program, true);
        expect(result).toBe(true);
    });

    test('should return true if file is touched', () => {
        (host.isTouched as any).mockReturnValue(true);
        const result = shouldEmitFile.call(host, file, program, false);
        expect(result).toBe(true);
    });

    test('should return false if file not touched and force is false', () => {
        (host.isTouched as any).mockReturnValue(false);
        const result = shouldEmitFile.call(host, file, program, false);
        expect(result).toBe(false);
    });
});

describe('resolveModuleName', () => {
    let options: CompilerOptions;
    let tsResolveSpy: ReturnType<typeof xJet.spyOn>;

    beforeEach(() => {
        options = {} as CompilerOptions;
        tsResolveSpy = xJet.spyOn(ts, 'resolveModuleName');
    });

    test('should return resolved file name when module is resolved', () => {
        tsResolveSpy.mockReturnValue({
            resolvedModule: { resolvedFileName: '/path/to/module.ts' }
        } as any);

        const result = resolveModuleName(options, 'module', '/src/file.ts');
        expect(result).toBe('/path/to/module.ts');
    });

    test('should return undefined when resolvedModule is missing', () => {
        tsResolveSpy.mockReturnValue({} as any);

        const result = resolveModuleName(options, 'module', '/src/file.ts');
        expect(result).toBeUndefined();
    });

    test('should call ts.resolveModuleName with correct arguments', () => {
        tsResolveSpy.mockReturnValue({ resolvedModule: { resolvedFileName: 'mock.ts' } } as any);
        resolveModuleName(options, 'my-module', '/src/index.ts');

        expect(tsResolveSpy).toHaveBeenCalledWith(
            'my-module',
            '/src/index.ts',
            options,
            ts.sys
        );
    });
});

describe('removeShebang', () => {
    test('should remove shebang from the beginning of the content', () => {
        const content = '#!/usr/bin/env node\nconsole.log("hello");';
        const result = removeShebang(content);
        expect(result).toBe('console.log("hello");');
    });

    test('should return content unchanged if it does not start with shebang', () => {
        const content = 'console.log("no shebang");';
        const result = removeShebang(content);
        expect(result).toBe(content);
    });

    test('should handle empty string gracefully', () => {
        const result = removeShebang('');
        expect(result).toBe('');
    });

    test('should only remove shebang if it starts at the very beginning', () => {
        const content = '  #!/usr/bin/env node\nconsole.log("hello");';
        const result = removeShebang(content);
        expect(result).toBe(content);
    });
});

describe('removeEmptyExports', () => {
    test('should remove empty export statements', () => {
        const content = 'console.log("test");\nexport {};\n';
        const result = removeEmptyExports(content);
        expect(result).toBe('console.log("test");\n');
    });

    test('should remove multiple empty export statements', () => {
        const content = 'export {};\nconsole.log("a");\nexport {};\n';
        const result = removeEmptyExports(content);
        expect(result).toBe('console.log("a");\n');
    });

    test('should return original content if no empty export', () => {
        const content = 'export const value = 123;';
        const result = removeEmptyExports(content);
        expect(result).toBe(content);
    });

    test('should handle files that only contain an empty export', () => {
        const content = 'export {};';
        const result = removeEmptyExports(content);
        expect(result).toBe('');
    });

    test('should not remove "export" keywords that are not empty exports', () => {
        const content = 'export function test() {}';
        const result = removeEmptyExports(content);
        expect(result).toBe(content);
    });
});

describe('removeOrphanComments', () => {
    test('should remove trailing comments at the end of the file', () => {
        const content = 'console.log("test");/**\n * \n */';
        const result = removeOrphanComments(content);
        expect(result).toBe('console.log("test");');
    });

    test('should return original content if no orphan or trailing comments exist', () => {
        const content = 'console.log("clean");';
        const result = removeOrphanComments(content);
        expect(result).toBe(content);
    });
});

describe('removeExportModifiers', () => {
    test('should remove "export" keyword from variable declarations', () => {
        const content = 'export const value = 42;';
        const result = removeExportModifiers(content);
        expect(result).toBe('const value = 42;');
    });

    test('should remove "export" keyword from function declarations', () => {
        const content = 'export function greet() { return "hi"; }';
        const result = removeExportModifiers(content);
        expect(result).toBe('function greet() { return "hi"; }');
    });

    test('should remove "export" keyword from class declarations', () => {
        const content = 'export class Person {}';
        const result = removeExportModifiers(content);
        expect(result).toBe('class Person {}');
    });

    test('should handle multiple export modifiers', () => {
        const content = 'export const a = 1;\nexport function b() {}\nexport class C {}';
        const result = removeExportModifiers(content);
        expect(result).toBe('const a = 1;\nfunction b() {}\nclass C {}');
    });

    test('should leave content unchanged if there are no export modifiers', () => {
        const content = 'const local = true;';
        const result = removeExportModifiers(content);
        expect(result).toBe(content);
    });

    test('should not remove words containing "export" within strings or comments', () => {
        const content = 'console.log("export data"); // export comment';
        const result = removeExportModifiers(content);
        expect(result).toBe(content);
    });
});

describe('needsCleaning', () => {
    test('should return true if content starts with a shebang', () => {
        const content = '#!/usr/bin/env node\nconsole.log("hello");';
        const result = needsCleaning(content);
        expect(result).toBe(true);
    });

    test('should return true if content contains empty export', () => {
        const content = 'console.log("test");\nexport {};';
        const result = needsCleaning(content);
        expect(result).toBe(true);
    });

    test('should return true if content contains a JSDoc comment', () => {
        const content = '/** JSDoc */\nfunction test() {}';
        const result = needsCleaning(content);
        expect(result).toBe(true);
    });

    test('should return false for normal code with no shebang, empty export, or JSDoc', () => {
        const content = 'const x = 1;\nconsole.log(x);';
        const result = needsCleaning(content);
        expect(result).toBe(false);
    });

    test('should handle empty string gracefully', () => {
        const content = '';
        const result = needsCleaning(content);
        expect(result).toBe(false);
    });

    test('should return false if "#" appears later but not at start', () => {
        const content = 'const symbol = "#";';
        const result = needsCleaning(content);
        expect(result).toBe(false);
    });
});

describe('cleanContent', () => {
    beforeEach(() => {
        xJet.mock(needsCleaning);
        xJet.mock(removeShebang);
        xJet.mock(removeEmptyExports);
        xJet.mock(removeOrphanComments);
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    test('should return content unchanged if needsCleaning returns false', () => {
        (needsCleaning as any).mockReturnValue(false);
        const content = 'const x = 1;';
        const result = cleanContent(content);
        expect(result).toBe(content);
    });

    test('should clean content step by step if needsCleaning returns true', () => {
        const content = '#!/usr/bin/env node\nexport {};\n/** comment */\nconsole.log("test");';

        (needsCleaning as any).mockReturnValue(true);
        (removeShebang as any).mockImplementation((c: string) => c.replace('#!/usr/bin/env node\n', ''));
        (removeEmptyExports as any).mockImplementation((c: string) => c.replace('export {};\n', ''));
        (removeOrphanComments as any).mockImplementation((c: string) => c.replace('/** comment */\n', ''));

        const result = cleanContent(content);
        expect(result).toBe('console.log("test");');
    });

    test('should call all cleaning functions in order', () => {
        const content = '#!/usr/bin/env node\nexport {};\n/** comment */\nconsole.log("test");';

        (needsCleaning as any).mockReturnValue(true);
        const shebangSpy = xJet.spyOn({ removeShebang }, 'removeShebang');
        const exportSpy = xJet.spyOn({ removeEmptyExports }, 'removeEmptyExports');
        const commentSpy = xJet.spyOn({ removeOrphanComments }, 'removeOrphanComments');

        cleanContent(content);

        expect(shebangSpy).toHaveBeenCalled();
        expect(exportSpy).toHaveBeenCalled();
        expect(commentSpy).toHaveBeenCalled();
    });
});

describe('resolveAliases', () => {
    let aliasRegex: RegExp;
    let content: string;
    let sourceFile: SourceFile;
    let options: CompilerOptions;

    beforeEach(() => {
        aliasRegex = /from ['"](.*)['"]/g;
        content = 'import { something } from "module-alias";';
        sourceFile = { fileName: '/src/index.ts' } as unknown as SourceFile;
        options = {} as CompilerOptions;

        xJet.mock(resolveModuleName);
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    test('should replace alias with relative path if resolved', () => {
        (resolveModuleName as any).mockReturnValue('/src/module-alias.ts');

        const result = resolveAliases(aliasRegex, content, sourceFile, options);
        expect(result).toBe('import { something } from "./module-alias.d.ts";');
    });

    test('should prepend "./" if relative path does not start with "."', () => {
        (resolveModuleName as any).mockReturnValue('/src/module-alias.ts');

        const result = resolveAliases(aliasRegex, content, sourceFile, options);
        const pathPart = result.match(/from ["'](.*)["']/)![1];
        expect(pathPart.startsWith('./')).toBe(true);
    });

    test('should return original import if module cannot be resolved', () => {
        (resolveModuleName as any).mockReturnValue(undefined);

        const result = resolveAliases(aliasRegex, content, sourceFile, options);
        expect(result).toBe(content);
    });

    test('should correctly convert .ts or .tsx to .d.ts', () => {
        (resolveModuleName as any).mockReturnValue('/src/component.tsx');

        const result = resolveAliases(aliasRegex, content, sourceFile, options);
        expect(result).toBe('import { something } from "./component.d.ts";');
    });

    test('should handle multiple import statements', () => {
        content = `
            import { a } from "alias-a";
            import { b } from "alias-b";
        `;
        (resolveModuleName as any)
            .mockReturnValueOnce('/src/a.ts')
            .mockReturnValueOnce('/src/b.ts');

        const result = resolveAliases(aliasRegex, content, sourceFile, options);
        expect(result).toContain('./a.d.ts');
        expect(result).toContain('./b.d.ts');
    });
});

describe('emitSingleDeclaration', () => {
    let service: LanguageService;
    let sourceFile: SourceFile;
    let aliasRegex: RegExp;
    let options: CompilerOptions;

    beforeEach(() => {
        aliasRegex = /from ['"](.*)['"]/g;
        options = {} as CompilerOptions;
        sourceFile = { fileName: '/src/index.ts' } as unknown as SourceFile;

        service = {
            getEmitOutput: xJet.fn()
        } as unknown as LanguageService;

        xJet.mock(mkdir);
        xJet.mock(writeFile);
        xJet.mock(cleanContent);
        xJet.mock(resolveAliases);
    });

    afterEach(() => {
        xJet.restoreAllMocks();
    });

    test('should return early if emitSkipped is true', async () => {
        (service.getEmitOutput as any).mockReturnValue({ emitSkipped: true, outputFiles: [] });

        await emitSingleDeclaration.call(service, sourceFile, options, aliasRegex);

        expect(cleanContent).not.toHaveBeenCalled();
        expect(resolveAliases).not.toHaveBeenCalled();
        expect(mkdir).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
    });

    test('should clean content and resolve aliases before writing file', async () => {
        const emittedFile = { text: 'content', name: '/dist/index.d.ts' };
        (service.getEmitOutput as any).mockReturnValue({ emitSkipped: false, outputFiles: [ emittedFile ] });
        (cleanContent as any).mockImplementation(() => 'cleaned-content');
        (resolveAliases as any).mockImplementation(() => 'resolved-content');
        (mkdir as any).mockResolvedValue(undefined);
        (writeFile as any).mockResolvedValue(undefined);

        await emitSingleDeclaration.call(service, sourceFile, options, aliasRegex);

        expect(cleanContent).toHaveBeenCalledWith('content');
        expect(resolveAliases).toHaveBeenCalledWith(aliasRegex, 'cleaned-content', sourceFile, options);
        expect(mkdir).toHaveBeenCalledWith('/dist', { recursive: true });
        expect(writeFile).toHaveBeenCalledWith('/dist/index.d.ts', 'resolved-content', 'utf8');
    });

    test('should handle multiple output files (uses first only)', async () => {
        const emittedFiles = [
            { text: 'file1', name: '/dist/file1.d.ts' },
            { text: 'file2', name: '/dist/file2.d.ts' }
        ];
        (service.getEmitOutput as any).mockReturnValue({ emitSkipped: false, outputFiles: emittedFiles });
        (mkdir as any).mockResolvedValue(undefined);
        (writeFile as any).mockResolvedValue(undefined);
        (cleanContent as any).mockImplementation((c: unknown) => c);
        (resolveAliases as any).mockImplementation((r: unknown, c: unknown) => c);

        await emitSingleDeclaration.call(service, sourceFile, options, aliasRegex);

        expect(writeFile).toHaveBeenCalledWith('/dist/file1.d.ts', 'file1', 'utf8');
    });
});
