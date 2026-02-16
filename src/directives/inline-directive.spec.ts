/**
 * Import will remove at compile time
 */

import type { StateInterface } from '@directives/interfaces/macros-directive.interface';
import type { ModuleInterface } from '@directives/interfaces/inline-directive.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { dirname } from 'path';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { InlineError } from '@errors/inline.error';
import { SourceService } from '@remotex-labs/xmap';
import { sandboxExecute } from '@services/vm.service';
import { buildFromString } from '@services/transpiler.service';
import { evaluateCode, createSandboxContext, wrapInIIFE } from './inline.directive';
import { extractExecutableCode, astInlineVariable, astInlineCallExpression } from './inline.directive';

/**
 * Tests
 */

beforeEach(() => {
    xJet.resetAllMocks();

    const dummySourceMap = JSON.stringify({
        version: 3,
        sources: [ 'framework.ts' ],
        names: [],
        mappings: 'AAAA'
    });

    xJet.mock(SourceService).mockImplementation((() => {}) as any);
    xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);
});

describe('wrapInIIFE', () => {
    test('wraps simple code in IIFE', () => {
        const code = 'return 42';
        const result = wrapInIIFE(code);

        expect(result).toBe('module.exports = (return 42)();');
    });

    test('wraps function expression in IIFE', () => {
        const code = '() => 123';
        const result = wrapInIIFE(code);

        expect(result).toBe('module.exports = (() => 123)();');
    });

    test('wraps arrow function in IIFE', () => {
        const code = 'function() { return "test"; }';
        const result = wrapInIIFE(code);

        expect(result).toBe('module.exports = (function() { return "test"; })();');
    });

    test('wraps complex expression in IIFE', () => {
        const code = 'JSON.stringify({ key: "value" })';
        const result = wrapInIIFE(code);

        expect(result).toBe('module.exports = (JSON.stringify({ key: "value" }))();');
    });
});

describe('createSandboxContext', () => {
    test('includes global properties', () => {
        const module: ModuleInterface = { exports: {} };
        const require = xJet.fn() as any;
        const fileName = '/project/src/test.ts';

        const context = createSandboxContext(fileName, module, require);

        expect(context.process).toBe(process);
        expect(context.Buffer).toBe(Buffer);
        expect(context.console).toBe(console);
        expect(context.setTimeout).toBe(setTimeout);
        expect(context.setInterval).toBe(setInterval);
        expect(context.clearTimeout).toBe(clearTimeout);
        expect(context.clearInterval).toBe(clearInterval);
    });

    test('includes module and require', () => {
        const module: ModuleInterface = { exports: {} };
        const require = xJet.fn() as any;
        const fileName = '/project/src/test.ts';

        const context = createSandboxContext(fileName, module, require);

        expect(context.module).toBe(module);
        expect(context.require).toBe(require);
    });

    test('sets __dirname to directory of file', () => {
        const module: ModuleInterface = { exports: {} };
        const require = xJet.fn() as any;
        const fileName = '/project/src/utils/test.ts';

        const context = createSandboxContext(fileName, module, require);

        expect(context.__dirname).toBe(dirname(fileName));
    });

    test('sets __filename to file path', () => {
        const module: ModuleInterface = { exports: {} };
        const require = xJet.fn() as any;
        const fileName = '/project/src/test.ts';

        const context = createSandboxContext(fileName, module, require);

        expect(context.__filename).toBe(fileName);
    });

    test('includes globalThis properties', () => {
        const module: ModuleInterface = { exports: {} };
        const require = xJet.fn() as any;
        const fileName = '/test.ts';

        const context = createSandboxContext(fileName, module, require);

        // Check some globalThis properties are spread
        expect(context.RegExp).toBe(RegExp);
    });
});

describe('evaluateCode', () => {
    const buildFromStringMock = xJet.mock(buildFromString);
    const sandboxExecuteMock = xJet.mock(sandboxExecute);

    let state: StateInterface;

    beforeEach(() => {
        state = {
            sourceFile: ts.createSourceFile(
                'test.ts',
                'const x = 1;',
                ts.ScriptTarget.ESNext
            ),
            errors: [],
            warnings: [],
            metadata: {
                disabledMacroNames: new Set(),
                filesWithMacros: new Set()
            }
        } as any;
    });

    test('builds code with correct options', async () => {
        const code = '() => 42';
        const node = state.sourceFile;

        buildFromStringMock.mockResolvedValue({
            outputFiles: [
                { text: '// source map' },
                { text: 'compiled code' }
            ]
        } as any);

        sandboxExecuteMock.mockResolvedValue(<any>undefined);

        await evaluateCode(code, state, node);

        expect(buildFromStringMock).toHaveBeenCalledWith(
            code,
            state.sourceFile.fileName,
            {
                bundle: true,
                format: 'cjs',
                platform: 'node',
                packages: 'external'
            }
        );
    });

    test('executes compiled code in sandbox', async () => {
        const code = '() => "test"';
        const node = state.sourceFile;
        xJet.mock(createRequire).mockReturnValueOnce((()=> {}) as any);

        buildFromStringMock.mockResolvedValue({
            outputFiles: [
                { text: '// source map' },
                { text: 'module.exports = "result";' }
            ]
        } as any);

        sandboxExecuteMock.mockResolvedValue(<any>undefined);
        await evaluateCode(code, state, node);

        expect(sandboxExecuteMock).toHaveBeenCalledWith(
            'module.exports = "result";',
            expect.objectContaining({
                module: expect.any(Object),
                require: expect.any(Function),
                __filename: state.sourceFile.fileName
            }),
            { filename: state.sourceFile.fileName }
        );
    });

    test('returns "undefined" on successful execution', async () => {
        const code = '() => 42';
        const node = state.sourceFile;

        buildFromStringMock.mockResolvedValue({
            outputFiles: [
                { text: '' },
                { text: '' }
            ]
        } as any);

        sandboxExecuteMock.mockResolvedValue(<any>undefined);

        const result = await evaluateCode(code, state, node);

        expect(result).toBe('undefined');
    });

    test('adds InlineError to state on execution error', async () => {
        xJet.mock(createRequire).mockReturnValueOnce((()=> {}) as any);
        const code = '() => { throw new Error("test error"); }';
        const node = state.sourceFile;
        const error = new Error('test error');

        buildFromStringMock.mockResolvedValue({
            outputFiles: [
                { text: 'source map content' },
                { text: 'compiled code' }
            ]
        } as any);

        sandboxExecuteMock.mockRejectedValue(error);

        await evaluateCode(code, state, node);

        expect(state.errors.length).toBe(1);
        expect(state.errors[0].text).toContain('test error');
        expect(state.errors[0].detail).toBeInstanceOf(InlineError);
    });

    test('calculates correct line number for error', async () => {
        xJet.mock(createRequire).mockReturnValueOnce((()=> {}) as any);
        const sourceCode = 'line1\nline2\nconst x = inline();';
        state.sourceFile = ts.createSourceFile(
            'test.ts',
            sourceCode,
            ts.ScriptTarget.ESNext
        );

        const node = state.sourceFile.statements[0];
        const error = new Error('runtime error');

        buildFromStringMock.mockResolvedValue({
            outputFiles: [
                { text: 'map' },
                { text: 'code' }
            ]
        } as any);

        sandboxExecuteMock.mockImplementation((() => {
            throw error;
        }) as any);

        await evaluateCode('code', state, node);

        expect(state.errors.length).toBe(1);
    });
});

describe('extractExecutableCode', () => {
    let state: StateInterface;

    beforeEach(() => {
        state = {
            sourceFile: ts.createSourceFile(
                'test.ts',
                '',
                ts.ScriptTarget.ESNext
            ),
            errors: [],
            warnings: [],
            metadata: {
                disabledMacroNames: new Set(),
                filesWithMacros: new Set()
            }
        } as any;
    });

    test('wraps arrow function in IIFE', () => {
        const code = 'const fn = () => 42;';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const varDecl = (state.sourceFile.statements[0] as ts.VariableStatement)
            .declarationList.declarations[0];
        const arrowFn = varDecl.initializer!;

        const result = extractExecutableCode(arrowFn, state);

        expect(result).not.toBeNull();
        expect(result!.data).toContain('module.exports = (() => 42)();');
        expect(result!.data).toMatch(/^module.exports = \(/);
        expect(result!.data).toMatch(/\);$/);
    });

    test('wraps function expression in IIFE', () => {
        const code = 'const fn = function() { return 123; };';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const varDecl = (state.sourceFile.statements[0] as ts.VariableStatement)
            .declarationList.declarations[0];
        const funcExpr = varDecl.initializer!;

        const result = extractExecutableCode(funcExpr, state);

        expect(result).not.toBeNull();
        expect(result!.data).toContain('function() { return 123; }');
        expect(result!.data).toMatch(/^module.exports = \(/);
        expect(result!.data).toMatch(/\);$/);
    });

    test('finds function declaration by identifier', () => {
        const code = 'function myFunc() { return 42; }\nconst x = $$inline(myFunc);';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[1] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const identifier = callExpr.arguments[0];

        const result = extractExecutableCode(identifier, state);

        expect(result).not.toBeNull();
        expect(result!.data).toContain('myFunc');
        expect(result!.data).toMatch(/^module.exports = \(/);
    });

    test('adds warning when function not found by identifier', () => {
        const code = 'const x = $$inline(unknownFunc);';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[0] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const identifier = callExpr.arguments[0];

        const result = extractExecutableCode(identifier, state);

        expect(result).not.toBeNull();
        expect(result!.data).toBe('');
        expect(state.warnings.length).toBe(1);
        expect(state.warnings[0].text).toContain('unknownFunc');
        expect(state.warnings[0].text).toContain('not found');
    });

    test('finds arrow function in variable declaration', () => {
        const code = 'const myFunc = () => 42;\nconst x = $$inline(myFunc);';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[1] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const identifier = callExpr.arguments[0];

        const result = extractExecutableCode(identifier, state);

        expect(result).not.toBeNull();
        expect(result!.data).toContain('() => 42');
    });

    test('finds function expression in variable declaration', () => {
        const code = 'const myFunc = function() { return 42; };\nconst x = $$inline(myFunc);';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[1] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const identifier = callExpr.arguments[0];

        const result = extractExecutableCode(identifier, state);

        expect(result).not.toBeNull();
        expect(result!.data).toContain('function() { return 42; }');
    });

    test('returns expression text for other node types', () => {
        const code = 'const x = $$inline(1 + 2);';
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[0] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const expression = callExpr.arguments[0];

        const result = extractExecutableCode(expression, state);

        expect(result).not.toBeNull();
        expect(result!.data).toBe('1 + 2');
    });

    test('includes relative path in warning message', () => {
        const code = 'const x = $$inline(missing);';
        state.sourceFile = ts.createSourceFile(
            '/project/src/index.ts',
            code,
            ts.ScriptTarget.ESNext
        );
        const callExpr = (state.sourceFile.statements[0] as ts.VariableStatement)
            .declarationList.declarations[0].initializer as ts.CallExpression;
        const identifier = callExpr.arguments[0];

        extractExecutableCode(identifier, state);

        expect(state.warnings[0].text).toContain('$$inline(missing)');
    });
});

describe('astInline', () => {
    const evaluateCodeMock = xJet.mock(evaluateCode);

    describe('astInlineVariable', () => {

        let state: StateInterface;

        beforeEach(() => {
            state = {
                sourceFile: ts.createSourceFile('test.ts', '', ts.ScriptTarget.ESNext),
                errors: [],
                warnings: [],
                metadata: {
                    disabledMacroNames: new Set(),
                    filesWithMacros: new Set()
                }
            } as any;

            evaluateCodeMock.mockResolvedValue('42');
        });

        test('generates const variable declaration', async () => {
            const code = 'const result = $$inline(() => 42);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toBe('const result = 42;');
        });

        test('generates let variable declaration', async () => {
            const code = 'let result = $$inline(() => 42);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toBe('let result = 42;');
        });

        test('generates var variable declaration', async () => {
            const code = 'var result = $$inline(() => 42);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toBe('var result = 42;');
        });

        test('includes export keyword when hasExport is true', async () => {
            const code = 'export const result = $$inline(() => 42);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, true, state);

            expect(result).toBe('export const result = 42;');
        });

        test('returns false when extractExecutableCode returns null', async () => {
            const code = 'const result = $$inline();';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];

            // Create a proper CallExpression with empty arguments using TypeScript factory
            const init = ts.factory.createCallExpression(
                ts.factory.createIdentifier('$$inline'),
                undefined,
                []
            ) as any as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toBe(false);
        });

        test('evaluates code and includes result', async () => {
            evaluateCodeMock.mockResolvedValue('"hello world"');
            const code = 'const result = $$inline(() => "hello world");';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toBe('const result = "hello world";');
        });

        test('preserves variable name from declaration', async () => {
            const code = 'const myVariable = $$inline(() => 123);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            const result = await astInlineVariable(decl, varStmt, init, false, state);

            expect(result).toContain('myVariable');
        });

        test('calls evaluateCode with extracted code', async () => {
            const code = 'const result = $$inline(() => 42);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
            const decl = varStmt.declarationList.declarations[0];
            const init = decl.initializer as ts.CallExpression;

            await astInlineVariable(decl, varStmt, init, false, state);

            expect(evaluateCodeMock).toHaveBeenCalledWith(
                expect.stringContaining('() => 42'),
                state,
                expect.any(Object)
            );
        });
    });

    describe('astInlineCallExpression', () => {
        let state: StateInterface;

        beforeEach(() => {
            state = {
                sourceFile: ts.createSourceFile('test.ts', '', ts.ScriptTarget.ESNext),
                errors: [],
                warnings: [],
                metadata: {
                    disabledMacroNames: new Set(),
                    filesWithMacros: new Set()
                }
            } as any;

            evaluateCodeMock.mockResolvedValue('42');
        });

        test('returns evaluated code result', async () => {
            evaluateCodeMock.mockResolvedValue('"result"');
            const code = '$$inline(() => "test");';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            const result = await astInlineCallExpression(callExpr.arguments, state);

            expect(result).toBe('"result"');
        });

        test('returns false when no arguments provided', async () => {
            const code = '$$inline();';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);

            const result = await astInlineCallExpression([] as any, state);

            expect(result).toBe(false);
        });

        test('extracts and evaluates first argument', async () => {
            const code = '$$inline(() => 123);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            await astInlineCallExpression(callExpr.arguments, state);

            expect(evaluateCodeMock).toHaveBeenCalledWith(
                expect.stringContaining('() => 123'),
                state,
                expect.any(Object)
            );
        });

        test('returns false when extractExecutableCode returns null', async () => {
            const code = '$$inline(undefined);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            (state.sourceFile.statements[0] as ts.ExpressionStatement).expression as ts.CallExpression;

            // Mock extractExecutableCode to return null indirectly
            const args = { 0: null, length: 1 } as any;

            const result = await astInlineCallExpression(args, state);

            expect(result).toBe(false);
        });

        test('handles arrow function argument', async () => {
            evaluateCodeMock.mockResolvedValue('99');
            const code = '$$inline(() => 99);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            const result = await astInlineCallExpression(callExpr.arguments, state);

            expect(result).toBe('99');
        });

        test('handles function expression argument', async () => {
            evaluateCodeMock.mockResolvedValue('100');
            const code = '$$inline(function() { return 100; });';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            const result = await astInlineCallExpression(callExpr.arguments, state);

            expect(result).toBe('100');
        });

        test('handles identifier reference argument', async () => {
            evaluateCodeMock.mockResolvedValue('200');
            const code = 'function myFunc() { return 200; }\n$$inline(myFunc);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[1] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            const result = await astInlineCallExpression(callExpr.arguments, state);

            expect(result).toBe('200');
        });

        test('handles expression argument', async () => {
            evaluateCodeMock.mockResolvedValue('3');
            const code = '$$inline(1 + 2);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
                .expression as ts.CallExpression;

            const result = await astInlineCallExpression(callExpr.arguments, state);

            expect(result).toBe('3');
        });
    });
});
