/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MacroTargetInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import { parseSync } from 'oxc-parser';
import { defineDeclaration, defineExpression, isDefined } from './define.directive';

/**
 * Reads the macro call a fixture declares, paired with whatever trails it.
 */

function macroTarget(code: string): MacroTargetInterface {
    const { program } = parseSync('macro.ts', code, { sourceType: 'module' });
    const statement = <any> program.body[0];
    const node = statement.type === 'ExpressionStatement'
        ? statement.expression
        : (statement.declaration ?? statement).declarations[0].init;

    if (node.callee.type !== 'CallExpression') return { call: node, suffix: '' };

    return { call: node.callee, suffix: code.slice(node.callee.end, node.end) };
}

/**
 * Tests
 */

describe('isDefined', () => {
    test('should read a flag the table names as set', () => {
        expect(isDefined({ DEV: 'true' }, 'DEV')).toBe(true);
        expect(isDefined({ DEV: '"staging"' }, 'DEV')).toBe(true);
    });

    test('should read a flag the table does not name as not set', () => {
        expect(isDefined({}, 'DEV')).toBe(false);
        expect(isDefined({ PROD: 'true' }, 'DEV')).toBe(false);
    });

    test('should read the texts standing for nothing as not set', () => {
        expect(isDefined({ DEV: 'false' }, 'DEV')).toBe(false);
        expect(isDefined({ DEV: 'null' }, 'DEV')).toBe(false);
        expect(isDefined({ DEV: 'undefined' }, 'DEV')).toBe(false);
    });

    test('should read every other text as setting the flag', () => {
        expect(isDefined({ DEV: '0' }, 'DEV')).toBe(true);
        expect(isDefined({ DEV: '' }, 'DEV')).toBe(true);
        expect(isDefined({ DEV: '""' }, 'DEV')).toBe(true);
        expect(isDefined({ DEV: 'NaN' }, 'DEV')).toBe(true);
    });

    test('should read a text past the whitespace around it', () => {
        expect(isDefined({ DEV: '  false  ' }, 'DEV')).toBe(false);
        expect(isDefined({ DEV: '\n\tnull\n' }, 'DEV')).toBe(false);
        expect(isDefined({ DEV: '  true  ' }, 'DEV')).toBe(true);
    });
});

describe('defineDeclaration', () => {
    test('should bind a payload that is not a function as it was written', () => {
        const code = 'const $$flag = $$ifdef(\'DEV\', 42);';

        expect(defineDeclaration(code, '$$flag', macroTarget(code), '')).toBe('const $$flag = 42;');
    });

    test('should carry the prefix it was given', () => {
        const code = 'export const $$flag = $$ifdef(\'DEV\', 42);';

        expect(defineDeclaration(code, '$$flag', macroTarget(code), 'export ')).toBe('export const $$flag = 42;');
    });

    test('should bind a called payload as the expression it was written as', () => {
        const code = 'const $$flag = $$ifdef(\'DEV\', () => 1)();';

        expect(defineDeclaration(code, '$$flag', macroTarget(code), '')).toBe('const $$flag = (() => 1)();');
    });

    test('should keep the arguments the call carries', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', (a) => a + 1)(41);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), '')).toBe('const $$sum = ((a) => a + 1)(41);');
    });

    test('should call a payload that is not a function the way the source wrote it', () => {
        const code = 'const $$run = $$ifdef(\'DEV\', handler)(1);';

        expect(defineDeclaration(code, '$$run', macroTarget(code), '')).toBe('const $$run = handler(1);');
    });

    test('should turn an arrow returning an expression into a function of the given name', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', () => 1 + 1);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), '')).toBe('function $$sum() { return 1 + 1; }');
    });

    test('should keep the block of an arrow that carries one', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', () => { const a = 1; return a; });';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), ''))
            .toBe('function $$sum() { const a = 1; return a; }');
    });

    test('should rename a function expression rather than nest it', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', function inner(a) { return a; });';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), '')).toBe('function $$sum(a) { return a; }');
    });

    test('should carry the parameters the payload declares', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', (a: number, b = 2) => a + b);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), ''))
            .toBe('function $$sum(a: number, b = 2) { return a + b; }');
    });

    test('should carry the return type the payload declares', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', (): number => 1);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), '')).toBe('function $$sum(): number { return 1; }');
    });

    test('should keep an asynchronous payload asynchronous', () => {
        const code = 'const $$sum = $$ifdef(\'DEV\', async () => 1);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), '')).toBe('async function $$sum() { return 1; }');
    });

    test('should export the function it declares when the prefix says to', () => {
        const code = 'export const $$sum = $$ifdef(\'DEV\', () => 1);';

        expect(defineDeclaration(code, '$$sum', macroTarget(code), 'export '))
            .toBe('export function $$sum() { return 1; }');
    });
});

describe('defineExpression', () => {
    test('should stand a payload that is not a function in for the call', () => {
        const code = '$$ifdef(\'DEV\', 42);';

        expect(defineExpression(code, macroTarget(code), false)).toBe('42');
        expect(defineExpression(code, macroTarget(code), true)).toBe('42;');
    });

    test('should keep the call a payload that is not a function is given', () => {
        const code = '$$ifdef(\'DEV\', handler)(1);';

        expect(defineExpression(code, macroTarget(code), true)).toBe('handler(1);');
    });

    test('should call a payload standing in an expression', () => {
        const code = 'const value = $$ifdef(\'DEV\', () => 1);';

        expect(defineExpression(code, macroTarget(code), false)).toBe('(() => 1)()');
    });

    test('should keep the call the source wrote rather than adding one', () => {
        const code = '$$ifdef(\'DEV\', (a) => a)(1);';

        expect(defineExpression(code, macroTarget(code), true)).toBe('((a) => a)(1);');
    });

    test('should inline the block of a statement payload rather than call it', () => {
        const code = '$$ifdef(\'DEV\', () => { start(); stop(); });';

        expect(defineExpression(code, macroTarget(code), true)).toBe('start(); stop();');
    });

    test('should inline the expression a statement payload returns', () => {
        const code = '$$ifdef(\'DEV\', () => start());';

        expect(defineExpression(code, macroTarget(code), true)).toBe('start();');
    });

    test('should inline the block of a function expression the same way', () => {
        const code = '$$ifdef(\'DEV\', function () { start(); });';

        expect(defineExpression(code, macroTarget(code), true)).toBe('start();');
    });
});
