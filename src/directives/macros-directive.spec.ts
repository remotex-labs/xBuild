/**
 * Import will remove at compile time
 */

import type { MockState } from '@remotex-labs/xjet';
import type { VariantService } from '@services/variant.service';
import type { StateInterface } from '@directives/interfaces/macros-directive.interface';
import type { MacrosStateInterface } from '@directives/interfaces/analyze-directive.interface';
import type { LoadContextInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { readFileSync } from 'fs';
import { SourceService } from '@remotex-labs/xmap';
import { nodeContainsMacro, transformerDirective } from '@directives/macros.directive';
import { astDefineVariable, astDefineCallExpression } from '@directives/define.directive';
import { astInlineCallExpression, astInlineVariable } from '@directives/inline.directive';
import { astProcess, isCallExpression, isVariableStatement  } from '@directives/macros.directive';

describe('transformer.directive', () => {
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
                    filesWithMacros: new Set(),
                    replacementInfo: []
                }
            }
        } as any;
    });

    function parseCode(code: string) {
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        state.contents = code;
        state.stage.defineMetadata.filesWithMacros.add('test.ts');

        return state.sourceFile;
    }

    describe('nodeContainsMacro', () => {
        test('detects $$ifdef macro', () => {
            parseCode('const x = $$ifdef(\'DEBUG\', value);');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(true);
        });

        test('detects $$ifndef macro', () => {
            parseCode('const x = $$ifndef(\'PROD\', value);');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(true);
        });

        test('detects $$inline macro', () => {
            parseCode('const x = $$inline(() => 42);');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(true);
        });

        test('detects multiple macros', () => {
            parseCode('$$ifdef(\'DEBUG\', () => {}); $$inline(() => {});');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(true);
        });

        test('does not detect non-macro code', () => {
            parseCode('const x = regularFunction(\'DEBUG\', value);');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(false);
        });

        test('returns true when sourceFile provided', () => {
            parseCode('const x = $$ifdef(\'DEBUG\', value);');
            const node = state.sourceFile.statements[0];
            expect(nodeContainsMacro(node, state.sourceFile)).toBe(true);
        });
    });

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

        test('processes const declarations', async () => {
            parseCode('const $$x = $$ifdef(\'DEBUG\', value);');
            astDefineVariableMock.mockReturnValue('function $$x() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('processes let declarations', async () => {
            parseCode('let $$x = $$ifdef(\'DEBUG\', value);');
            astDefineVariableMock.mockReturnValue('function $$x() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('processes var declarations', async () => {
            parseCode('var $$x = $$ifdef(\'DEBUG\', value);');
            astDefineVariableMock.mockReturnValue('function $$x() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('handles IIFE wrapped macro', async () => {
            parseCode('const x = $$ifdef(\'DEBUG\', () => log)(\'test\');');
            astDefineCallExpressionMock.mockReturnValue('function log() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('handles IIFE with multiple arguments', async () => {
            parseCode('const x = $$ifdef(\'DEBUG\', () => add)(1, 2, 3);');
            astDefineCallExpressionMock.mockReturnValue('function add() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('handles as expression with macro', async () => {
            parseCode('const x = $$ifdef(\'DEBUG\', value) as string;');
            astDefineVariableMock.mockReturnValue('function x() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(1);
        });

        test('handles multiple declarations', async () => {
            parseCode('const a = 1, $$b = $$ifdef(\'DEBUG\', 2), c = 3;');
            astDefineVariableMock.mockReturnValue('function $$b() {}');

            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBeGreaterThanOrEqual(1);
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

            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
        });

        test('skips variables with no initializer', async () => {
            parseCode('const x;');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await isVariableStatement(node, replacements, state);
            expect(replacements.size).toBe(0);
        });

        test('throws on insufficient arguments for ifdef', async () => {
            parseCode('const x = $$ifdef(\'DEBUG\');');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
        });

        test('throws on excess arguments for ifdef', async () => {
            parseCode('const x = $$ifdef(\'DEBUG\', 1, 2, 3);');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
        });

        test('throws on insufficient arguments for inline', async () => {
            parseCode('const x = $$inline();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
        });

        test('throws on excess arguments for inline', async () => {
            parseCode('const x = $$inline(() => 1, 2);');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.VariableStatement;

            await expect(isVariableStatement(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
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
            expect(replacement.end).toBeGreaterThan(replacement.start);
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

        test('processes ifndef call expression', async () => {
            parseCode('$$ifndef("PROD", () => {});');
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
            expect(replacements.size).toBe(0);
        });

        test('skips non-identifier expressions', async () => {
            parseCode('(() => {})();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await isCallExpression(node, replacements, state);
            expect(replacements.size).toBe(0);
        });

        test('throws on insufficient arguments for ifdef', async () => {
            parseCode('$$ifdef("DEBUG");');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await expect(isCallExpression(node, replacements, state))
                .rejects.toThrow('Invalid macro call: $$ifdef with 1 arguments');
        });

        test('throws on excess arguments for ifdef', async () => {
            parseCode('$$ifdef("DEBUG", 1, 2);');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await expect(isCallExpression(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
        });

        test('throws on insufficient arguments for inline', async () => {
            parseCode('$$inline();');
            const replacements = new Set<any>();
            const node = state.sourceFile.statements[0] as ts.ExpressionStatement;

            await expect(isCallExpression(node, replacements, state))
                .rejects.toThrow('Invalid macro call');
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
        test('returns original content when no macros', async () => {
            parseCode('const x = 1;');
            state.stage.defineMetadata.filesWithMacros.clear();
            const result = await astProcess(state);

            expect(result).toBe('const x = 1;');
        });

        test('skips processing when no disabled macros', async () => {
            parseCode('const x = 1;');
            state.stage.defineMetadata.filesWithMacros.clear();
            state.stage.defineMetadata.disabledMacroNames.clear();

            const result = await astProcess(state);

            expect(result).toBe('const x = 1;');
        });

        test('processes variable statement macros and replaces call boundaries', async () => {
            parseCode('const $$debug = $$ifdef("DEBUG", () => {});');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            const result = await astProcess(state);

            expect(result).toContain('function $$debug()');
        });

        test('processes call expression macros', async () => {
            parseCode('$$inline(() => 42);');
            astInlineCallExpressionMock.mockResolvedValue('42');

            const result = await astProcess(state);

            expect(result).toContain('42');
        });

        test('replaces disabled macro calls with undefined', async () => {
            parseCode('$$disabledMacro();');
            state.stage.defineMetadata.filesWithMacros.clear();
            state.stage.defineMetadata.disabledMacroNames.add('$$disabledMacro');
            const result = await astProcess(state);

            expect(result).toContain('undefined');
        });

        test('replaces disabled macro identifiers with undefined', async () => {
            parseCode('const x = $$disabledMacro;');
            state.stage.defineMetadata.filesWithMacros.clear();
            state.stage.defineMetadata.disabledMacroNames.add('$$disabledMacro');

            const result = await astProcess(state);

            expect(result).toContain('undefined');
        });

        test('handles multiple disabled macros', async () => {
            parseCode('const a = $$disabled1; const b = $$disabled2;');
            state.stage.defineMetadata.filesWithMacros.clear();
            state.stage.defineMetadata.disabledMacroNames.add('$$disabled1');
            state.stage.defineMetadata.disabledMacroNames.add('$$disabled2');

            const result = await astProcess(state);
            expect(result.match(/undefined/g)?.length).toBe(2);
        });

        test('handles macro inside function', async () => {
            parseCode(`
                function test() {
                    const x = $$ifdef('DEBUG', 1);
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('function test()');
        });

        test('handles macro inside class method', async () => {
            parseCode(`
                class Test {
                    method() {
                        const x = $$ifdef('DEBUG', 1);
                    }
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('class Test');
        });

        test('handles macro inside async function', async () => {
            parseCode(`
                async function test() {
                    const x = $$ifdef('DEBUG', 1);
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('async function test()');
        });

        test('handles macro inside arrow function', async () => {
            parseCode('const fn = () => { const x = $$ifdef("DEBUG", 1); };');
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('const fn');
        });

        test('handles macro inside if statement', async () => {
            parseCode(`
                if (condition) {
                    const x = $$ifdef('DEBUG', 1);
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('if');
        });

        test('handles macro inside for loop', async () => {
            parseCode(`
                for (let i = 0; i < 10; i++) {
                    const x = $$ifdef('DEBUG', 1);
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('for');
        });

        test('handles deeply nested macros', async () => {
            parseCode(`
                function a() {
                    function b() {
                        function c() {
                            const x = $$ifdef('DEBUG', 1);
                        }
                    }
                }
            `);
            astDefineVariableMock.mockReturnValue('function x() {}');

            const result = await astProcess(state);
            expect(result).toContain('function a()');
        });

        test('populates replacementInfo array', async () => {
            parseCode('$$disabledMacro();');
            state.stage.defineMetadata.filesWithMacros.clear();
            state.stage.defineMetadata.disabledMacroNames.add('$$disabledMacro');

            await astProcess(state);
            expect(Array.isArray(state.stage.replacementInfo)).toBe(true);
        });

        test('handles empty code', async () => {
            parseCode('');
            const result = await astProcess(state);
            expect(result).toBe('');
        });

        test('processes multiple statements', async () => {
            parseCode('const a = 1; const b = 2; const c = 3;');
            state.stage.defineMetadata.filesWithMacros.clear();
            const result = await astProcess(state);
            expect(result).toBe('const a = 1; const b = 2; const c = 3;');
        });
    });

    describe('transformerDirective', () => {
        let variant: VariantService;
        let context: LoadContextInterface & { stage: MacrosStateInterface };

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
                        filesWithMacros: new Set(),
                        replacementInfo: []
                    }
                },
                contents: Buffer.from('const x = 1;')
            } as any;
        });

        test('returns undefined for non-ts/js files', async () => {
            context.args.path = 'test.css';
            const result = await transformerDirective(variant, context);
            expect(result).toBeUndefined();
        });

        test('returns undefined for empty contents', async () => {
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

            astInlineVariableMock.mockResolvedValueOnce('const x = 42;');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.js', context.contents.toString(), ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result?.contents).toContain('const x = 42;');
        });

        test('skips node_modules', async () => {
            context.args.path = 'node_modules/package/index.ts';
            const result = await transformerDirective(variant, context);
            expect(result).toBeUndefined();
        });

        test('skips .json files', async () => {
            context.args.path = 'config.json';
            const result = await transformerDirective(variant, context);
            expect(result).toBeUndefined();
        });

        test('returns undefined when source file not found', async () => {
            const result = await transformerDirective(variant, context);
            expect(result).toBeUndefined();
        });

        test('returns OnLoadResult with loader', async () => {
            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result?.loader).toBe('ts');
        });

        test('returns contents in result', async () => {
            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result?.contents).toBeDefined();
        });

        test('returns warnings and errors arrays', async () => {
            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(Array.isArray(result?.warnings)).toBe(true);
            expect(Array.isArray(result?.errors)).toBe(true);
        });

        test('resolves path aliases when bundle is false', async () => {
            variant.config.esbuild.bundle = false;
            (<any> variant.typescript.languageHostService).aliasRegex = /@/;

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
            (<any> variant.typescript.languageHostService).aliasRegex = undefined;

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            await transformerDirective(variant, context);

            expect(variant.typescript.languageHostService.resolveAliases).not.toHaveBeenCalled();
        });

        test('uses defines from variant config', async () => {
            variant.config.define = { MY_VAR: 'value' };

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(result).toBeDefined();
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

        test('handles buffer content', async () => {
            context.contents = Buffer.from('const x = 1;');

            xJet.spyOn(variant.typescript.languageService, 'getProgram').mockReturnValue({
                getSourceFile: xJet.fn().mockReturnValue(
                    ts.createSourceFile('test.ts', 'const x = 1;', ts.ScriptTarget.ESNext)
                )
            } as any);

            const result = await transformerDirective(variant, context);

            expect(typeof result?.contents).toBe('string');
        });
    });

    describe('integration tests', () => {
        test('transforms ifdef macro in variable declaration', async () => {
            const code = 'const $$debug = $$ifdef(\'DEBUG\', () => console.log);';
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('function $$debug() {}');

            const result = await astProcess(state);
            expect(result).toContain('function $$debug()');
        });

        test('transforms multiple macros in sequence', async () => {
            const code = `
                const $$a = $$ifdef('A', () => {});
                const $$b = $$ifdef('B', () => {});
                $$a();
                $$b();
            `;
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('function() {}');

            const result = await astProcess(state);
            expect(result).toBeDefined();
        });

        test('handles conditional logging', async () => {
            const code = `
                const log = $$ifdef('DEBUG', () => console.log);
                function app() {
                    log('starting');
                }
            `;
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('function log() {}');

            const result = await astProcess(state);
            expect(result).toContain('function app()');
        });

        test('handles feature flags', async () => {
            const code = `
                const features = {
                    newUI: $$ifdef('FEATURE_NEW_UI', true),
                    beta: $$ifndef('PRODUCTION', true)
                };
            `;
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('true');

            const result = await astProcess(state);
            expect(result).toBeDefined();
        });

        test('handles environment-specific config', async () => {
            const code = `
                export const config = {
                    apiUrl: $$inline(() => process.env.API_URL),
                    debug: $$ifdef('DEBUG', true),
                    production: $$ifdef('PRODUCTION', true)
                };
            `;
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('true');
            astInlineCallExpressionMock.mockResolvedValue('process.env.API_URL');

            const result = await astProcess(state);
            expect(result).toBeDefined();
        });

        test('handles service with debugging', async () => {
            const code = `
                class Service {
                    constructor() {
                        this.logger = $$ifdef('DEBUG', () => console.log);
                    }
                    execute() {
                        this.logger('executing');
                    }
                }
            `;
            state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
            state.contents = code;
            state.stage.defineMetadata.filesWithMacros.add('test.ts');
            astDefineVariableMock.mockReturnValue('function() {}');

            const result = await astProcess(state);
            expect(result).toContain('class Service');
        });
    });
});
