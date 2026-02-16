
/**
 * Import will remove at compile time
 */

import type { StateInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { transformToFunction, transformToIIFE, astDefineVariable, astDefineCallExpression } from './define.directive';

/**
 * Tests
 */

describe('define.directive', () => {
    let state: StateInterface;

    beforeEach(() => {
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

    // Helper to parse macro variable statement
    function parseMacroVariable(code: string) {
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
        const decl = varStmt.declarationList.declarations[0];
        const init = decl.initializer as ts.CallExpression;

        return { varStmt, decl, init, arg: init.arguments[1] };
    }

    // Helper to parse macro call expression
    function parseMacroCall(code: string) {
        state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
        const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
            .expression as ts.CallExpression;

        return { callExpr, arg: callExpr.arguments[1] };
    }

    describe('transformToFunction', () => {
        test('transforms arrow function to function declaration', () => {
            const { arg } = parseMacroVariable('const $$debug = $$ifdef("DEBUG", () => console.log("debug"));');
            const result = transformToFunction('$$debug', arg, state.sourceFile);

            expect(result).toContain('function $$debug()');
            expect(result).toContain('console.log("debug")');
        });

        test('transforms arrow function with parameters', () => {
            const { arg } = parseMacroVariable('const $$log = $$ifdef("DEBUG", (msg: string) => console.log(msg));');
            const result = transformToFunction('$$log', arg, state.sourceFile);

            expect(result).toContain('function $$log(msg: string)');
            expect(result).toContain('console.log(msg)');
        });

        test('transforms arrow function with return type', () => {
            const { arg } = parseMacroVariable('const $$getNum = $$ifdef("DEBUG", (): number => 42);');
            const result = transformToFunction('$$getNum', arg, state.sourceFile);

            expect(result).toContain('function $$getNum(): number');
            expect(result).toContain('return 42');
        });

        test('transforms arrow function with block body', () => {
            const { arg } = parseMacroVariable('const $$test = $$ifdef("DEBUG", () => { return "test"; });');
            const result = transformToFunction('$$test', arg, state.sourceFile);

            expect(result).toContain('function $$test()');
            expect(result).toContain('{ return "test"; }');
        });

        test('transforms function expression to function declaration', () => {
            const { arg } = parseMacroVariable('const $$fn = $$ifdef("DEBUG", function() { return 123; });');
            const result = transformToFunction('$$fn', arg, state.sourceFile);

            expect(result).toContain('function $$fn()');
            expect(result).toContain('{ return 123; }');
        });

        test('adds export prefix when hasExport is true', () => {
            const { arg } = parseMacroVariable('export const $$api = $$ifdef("DEBUG", () => "api");');
            const result = transformToFunction('$$api', arg, state.sourceFile, true);

            expect(result.startsWith('export function')).toBe(true);
        });

        test('transforms non-function node to const assignment', () => {
            const { arg } = parseMacroVariable('const $$url = $$ifdef("DEBUG", "http://localhost");');
            const result = transformToFunction('$$url', arg, state.sourceFile);

            expect(result).toBe('const $$url = "http://localhost";');
        });

        test('transforms non-function node with export', () => {
            const { arg } = parseMacroVariable('export const $$config = $$ifdef("DEBUG", { debug: true });');
            const result = transformToFunction('$$config', arg, state.sourceFile, true);

            expect(result.startsWith('export const')).toBe(true);
            expect(result).toContain('{ debug: true }');
        });

        test('preserves complex parameter types', () => {
            const { arg } = parseMacroVariable('const $$fn = $$ifdef("DEBUG", (a: string, b: number, c?: boolean) => a);');
            const result = transformToFunction('$$fn', arg, state.sourceFile);

            expect(result).toContain('a: string, b: number, c?: boolean');
        });
    });

    describe('transformToIIFE', () => {
        test('wraps arrow function in IIFE', () => {
            const { arg } = parseMacroCall('$$ifdef("DEBUG", () => 42)');
            const result = transformToIIFE(arg, state.sourceFile);

            expect(result).toBe('(() => 42)()');
        });

        test('wraps function expression in IIFE', () => {
            const { arg } = parseMacroCall('$$ifdef("DEBUG", function() { return "hello"; })');
            const result = transformToIIFE(arg, state.sourceFile);

            expect(result).toBe('(function() { return "hello"; })()');
        });

        test('wraps expression in arrow function IIFE', () => {
            const { arg } = parseMacroCall('$$ifdef("DEBUG", 1 + 1)');
            const result = transformToIIFE(arg, state.sourceFile);

            expect(result).toBe('(() => { return 1 + 1; })()');
        });

        test('wraps string literal in IIFE', () => {
            const { arg } = parseMacroCall('$$ifdef("DEBUG", "test value")');
            const result = transformToIIFE(arg, state.sourceFile);

            expect(result).toBe('(() => { return "test value"; })()');
        });

        test('wraps object literal in IIFE', () => {
            const { arg } = parseMacroCall('$$ifdef("DEBUG", { key: "value" })');
            const result = transformToIIFE(arg, state.sourceFile);

            expect(result).toContain('(() => { return');
            expect(result).toContain('{ key: "value" }');
            expect(result.endsWith('})()')).toBe(true);
        });
    });

    describe('astDefineVariable', () => {
        test('transforms ifdef with true definition', () => {
            state.defines = { DEBUG: true };
            const { decl, init } = parseMacroVariable('const $$debug = $$ifdef("DEBUG", () => console.log("debug"));');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$debug()');
            expect(result).not.toBe('');
        });

        test('returns empty string for ifdef with false definition', () => {
            state.defines = { DEBUG: false };
            const { decl, init } = parseMacroVariable('const $$debug = $$ifdef("DEBUG", () => console.log("debug"));');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe('');
        });

        test('transforms ifndef with false definition', () => {
            state.defines = { PRODUCTION: false };
            const { decl, init } = parseMacroVariable('const $$noProd = $$ifndef("PRODUCTION", () => "dev");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$noProd()');
            expect(result).not.toBe('');
        });

        test('returns empty string for ifndef with true definition', () => {
            state.defines = { PRODUCTION: true };
            const { decl, init } = parseMacroVariable('const $$noProd = $$ifndef("PRODUCTION", () => "dev");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe('');
        });

        test('includes export when hasExport is true', () => {
            state.defines = { FEATURE: true };
            const { decl, init } = parseMacroVariable('export const $$feature = $$ifdef("FEATURE", () => true);');
            const result = astDefineVariable(decl, init, true, state);

            expect((<string> result)?.startsWith('export function')).toBe(true);
        });

        test('returns false for non-string literal definition argument', () => {
            state.defines = { DEBUG: true };
            const { decl, init } = parseMacroVariable('const $$bad = $$ifdef(DEBUG, () => {});');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe(false);
        });

        test('handles missing definition as falsy', () => {
            state.defines = {};
            const { decl, init } = parseMacroVariable('const $$missing = $$ifdef("MISSING", () => "value");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe('');
        });

        test('handles non-function callback as const assignment', () => {
            state.defines = { DEBUG: true };
            const { decl, init } = parseMacroVariable('const $$url = $$ifdef("DEBUG", "http://localhost");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe('const $$url = "http://localhost";');
        });

        test('preserves variable name from declaration', () => {
            state.defines = { DEBUG: true };
            const { decl, init } = parseMacroVariable('const $$myCustomName = $$ifdef("DEBUG", () => true);');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('$$myCustomName');
        });

        test('handles truthy non-boolean values', () => {
            state.defines = { VALUE: 1 };
            const { decl, init } = parseMacroVariable('const $$test = $$ifdef("VALUE", () => "yes");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).not.toBe('');
            expect(result).toContain('function $$test()');
        });

        test('handles falsy non-boolean values', () => {
            state.defines = { VALUE: 0 };
            const { decl, init } = parseMacroVariable('const $$test = $$ifdef("VALUE", () => "yes");');
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toBe('');
        });
    });

    describe('astDefineCallExpression', () => {
        test('transforms ifdef with true definition to IIFE', () => {
            state.defines = { DEBUG: true };
            const { callExpr } = parseMacroCall('$$ifdef("DEBUG", () => console.log("debug"));');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toContain('() => console.log("debug")');
            expect(result).toMatch(/^\(/);
            expect(result).toMatch(/\)$/);
        });

        test('returns empty string for ifdef with false definition', () => {
            state.defines = { DEBUG: false };
            const { callExpr } = parseMacroCall('$$ifdef("DEBUG", () => console.log("debug"));');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toBe('');
        });

        test('transforms ifndef with false definition to IIFE', () => {
            state.defines = { PRODUCTION: false };
            const { callExpr } = parseMacroCall('$$ifndef("PRODUCTION", () => "dev mode");');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifndef', state);

            expect(result).not.toBe('');
            expect(result).toContain('() => "dev mode"');
        });

        test('returns empty string for ifndef with true definition', () => {
            state.defines = { PRODUCTION: true };
            const { callExpr } = parseMacroCall('$$ifndef("PRODUCTION", () => "dev mode");');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifndef', state);

            expect(result).toBe('');
        });

        test('returns false for non-string literal definition argument', () => {
            state.defines = { DEBUG: true };
            const { callExpr } = parseMacroCall('$$ifdef(DEBUG, () => {});');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toBe(false);
        });

        test('wraps non-function expression in IIFE', () => {
            state.defines = { DEBUG: true };
            const { callExpr } = parseMacroCall('$$ifdef("DEBUG", "literal value");');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toContain('(() => { return "literal value"; })()');
        });

        test('handles missing definition as falsy for ifdef', () => {
            state.defines = {};
            const { callExpr } = parseMacroCall('$$ifdef("MISSING", () => "value");');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toBe('');
        });

        test('handles missing definition as truthy for ifndef', () => {
            state.defines = {};
            const { callExpr } = parseMacroCall('$$ifndef("MISSING", () => "value");');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifndef', state);

            expect(result).not.toBe('');
            expect(result).toContain('() => "value"');
        });

        test('handles complex expressions', () => {
            state.defines = { DEBUG: true };
            const { callExpr } = parseMacroCall('$$ifdef("DEBUG", 1 + 2 * 3);');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toContain('1 + 2 * 3');
            expect(result).toContain('(() => { return');
        });

        test('handles object literal expressions', () => {
            state.defines = { DEBUG: true };
            const { callExpr } = parseMacroCall('$$ifdef("DEBUG", { debug: true, level: 1 });');
            const result = astDefineCallExpression(callExpr.arguments, '$$ifdef', state);

            expect(result).toContain('{ debug: true, level: 1 }');
        });
    });
});
