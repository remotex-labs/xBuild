/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { MacroCallType } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { parseSync } from 'oxc-parser';
import { evaluate } from './inline.directive';
import { inject } from '@remotex-labs/xinject';
import { sandboxExecute } from '@services/vm.service';
import { FrameworkService } from '@services/framework.service';
import { buildFromString } from '@services/transpiler.service';

/**
 * Reads the macro call a fixture declares.
 */

function macroCall(code: string): MacroCallType {
    const { program } = parseSync('macro.ts', code, { sourceType: 'module' });

    return (<any> program.body[0]).declarations[0].init;
}

/**
 * The values a thunk can produce, each paired with the source text it is rendered as.
 */

const RENDERED: Array<{ rendered: string, value: unknown, text: string }> = [
    { rendered: 'a number', value: 4, text: '4' },
    { rendered: 'a zero', value: 0, text: '0' },
    { rendered: 'a boolean', value: false, text: 'false' },
    { rendered: 'a string', value: 'eu', text: '"eu"' },
    { rendered: 'an object', value: { region: 'eu' }, text: '{"region":"eu"}' },
    { rendered: 'an array', value: [ 1, 2 ], text: '[1,2]' },
    { rendered: 'a bigint', value: 10n, text: '"10n"' },
    { rendered: 'a map', value: new Map([[ 'a', 1 ]]), text: '{}' },
    { rendered: 'nothing', value: undefined, text: 'undefined' },
    { rendered: 'null', value: null, text: 'undefined' },
    { rendered: 'a symbol', value: Symbol('flag'), text: 'undefined' }
];

/**
 * Tests
 */

describe('evaluate', () => {
    const code = 'const $$stamp = $$inline(() => 2 + 2);';
    const target = '/project/src/feature.ts';
    const inlineTarget = `${ target }.inline`;
    const sourceMap = '{"version":3,"file":"feature.js","sources":["feature.ts"],"names":[],"mappings":"AAAA"}';

    let state: any;
    let call: MacroCallType;
    let buildMock: any;
    let sandboxMock: any;
    let requireMock: any;
    let sourceMapMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(readFileSync).mockReturnValue(<any> sourceMap);

        call = macroCall(code);
        state = { code, target };

        requireMock = xJet.mock(createRequire).mockReturnValue(<any> 'require-of-feature');
        sandboxMock = xJet.mock(sandboxExecute).mockResolvedValue(4);
        sourceMapMock = xJet.spyOn(inject(FrameworkService), 'addSourceMap').mockReturnValue(undefined);
        buildMock = xJet.mock(buildFromString).mockResolvedValue(<any> {
            outputFiles: [{ text: 'map' }, { text: 'built' }]
        });
    });

    test('should build the thunk as a module that calls it', async () => {
        await evaluate(state, call);

        expect(buildMock).toHaveBeenCalledWith('module.exports = (() => 2 + 2)();', inlineTarget, {
            format: 'cjs',
            platform: 'node',
            packages: 'external'
        });
    });

    test('should take the thunk from the source as it was written', async () => {
        const source = 'const $$stamp = $$inline(async () => {\n    return await load();\n});';
        await evaluate(<any> { code: source, target }, macroCall(source));

        expect(buildMock).toHaveBeenCalledWith(
            'module.exports = (async () => {\n    return await load();\n})();', inlineTarget, expect.anything()
        );
    });

    test('should run what was built rather than the map beside it', async () => {
        await evaluate(state, call);

        expect(sandboxMock).toHaveBeenCalledWith(
            'built',
            { module: { exports: undefined }, require: 'require-of-feature' },
            { filename: inlineTarget }
        );
    });

    test('should keep the map beside what was built under the name the run carries', async () => {
        await evaluate(state, call);

        expect(sourceMapMock).toHaveBeenCalledWith(inlineTarget, 'map');
    });

    test('should register the map before the run so a throw can be mapped', async () => {
        sandboxMock.mockImplementation(async () => {
            expect(sourceMapMock).toHaveBeenCalledWith(inlineTarget, 'map');

            return 4;
        });

        await expect(evaluate(state, call)).resolves.toBe('4');
        expect(sandboxMock).toHaveBeenCalled();
    });

    test('should bind require to the file the call sits in rather than to the name the run carries', async () => {
        await evaluate(state, call);

        expect(requireMock).toHaveBeenCalledWith(target);
    });

    for (const { rendered, value, text } of RENDERED) {
        test(`should render ${ rendered }`, async () => {
            sandboxMock.mockResolvedValue(value);

            await expect(evaluate(state, call)).resolves.toBe(text);
        });
    }

    test('should render a function as its own source', async () => {
        const value = function stamp(): number {
            return 4;
        };

        sandboxMock.mockResolvedValue(value);

        await expect(evaluate(state, call)).resolves.toBe(value.toString());
    });

    test('should read what the module exported when the run returns nothing', async () => {
        sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
            sandbox.module.exports = { region: 'eu' };
        });

        await expect(evaluate(state, call)).resolves.toBe('{"region":"eu"}');
    });

    test('should keep what the run returned over what the module exported', async () => {
        sandboxMock.mockImplementation(async (_: string, sandbox: any) => {
            sandbox.module.exports = 'exported';

            return 'returned';
        });

        await expect(evaluate(state, call)).resolves.toBe('"returned"');
    });

    test('should reject with what the build threw', async () => {
        buildMock.mockRejectedValue(new Error('Expected ")" but found ";"'));

        await expect(evaluate(state, call)).rejects.toThrow('Expected ")" but found ";"');
        expect(sandboxMock).not.toHaveBeenCalled();
        expect(sourceMapMock).not.toHaveBeenCalled();
    });

    test('should reject with what the thunk threw as it ran', async () => {
        sandboxMock.mockRejectedValue(new Error('fetch is not defined'));

        await expect(evaluate(state, call)).rejects.toThrow('fetch is not defined');
    });
});
