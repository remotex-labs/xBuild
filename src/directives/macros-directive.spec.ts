/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LifecycleContextInterface, LifecycleLogsType } from '@interfaces/lifecycle.interface';

/**
 * Imports
 */

import { parseSync } from 'oxc-parser';
import { transformMacros } from './macros.directive';
import { evaluate } from '@directives/inline.directive';

/**
 * Tests
 */

describe('transformMacros', () => {
    const target = '/project/src/feature.ts';

    let logs: LifecycleLogsType;
    let dropped: Set<string>;
    let context: LifecycleContextInterface;
    let evaluateMock: any;

    /**
     * Runs the transform over a source as the build would, parse and all.
     */

    async function transform(code: string, file = target): Promise<string> {
        return await transformMacros(parseSync(file, code, { sourceType: 'module' }), file, code, context);
    }

    beforeEach(() => {
        xJet.restoreAllMocks();

        logs = { debug: [], info: [], warning: [], error: [] };
        dropped = new Set<string>();
        context = <any> { logs, stage: { dropped }, options: { define: {} }, overrides: {} };
        evaluateMock = xJet.mock(evaluate).mockResolvedValue('4');
    });

    describe('the sources it passes over', () => {
        test('should leave an empty source alone', async () => {
            expect(await transform('')).toBe('');
        });

        test('should leave a dependency alone', async () => {
            const code = 'export const $$dev = $$ifdef(\'DEV\', () => 1);';

            expect(await transform(code, '/project/node_modules/pkg/index.js')).toBe(code);
        });

        test('should leave a source carrying no macro and no dropped name alone', async () => {
            const code = 'export const answer = 42;';

            expect(await transform(code)).toBe(code);
        });

        test('should leave a name that only looks like a macro alone', async () => {
            const code = 'const $$total = 1 + 1;';

            expect(await transform(code)).toBe(code);
        });

        test('should pass over a source carrying a dropped name but no macro', async () => {
            dropped.add('$$dev');

            expect(await transform('run($$dev);')).toBe('run(undefined);');
        });
    });

    describe('the declarations it expands', () => {
        test('should declare a function for a macro whose flag is set', async () => {
            context.options.define = { DEV: 'true' };
            const code = 'export const $$dev = $$ifdef(\'DEV\', () => 1);';

            expect(await transform(code)).toBe('export function $$dev() { return 1; }');
        });

        test('should drop a macro whose flag is not set', async () => {
            const code = 'const before = 1;\nexport const $$dev = $$ifdef(\'DEV\', () => 1);\nconst after = 2;';

            expect(await transform(code)).toBe('const before = 1;\n\nconst after = 2;');
        });

        test('should read an ifndef macro the other way round', async () => {
            const code = 'const $$fallback = $$ifndef(\'DEV\', () => 1);';

            expect(await transform(code)).toBe('function $$fallback() { return 1; }');
            context.options.define = { DEV: 'true' };
            expect(await transform(code)).toBe('');
        });

        test('should keep whatever the call carries', async () => {
            context.options.define = { DEV: 'true' };
            const code = 'const $$sum = $$ifdef(\'DEV\', (a) => a + 1)(41);';

            expect(await transform(code)).toBe('const $$sum = ((a) => a + 1)(41);');
        });

        test('should read a macro through the assertion written over it', async () => {
            context.options.define = { DEV: 'true' };
            const code = 'const $$dev = $$ifdef(\'DEV\', () => 1) as number;';

            expect(await transform(code)).toBe('function $$dev() { return 1; }');
        });

        test('should name the macros it dropped for the stages after it', async () => {
            await transform('export const $$dev = $$ifdef(\'DEV\', () => 1);');

            expect([ ...dropped ]).toEqual([ '$$dev' ]);
        });

        test('should name none of the macros it kept', async () => {
            context.options.define = { DEV: 'true' };
            await transform('export const $$dev = $$ifdef(\'DEV\', () => 1);');

            expect([ ...dropped ]).toEqual([]);
        });

        test('should stand undefined in for a macro it dropped in the same source', async () => {
            const code = 'export const $$dev = $$ifdef(\'DEV\', () => 1);\nrun($$dev);';

            expect(await transform(code)).toBe('\nrun(undefined);');
        });
    });

    describe('the expressions it expands', () => {
        test('should inline the body of a statement whose flag is set', async () => {
            context.options.define = { DEV: 'true' };

            expect(await transform('$$ifdef(\'DEV\', () => { start(); });')).toBe('start();');
        });

        test('should drop a statement whose flag is not set', async () => {
            expect(await transform('$$ifdef(\'DEV\', () => { start(); });')).toBe('');
        });

        test('should call the payload of an expression whose flag is set', async () => {
            context.options.define = { DEV: 'true' };

            expect(await transform('run($$ifdef(\'DEV\', () => 1));')).toBe('run((() => 1)());');
        });

        test('should stand undefined in for an expression whose flag is not set', async () => {
            expect(await transform('run($$ifdef(\'DEV\', () => 1));')).toBe('run(undefined);');
        });

        test('should keep the call an expression macro carries', async () => {
            context.options.define = { DEV: 'true' };

            expect(await transform('run($$ifdef(\'DEV\', (a) => a)(1));')).toBe('run(((a) => a)(1));');
        });

        test('should read an expression macro through the assertion written over it', async () => {
            context.options.define = { DEV: 'true' };

            expect(await transform('run($$ifdef(\'DEV\', () => 1) as number);')).toBe('run((() => 1)());');
        });

        test('should pass over a call that names no macro', async () => {
            const code = 'run($$other(\'DEV\', () => 1));';

            expect(await transform(code)).toBe(code);
        });

        test('should pass over a macro call the parser cannot read as one', async () => {
            const code = 'run($$ifdef(flag, () => 1));';

            expect(await transform(code)).toBe(code);
        });
    });

    describe('the inline calls it runs', () => {
        test('should bind what the thunk produced', async () => {
            expect(await transform('export const $$stamp = $$inline(() => 2 + 2);'))
                .toBe('export const $$stamp = 4;');
        });

        test('should run the thunk against the source it sits in', async () => {
            const code = 'export const $$stamp = $$inline(() => 2 + 2);';
            await transform(code);

            expect(evaluateMock).toHaveBeenCalledTimes(1);
            expect(evaluateMock.mock.calls[0][0]).toEqual(expect.objectContaining({ code, target }));
            expect(evaluateMock.mock.calls[0][1].callee.name).toBe('$$inline');
        });

        test('should stand what the thunk produced in for an expression', async () => {
            expect(await transform('run($$inline(() => 2 + 2));')).toBe('run(4);');
        });

        test('should drop a statement that only runs a thunk', async () => {
            expect(await transform('$$inline(() => log());')).toBe('');
        });

        test('should never drop an inline macro for a flag', async () => {
            await transform('export const $$stamp = $$inline(() => 2 + 2);');

            expect([ ...dropped ]).toEqual([]);
        });

        test('should stand undefined in for a thunk that failed', async () => {
            evaluateMock.mockRejectedValue(new Error('fetch is not defined'));

            expect(await transform('export const $$stamp = $$inline(() => load());'))
                .toBe('export const $$stamp = undefined;');
        });

        test('should report the thunk that failed', async () => {
            const error = new Error('fetch is not defined');
            evaluateMock.mockRejectedValue(error);

            await transform('const a = 1;\nexport const $$stamp = $$inline(() => load());');

            expect(logs.error).toEqual([
                {
                    detail: error,
                    id: 'macro-inline',
                    text: '$$inline failed: fetch is not defined',
                    location: { file: target, line: 2, column: 23 }
                }
            ]);
        });
    });

    describe('the imports and exports it prunes', () => {
        beforeEach(() => {
            dropped.add('$$dev');
        });

        test('should drop the specifier naming a dropped macro', async () => {
            expect(await transform('import { keep, $$dev } from \'./x\';')).toBe('import { keep } from \'./x\';');
        });

        test('should keep the side effect when every specifier goes', async () => {
            expect(await transform('import { $$dev } from \'./x\';')).toBe('import \'./x\';');
        });

        test('should keep a default import beside the specifiers it kept', async () => {
            expect(await transform('import def, { $$dev, keep } from \'./x\';'))
                .toBe('import def, { keep } from \'./x\';');
        });

        test('should keep a default import on its own', async () => {
            expect(await transform('import def, { $$dev } from \'./x\';')).toBe('import def from \'./x\';');
        });

        test('should leave an import naming no dropped macro alone', async () => {
            const code = 'import def, { keep } from \'./x\';';

            expect(await transform(code)).toBe(code);
        });

        test('should drop the export specifier naming a dropped macro', async () => {
            expect(await transform('export { keep, $$dev };')).toBe('export { keep };');
        });

        test('should drop an export left with nothing', async () => {
            expect(await transform('export { $$dev };')).toBe('');
        });

        test('should read the local name of a renamed export', async () => {
            expect(await transform('export { $$dev as thing };')).toBe('');
        });

        test('should leave a re-export alone', async () => {
            const code = 'export { $$dev } from \'./x\';';

            expect(await transform(code)).toBe(code);
        });

        test('should leave an export naming no dropped macro alone', async () => {
            const code = 'export { keep };';

            expect(await transform(code)).toBe(code);
        });
    });

    describe('the references it rewrites', () => {
        beforeEach(() => {
            dropped.add('$$dev');
        });

        test('should drop a statement that only calls a dropped macro', async () => {
            expect(await transform('$$dev();')).toBe('');
        });

        test('should stand undefined in for a call to a dropped macro', async () => {
            expect(await transform('const x = $$dev();')).toBe('const x = undefined;');
        });

        test('should leave the property a dropped name spells alone', async () => {
            const code = 'const o = { $$dev: 1 };\nread(o.$$dev);';

            expect(await transform(code)).toBe(code);
        });

        test('should rewrite a dropped name a computed key reads', async () => {
            expect(await transform('const o = { [$$dev]: 1 };')).toBe('const o = { [undefined]: 1 };');
        });

        test('should rewrite a dropped name a computed member reads', async () => {
            expect(await transform('read(o[$$dev]);')).toBe('read(o[undefined]);');
        });
    });

    describe('the messages it reports', () => {
        test('should warn about a macro not carrying the prefix', async () => {
            await transform('const a = 1;\nconst dev = $$ifdef(\'DEV\', () => 1);');

            expect(logs.warning).toEqual([
                {
                    id: 'macro-prefix',
                    text: 'Macro \'dev\' does not start with the \'$$\' prefix to avoid conflicts',
                    location: { file: target, line: 2, column: 6 }
                }
            ]);
        });

        test('should leave a macro carrying the prefix unreported', async () => {
            await transform('const $$dev = $$ifdef(\'DEV\', () => 1);');

            expect(logs.warning).toEqual([]);
        });

        test('should file a warning under the level an override names', async () => {
            context.overrides = { 'macro-prefix': 'error' };
            await transform('const dev = $$ifdef(\'DEV\', () => 1);');

            expect(logs.warning).toEqual([]);
            expect(logs.error).toHaveLength(1);
        });

        test('should drop a warning an override silenced', async () => {
            context.overrides = { 'macro-prefix': 'silent' };
            await transform('const dev = $$ifdef(\'DEV\', () => 1);');

            expect(logs.warning).toEqual([]);
        });
    });
});
