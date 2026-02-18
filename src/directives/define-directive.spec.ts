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
 * Build a minimal StateInterface for each test.
 * Cast through `unknown` so the test file doesn't need the full internal type.
 */

function makeState(defines: Record<string, unknown> = {}): StateInterface {
    return {
        sourceFile: ts.createSourceFile('test.ts', '', ts.ScriptTarget.ESNext),
        errors: [],
        warnings: [],
        defines,
        contents: '',
        stage: {
            defineMetadata: {
                disabledMacroNames: new Set<string>(),
                filesWithMacros: new Set<string>()
            }
        }
    } as unknown as StateInterface;
}

/**
 * Parse a variable-declaration statement and return its parts.
 */

function parseMacroVariable(state: StateInterface, code: string) {
    state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
    const varStmt = state.sourceFile.statements[0] as ts.VariableStatement;
    const hasExport = varStmt.modifiers?.some(
        m => m.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false;
    const decl = varStmt.declarationList.declarations[0];
    const init = decl.initializer as ts.CallExpression;
    const callbackArg = init.arguments[1];

    return { varStmt, decl, init, callbackArg, hasExport };
}

/**
 * Parse a bare call-expression statement and return the call node.
 */

function parseMacroCall(state: StateInterface, code: string) {
    state.sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.ESNext);
    const callExpr = (state.sourceFile.statements[0] as ts.ExpressionStatement)
        .expression as ts.CallExpression;

    return { callExpr, callbackArg: callExpr.arguments[1] };
}

describe('define.directive', () => {
    describe('transformToFunction', () => {
        let state: StateInterface;
        beforeEach(() => { state = makeState(); });

        test('arrow function – expression body wraps in block with return', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => 42);');
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile);

            expect(result).toBe('function $$fn() { return 42; }');
        });

        test('arrow function – block body is kept as-is', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => { return 42; });');
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile);

            expect(result).toBe('function $$fn() { return 42; }');
        });

        test('arrow function – typed parameter list is preserved', () => {
            const { callbackArg } = parseMacroCall(
                state,
                '$$ifdef("D", (a: string, b: number, c?: boolean) => a);'
            );
            const result = transformToFunction('$$log', callbackArg, state.sourceFile);

            expect(result).toContain('function $$log(a: string, b: number, c?: boolean)');
        });

        test('arrow function – return type annotation is preserved', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", (): number => 0);');
            const result = transformToFunction('$$num', callbackArg, state.sourceFile);

            expect(result).toContain('$$num(): number');
        });

        test('arrow function – complex body with multiple statements', () => {
            const code = '$$ifdef("D", () => { const x = 1; return x + 2; });';
            const { callbackArg } = parseMacroCall(state, code);
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile);

            expect(result).toContain('const x = 1');
            expect(result).toContain('return x + 2');
        });

        test('function expression – converts to named declaration', () => {
            const { callbackArg } = parseMacroCall(
                state,
                '$$ifdef("D", function() { return 123; });'
            );
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile);

            expect(result).toBe('function $$fn() { return 123; }');
        });

        test('function expression – typed parameters are preserved', () => {
            const { callbackArg } = parseMacroCall(
                state,
                '$$ifdef("D", function(x: number): string { return String(x); });'
            );
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile);

            expect(result).toContain('(x: number): string');
        });

        test('hasExport=false – emits "function " prefix', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => 1);');
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile, false);

            expect(result.startsWith('function ')).toBe(true);
            expect(result.startsWith('export ')).toBe(false);
        });

        test('hasExport=true – emits "export function " prefix', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => 1);');
            const result = transformToFunction('$$fn', callbackArg, state.sourceFile, true);

            expect(result.startsWith('export function ')).toBe(true);
        });

        // --- non-function fallback -----------------------------------------

        test('string literal – falls back to const assignment', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", "http://localhost");');
            const result = transformToFunction('$$url', callbackArg, state.sourceFile);

            expect(result).toBe('const $$url = "http://localhost";');
        });

        test('number literal – falls back to const assignment', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", 99);');
            const result = transformToFunction('$$n', callbackArg, state.sourceFile);

            expect(result).toBe('const $$n = 99;');
        });

        test('object literal – falls back to const assignment', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", { a: 1 });');
            const result = transformToFunction('$$cfg', callbackArg, state.sourceFile);

            expect(result).toContain('const $$cfg =');
            expect(result).toContain('{ a: 1 }');
        });

        test('non-function with hasExport=true – emits "export const"', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", "val");');
            const result = transformToFunction('$$x', callbackArg, state.sourceFile, true);

            expect(result.startsWith('export const ')).toBe(true);
        });
    });

    describe('transformToIIFE', () => {
        let state: StateInterface;
        beforeEach(() => { state = makeState(); });

        test('arrow function – wraps in IIFE with default suffix', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => 42);');
            expect(transformToIIFE(callbackArg, state.sourceFile)).toBe('(() => 42)();');
        });

        test('arrow function with block body – wraps in IIFE', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => { return 1; });');
            expect(transformToIIFE(callbackArg, state.sourceFile)).toBe('(() => { return 1; })();');
        });

        test('function expression – wraps in IIFE', () => {
            const { callbackArg } = parseMacroCall(
                state,
                '$$ifdef("D", function() { return "hi"; });'
            );
            expect(transformToIIFE(callbackArg, state.sourceFile))
                .toBe('(function() { return "hi"; })();');
        });

        test('arrow function – prefix is applied', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => fetch("/"));');
            const result = transformToIIFE(callbackArg, state.sourceFile, 'await ', '();');

            expect(result.startsWith('await ')).toBe(true);
        });

        test('string literal – wrapped in arrow IIFE', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", "value");');
            expect(transformToIIFE(callbackArg, state.sourceFile))
                .toBe('(() => { return "value"; })();');
        });

        test('number literal – wrapped in arrow IIFE', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", 7);');
            expect(transformToIIFE(callbackArg, state.sourceFile))
                .toBe('(() => { return 7; })();');
        });

        test('binary expression – wrapped in arrow IIFE', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", 1 + 2 * 3);');
            expect(transformToIIFE(callbackArg, state.sourceFile))
                .toBe('(() => { return 1 + 2 * 3; })();');
        });

        test('non-function with prefix but no suffix – returns prefixed text directly', () => {
            // When prefix is set, the non-function branch returns `prefix + nodeText`
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", "raw");');
            const result = transformToIIFE(callbackArg, state.sourceFile, 'const x = ', '');

            expect(result).toBe('const x = "raw"');
        });

        test('custom suffix is appended to IIFE', () => {
            const { callbackArg } = parseMacroCall(state, '$$ifdef("D", () => p);');
            const result = transformToIIFE(callbackArg, state.sourceFile, '', '.catch(e => e)');

            expect(result.endsWith('.catch(e => e)')).toBe(true);
        });
    });

    describe('astDefineVariable', () => {
        let state: StateInterface;
        beforeEach(() => { state = makeState(); });

        test('$$ifdef, define=true → transforms to function', () => {
            state = makeState({ DEBUG: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$debug = $$ifdef("DEBUG", () => "on");'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$debug()');
            expect(result).toContain('return "on"');
        });

        test('$$ifdef, define=false → returns empty string', () => {
            state = makeState({ DEBUG: false });
            const { decl, init } = parseMacroVariable(
                state, 'const $$debug = $$ifdef("DEBUG", () => "on");'
            );
            expect(astDefineVariable(decl, init, false, state)).toBe('undefined');
        });

        test('$$ifdef, define missing → returns empty string', () => {
            state = makeState({});
            const { decl, init } = parseMacroVariable(
                state, 'const $$x = $$ifdef("MISSING", () => 1);'
            );
            expect(astDefineVariable(decl, init, false, state)).toBe('undefined');
        });

        test('$$ifdef, define=truthy number (1) → transforms', () => {
            state = makeState({ FLAG: 1 });
            const { decl, init } = parseMacroVariable(
                state, 'const $$f = $$ifdef("FLAG", () => true);'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$f()');
        });

        test('$$ifdef, define=falsy number (0) → returns empty string', () => {
            state = makeState({ FLAG: 0 });
            const { decl, init } = parseMacroVariable(
                state, 'const $$f = $$ifdef("FLAG", () => true);'
            );
            expect(astDefineVariable(decl, init, false, state)).toBe('undefined');
        });

        test('$$ifndef, define=false → transforms to function', () => {
            state = makeState({ PRODUCTION: false });
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("PRODUCTION", () => "dev");'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$dev()');
        });

        test('$$ifndef, define=true → returns empty string', () => {
            state = makeState({ PRODUCTION: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("PRODUCTION", () => "dev");'
            );
            expect(astDefineVariable(decl, init, false, state)).toBe('undefined');
        });

        test('$$ifndef, define missing → transforms (missing === not defined)', () => {
            state = makeState({});
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("MISSING", () => "yes");'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('function $$dev()');
        });

        test('hasExport=true → emits "export function"', () => {
            state = makeState({ F: true });
            const { decl, init } = parseMacroVariable(
                state, 'export const $$feat = $$ifdef("F", () => 1);'
            );
            const result = astDefineVariable(decl, init, true, state);

            expect((result as string).startsWith('export function')).toBe(true);
        });

        test('hasExport=false → does not emit "export"', () => {
            state = makeState({ F: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$feat = $$ifdef("F", () => 1);'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result as string).not.toMatch(/^export/);
        });

        test('non-string-literal first arg → returns false', () => {
            state = makeState({ DEBUG: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$bad = $$ifdef(DEBUG, () => {});'
            );
            expect(astDefineVariable(decl, init, false, state)).toBe(false);
        });

        test('string literal callback → const assignment', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$url = $$ifdef("D", "http://localhost");'
            );
            expect(astDefineVariable(decl, init, false, state))
                .toBe('const $$url = "http://localhost";');
        });

        test('variable name from declaration is used in output', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$myCustomName = $$ifdef("D", () => true);'
            );
            expect(astDefineVariable(decl, init, false, state))
                .toContain('$$myCustomName');
        });

        test('arrow function with typed params and return type', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state,
                'const $$fn = $$ifdef("D", (x: number): string => String(x));'
            );
            const result = astDefineVariable(decl, init, false, state);

            expect(result).toContain('(x: number): string');
        });
    });

    describe('astDefineCallExpression', () => {
        let state: StateInterface;
        beforeEach(() => { state = makeState(); });

        test('$$ifdef, define=true → IIFE wrapped in const assignment', () => {
            state = makeState({ DEBUG: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$msg = $$ifdef("DEBUG", () => "on");'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result).toContain('const $$msg =');
            expect(result).toContain('() => "on"');
        });

        test('$$ifdef, define=false → returns empty string', () => {
            state = makeState({ DEBUG: false });
            const { decl, init } = parseMacroVariable(
                state, 'const $$msg = $$ifdef("DEBUG", () => "on");'
            );
            expect(astDefineCallExpression(init, state, decl, false)).toBe('');
        });

        test('$$ifdef, define missing → returns empty string', () => {
            state = makeState({});
            const { decl, init } = parseMacroVariable(
                state, 'const $$msg = $$ifdef("MISSING", () => "on");'
            );
            expect(astDefineCallExpression(init, state, decl, false)).toBe('');
        });

        test('$$ifndef, define=false → IIFE wrapped in const assignment', () => {
            state = makeState({ PRODUCTION: false });
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("PRODUCTION", () => "dev");'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result).toContain('const $$dev =');
            expect(result).toContain('() => "dev"');
        });

        test('$$ifndef, define=true → returns empty string', () => {
            state = makeState({ PRODUCTION: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("PRODUCTION", () => "dev");'
            );
            expect(astDefineCallExpression(init, state, decl, false)).toBe('');
        });

        test('$$ifndef, define missing → IIFE (missing is falsy)', () => {
            state = makeState({});
            const { decl, init } = parseMacroVariable(
                state, 'const $$dev = $$ifndef("MISSING", () => "yes");'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result).not.toBe('undefined');
            expect(result).toContain('() => "yes"');
        });

        test('hasExport=true → emits "export const"', () => {
            state = makeState({ F: true });
            const { decl, init } = parseMacroVariable(
                state, 'export const $$cfg = $$ifdef("F", () => devCfg);'
            );
            const result = astDefineCallExpression(init, state, decl, true);

            expect((result as string).startsWith('export const $$cfg')).toBe(true);
        });

        test('hasExport=false → plain "const"', () => {
            state = makeState({ F: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$cfg = $$ifdef("F", () => devCfg);'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect((result as string).startsWith('const $$cfg')).toBe(true);
            expect(result as string).not.toMatch(/^export/);
        });

        test('non-string-literal first arg → returns false', () => {
            state = makeState({ DEBUG: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$bad = $$ifdef(DEBUG, () => {});'
            );
            expect(astDefineCallExpression(init, state, decl, false)).toBe(false);
        });

        test('outerSuffix is appended after IIFE invocation', () => {
            state = makeState({ F: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$p = $$ifdef("F", () => fetchData());'
            );
            const result = astDefineCallExpression(init, state, decl, false, '.then(process)');

            expect((result as string).endsWith('.then(process)')).toBe(true);
        });

        test('string literal callback → IIFE-wrapped const', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$url = $$ifdef("D", "http://localhost");'
            );
            const result = astDefineCallExpression(init, state, decl, false);
            expect(result).toContain('"http://localhost"');
        });

        test('complex expression callback wraps in arrow IIFE', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$val = $$ifdef("D", 1 + 2 * 3);'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result).toContain('1 + 2 * 3');
        });

        test('object literal callback – value is in output', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$cfg = $$ifdef("D", { debug: true, level: 1 });'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result).toContain('{ debug: true, level: 1 }');
        });

        test('variable name appears in output', () => {
            state = makeState({ D: true });
            const { decl, init } = parseMacroVariable(
                state, 'const $$mySpecialVar = $$ifdef("D", () => 1);'
            );
            const result = astDefineCallExpression(init, state, decl, false);

            expect(result as string).toContain('$$mySpecialVar');
        });
    });
});
