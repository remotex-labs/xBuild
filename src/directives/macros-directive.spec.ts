/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';
import type { VariantService } from '@services/variant.service';
import type { StateInterface } from '@directives/interfaces/macros-directive.interface';
import type { MacrosStaeInterface } from '@directives/interfaces/analyze-directive.interface';
import type { LoadContextInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { readFileSync } from 'fs';
import { SourceService } from '@remotex-labs/xmap';
import { astDefineVariable, astDefineCallExpression } from '@directives/define.directive';
import { astInlineCallExpression, astInlineVariable } from '@directives/inline.directive';
import { isVariableStatement, isCallExpression, astProcess, transformerDirective } from './macros.directive';

/**
 * Tests
 */

describe('macros.directive', () => {
    let state: StateInterface;
    let astDefineVariableMock: MockState;
    let astInlineVariableMock: MockState;
    let astDefineCallExpressionMock: MockState;
    let astInlineCallExpressionMock: MockState;

    beforeEach(() => {
        xJet.restoreAllMocks();
        const dummySourceMap = JSON.stringify({
            version: 3,
            sources: [ 'framework.ts' ],
            names: [],
            mappings: 'AAAA'
        });

        xJet.mock(SourceService).mockImplementation((() => {}) as any);
        xJet.mock(readFileSync).mockImplementation(() => dummySourceMap);

        astDefineVariableMock = xJet.mock(astDefineVariable);
        astInlineVariableMock = xJet.mock(astInlineVariable);
        astDefineCallExpressionMock = xJet.mock(astDefineCallExpression);
        astInlineCallExpressionMock = xJet.mock(astInlineCallExpression);

        state = {
            sourceFile: ts.createSourceFile('test.ts', '', ts.ScriptTarget.ESNext),
            errors: [],
            warnings: [],
            defines: {},
            contents: '',
            stage: {
                defineMetadata: {
                    disabledMacroNames: new Set(),
                    filesWithMacros: new Set()
                }
            }
        } as any;
    });

    function parseCode(code: string) {
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        state.contents = code;

        return state.sourceFile;
    }

    describe('isVariableStatement', () => {
        test('processes ifdef variable declaration', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(astDefineVariableMock).toHaveBeenCalled();
            expect(replacements.size).toBe(1);
        });

        test('processes ifndef variable declaration', async () => {
            parseCode('const $$noProd = $$ifndef("PRODUCTION", () => {});');
            astDefineVariableMock.mockReturnValue('function $$noProd() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(astDefineVariableMock).toHaveBeenCalled();
            expect(replacements.size).toBe(1);
        });

        test('processes inline variable declaration', async () => {
            parseCode('const result = $$inline(() => 42);');
            astInlineVariableMock.mockResolvedValue('const result = 42;');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(astInlineVariableMock).toHaveBeenCalled();
            expect(replacements.size).toBe(1);
        });

        test('handles export declarations', async () => {
            parseCode('export const $$api = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('export function $$api() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(astDefineVariableMock).toHaveBeenCalledWith(
                expect.any(Object),
                expect.any(Object),
                true,
                state
            );
        });

        test('skips non-call-expression initializers', async () => {
            parseCode('const x = 42;');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(replacements.size).toBe(0);
        });

        test('skips non-macro function calls', async () => {
            parseCode('const x = someFunc();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(replacements.size).toBe(0);
        });

        test('skips macros with insufficient arguments', async () => {
            parseCode('const x = $$ifdef();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            // expect(replacements.size).toBe(1);
            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call: $$ifdef with 0 arguments');
        });

        test('does not add replacement when function returns false', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue(false);

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            expect(replacements.size).toBe(0);
        });

        test('stores correct replacement positions', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);

            const [ replacement ] = Array.from(replacements) as any;
            expect(replacement.start).toBe(0);
            expect(replacement.end).toBeGreaterThan(0);
            expect(replacement.replacement).toBe('function $$debug() {}');
        });
    });

    describe('isCallExpression', () => {
        test('processes ifdef call expression', async () => {
            parseCode('$$ifdef("DEBUG", () => {});');
            astDefineCallExpressionMock.mockReturnValue('(() => {})()');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await isCallExpression(node, replacements, state);

            expect(astDefineCallExpressionMock).toHaveBeenCalled();
        });

        test('processes inline call expression', async () => {
            parseCode('$$inline(() => 42);');
            astInlineCallExpressionMock.mockResolvedValue('42');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await isCallExpression(node, replacements, state);

            expect(astInlineCallExpressionMock).toHaveBeenCalled();
            expect(replacements.size).toBe(1);
        });

        test('skips non-macro function calls', async () => {
            parseCode('someFunc();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await isCallExpression(node, replacements, state);

            // expect(replacements.size).toBe(1);
            expect(replacements.size).toBe(0);
        });

        test('skips macros with insufficient arguments', async () => {
            parseCode('$$ifdef("DEBUG");');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            // expect(replacements.size).toBe(1);
            await expect(isCallExpression(node, replacements, state))
                .rejects.toThrow('Invalid macro call: $$ifdef with 1 arguments');
        });

        test('does not add replacement when function returns false', async () => {
            parseCode('$$inline(() => 42);');
            astInlineCallExpressionMock.mockResolvedValue(false);

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await isCallExpression(node, replacements, state);

            expect(replacements.size).toBe(0);
        });
    });

    describe('astProcess', () => {
        beforeEach(() => {
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
        });

        test('returns original content when no replacements', async () => {
            parseCode('const x = 1;');
            const result = await astProcess(state);

            expect(result).toBe('const x = 1;');
        });

        test('processes variable statement macros', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            const result = await astProcess(state);

            expect(result).toBe('function $$debug() {}');
        });

        test('processes call expression macros', async () => {
            parseCode('$$inline(() => 42);');
            astInlineCallExpressionMock.mockResolvedValue('42');

            const result = await astProcess(state);

            expect(result).toBe('42');
        });

        test('processes nested inline calls', async () => {
            parseCode('console.log($$inline(() => 42));');
            astInlineCallExpressionMock.mockResolvedValue('42');
            const result = await astProcess(state);

            expect(result).toBe('console.log(42);');
        });

        test('replaces disabled macro calls with undefined', async () => {
            parseCode('$$disabledMacro();');
            state.stage.defineMetadata.disabledMacroNames.add('$$disabledMacro');
            const result = await astProcess(state);

            expect(result).toBe('undefined');
        });

        test('replaces disabled macro identifiers with undefined', async () => {
            parseCode('const x = $$disabledMacro;');
            state.stage.defineMetadata.disabledMacroNames.add('$$disabledMacro');

            const result = await astProcess(state);

            expect(result).toBe('const x = undefined;');
        });

        test('preserves macro identifiers in macro calls', async () => {
            parseCode('const x = $$ifdef("DEBUG", $$disabled);');
            state.stage.defineMetadata.disabledMacroNames.add('$$disabled');
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);

            // The disabled identifier inside the macro call should not be replaced
            expect(result).toBe('function x() {}');
        });

        test('handles multiple replacements', async () => {
            const code = 'const a = $$inline(() => 1);\nconst b = $$inline(() => 2);';
            parseCode(code);
            astInlineVariableMock.mockResolvedValueOnce('const a = 1;').mockResolvedValueOnce('const b = 2;');
            astInlineCallExpressionMock.mockResolvedValue(false);

            const result = await astProcess(state);

            expect(result).toBe('const a = 1;\nconst b = 2;');
        });

        test('applies replacements in reverse order', async () => {
            parseCode('$$inline(() => 1); $$inline(() => 2);');

            // These are ExpressionStatements, so they go through isCallExpression
            astInlineCallExpressionMock
                .mockResolvedValueOnce('1')
                .mockResolvedValueOnce(false) // nested call - return false to skip
                .mockResolvedValueOnce('2')
                .mockResolvedValueOnce(false); // nested call - return false to skip

            const result = await astProcess(state);

            // Verify both mocks were called
            expect(astInlineCallExpressionMock).toHaveBeenCalledTimes(4);

            expect(result).toBe('1 2');
        });

        test('handles empty replacement strings', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('');

            const result = await astProcess(state);

            expect(result).toBe('');
        });

        test('visits all child nodes recursively', async () => {
            parseCode(`
                    function outer() {
                        const inner = $$inline(() => 42);
                    }
                `);

            // This is a VariableStatement inside a function, so it will be called twice
            astInlineVariableMock
                .mockResolvedValueOnce('const inner = 42;')
                .mockResolvedValue(false); // Any additional calls return false

            const result = await astProcess(state);

            expect(result).toContain('const inner = 42;');
        });
    });

    describe('transformerDirective', () => {
        let variant: VariantService;
        let context: LoadContextInterface & { stage: MacrosStaeInterface };

        beforeEach(() => {
            xJet.resetAllMocks();

            variant = {
                config: {
                    define: { DEBUG: true },
                    esbuild: { bundle: true }
                },
                typescript: {
                    languageService: {
                        getProgram: xJet.fn().mockReturnValue({
                            getSourceFile: xJet.fn().mockReturnValue(null)
                        })
                    },
                    languageHostService: {
                        touchFile: xJet.fn(),
                        aliasRegex: undefined,
                        resolveAliases: xJet.fn((content: string) => content)
                    }
                }
            } as any;

            context = {
                args: { path: 'test.ts' },
                loader: 'ts',
                stage: {
                    defineMetadata: {
                        disabledMacroNames: new Set(),
                        filesWithMacros: new Set()
                    }
                },
                contents: Buffer.from('const x = 1;')
            } as any;
        });

        test('returns unchanged for non-ts/js files', async () => {
            context.args.path = 'test.css';
            const result = await transformerDirective(variant, context);
            expect(result).toBeUndefined();
        });

        test('returns unchanged for empty contents', async () => {
            context.contents = Buffer.from('');
            const result = await transformerDirective(variant, context);

            expect(result).toBeUndefined();
        });

        test('processes TypeScript files', async () => {
            context.stage.defineMetadata.filesWithMacros.add('test.ts');
            context.contents = Buffer.from('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', context.contents.toString(), ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result?.contents).toContain('function $$debug()');
        });

        test('processes JavaScript files', async () => {
            context.args.path = 'test.js';
            context.stage.defineMetadata.filesWithMacros.add('test.js');
            context.contents = Buffer.from('const x = $$inline(() => 42);');

            // This is a VariableStatement, so it calls astInlineVariable
            astInlineVariableMock
                .mockResolvedValueOnce('const x = 42;')
                .mockResolvedValue(false);

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.js', context.contents.toString(), ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result?.contents).toContain('const x = 42;');
        });

        test('resolves path aliases when bundle is false', async () => {
            variant.config.esbuild.bundle = false;

            (<any> variant.typescript.languageHostService).aliasRegex = /test/;
            variant.typescript.languageHostService.resolveAliases = xJet.fn((content) => content + ' resolved');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            await transformerDirective(variant, context);
            expect(variant.typescript.languageHostService.resolveAliases).toHaveBeenCalledWith(
                expect.any(String),
                'test.ts',
                '.js'
            );
        });

        test('does not resolve aliases when bundle is true', async () => {
            variant.config.esbuild.bundle = true;

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            await transformerDirective(variant, context);

            expect(variant.typescript.languageHostService.resolveAliases).not.toHaveBeenCalled();
        });

        test('does not resolve aliases when aliasRegex is undefined', async () => {
            variant.config.esbuild.bundle = false;
            // aliasRegex is already undefined by default, no need to set it

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            await transformerDirective(variant, context);

            expect(variant.typescript.languageHostService.resolveAliases).not.toHaveBeenCalled();
        });

        test('returns warnings and errors in result', async () => {
            context.contents = Buffer.from('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', context.contents.toString(), ts.ScriptTarget.ESNext)
                )
            } as any);

            const result: any = await transformerDirective(variant, context);

            expect(result.warnings).toBeDefined();
            expect(result.errors).toBeDefined();
            expect(Array.isArray(result.warnings)).toBe(true);
            expect(Array.isArray(result.errors)).toBe(true);
        });

        test('uses defines from variant config', async () => {
            variant.config.define = { DEBUG: true, PROD: false };
            context.contents = Buffer.from('const x = 1;');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            await transformerDirective(variant, context);
            expect(astDefineVariableMock).not.toHaveBeenCalled();
        });

        test('handles undefined define config', async () => {
            variant.config.define = undefined;
            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result).toBeDefined();
        });
    });
});
