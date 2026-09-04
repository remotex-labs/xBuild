/**
 * Imports
 */

import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { analyzeMacros } from './analyze.directive';

/**
 * Tests
 */

describe('analyzeMacros', () => {
    const cache = inject(FilesModel);
    const sources: Record<string, string | undefined> = {};

    let touchMock: any;

    beforeEach(() => {
        xJet.restoreAllMocks();
        for (const key of Object.keys(sources)) delete sources[key];

        touchMock = xJet.spyOn(cache, 'touch').mockImplementation((path: string) => <any> {
            version: 1,
            snapshot: sources[path] === undefined ? undefined : { text: sources[path] }
        });
    });

    test('should return an empty set when there are no files', () => {
        expect([ ...analyzeMacros([], { DEV: 'true' }) ]).toEqual([]);
        expect(touchMock).not.toHaveBeenCalled();
    });

    test('should skip a file that carries no snapshot', () => {
        expect([ ...analyzeMacros([ 'missing.ts' ], {}) ]).toEqual([]);
        expect(touchMock).toHaveBeenCalledWith('missing.ts');
    });

    test('should skip a file that never mentions a macro', () => {
        sources['a.ts'] = 'export const answer = 42;';

        expect([ ...analyzeMacros([ 'a.ts' ], {}) ]).toEqual([]);
    });

    test('should drop an ifdef binding when the flag is not defined', () => {
        sources['a.ts'] = 'export const debug = $$ifdef(\'DEV\');';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([ 'debug' ]);
    });

    test('should keep an ifdef binding when the flag is defined', () => {
        sources['a.ts'] = 'export const debug = $$ifdef(\'DEV\');';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'true' }) ]).toEqual([]);
    });

    test('should drop an ifndef binding when the flag is defined', () => {
        sources['a.ts'] = 'export const fallback = $$ifndef(\'DEV\');';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: '"yes"' }) ]).toEqual([ 'fallback' ]);
    });

    test('should keep an ifndef binding when the flag is not defined', () => {
        sources['a.ts'] = 'export const fallback = $$ifndef(\'DEV\');';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'undefined' }) ]).toEqual([]);
    });

    test('should read the define table as source text rather than as values', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef(\'UNDEFINED\');',
            'export const b = $$ifdef(\'NULL\');',
            'export const c = $$ifdef(\'FALSE\');'
        ].join('\n');

        const defines = { UNDEFINED: 'undefined', NULL: 'null', FALSE: 'false' };

        expect([ ...analyzeMacros([ 'a.ts' ], defines) ]).toEqual([ 'a', 'b', 'c' ]);
    });

    test('should read every other define text as setting the flag', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef(\'ZERO\');',
            'export const b = $$ifdef(\'EMPTY\');',
            'export const c = $$ifdef(\'QUOTED\');',
            'export const d = $$ifdef(\'NAN\');'
        ].join('\n');

        const defines = { ZERO: '0', EMPTY: '', QUOTED: '""', NAN: 'NaN' };

        expect([ ...analyzeMacros([ 'a.ts' ], defines) ]).toEqual([]);
    });

    test('should read a define past the whitespace around it', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef(\'PADDED\');',
            'export const b = $$ifdef(\'SET\');'
        ].join('\n');

        const defines = { PADDED: '  false  ', SET: '  true  ' };

        expect([ ...analyzeMacros([ 'a.ts' ], defines) ]).toEqual([ 'a' ]);
    });

    test('should treat a flag that is absent from the table as not defined', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef(\'DEV\');',
            'export const b = $$ifndef(\'DEV\');'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], {}) ]).toEqual([ 'a' ]);
    });

    test('should handle several declarators in one statement', () => {
        sources['a.ts'] = 'export const on = $$ifdef(\'DEV\'), off = $$ifndef(\'DEV\'), plain = 1;';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([ 'on' ]);
    });

    test('should collect the dropped bindings of every file', () => {
        sources['a.ts'] = 'export const a = $$ifdef(\'DEV\');';
        sources['b.ts'] = 'export const b = $$ifndef(\'DEV\');';
        sources['c.ts'] = 'export const c = 1;';

        expect([ ...analyzeMacros([ 'a.ts', 'b.ts', 'c.ts' ], { DEV: 'true' }) ]).toEqual([ 'b' ]);
    });

    test('should ignore a macro that is not exported', () => {
        sources['a.ts'] = 'const debug = $$ifdef(\'DEV\');';

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([]);
    });

    test('should ignore an export that declares no variable', () => {
        sources['a.ts'] = [
            'const debug = $$ifdef(\'DEV\');',
            'export { debug };',
            'export function wrapper() { const inner = $$ifdef(\'DEV\'); return inner; }',
            'export class Holder {}'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([]);
    });

    test('should ignore a declarator whose initializer is not a plain call', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef;',
            'export const b = macros.$$ifdef(\'DEV\');',
            'export const c = $$ifdef(\'DEV\') as unknown;',
            'export const seen = $$ifdef(\'DEV\');'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([ 'seen' ]);
    });

    test('should ignore a call to another directive', () => {
        sources['a.ts'] = [
            'export const inlined = $$inline(\'1 + 1\');',
            'export const other = notAMacro(\'DEV\');',
            'export const seen = $$ifdef(\'DEV\');'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([ 'seen' ]);
    });

    test('should ignore a macro that is not given a string literal', () => {
        sources['a.ts'] = [
            'export const a = $$ifdef();',
            'export const b = $$ifdef(1);',
            'export const c = $$ifdef(NAME);',
            'export const d = $$ifdef(`DEV`);',
            'export const seen = $$ifdef(\'DEV\');'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([ 'seen' ]);
    });

    test('should ignore a macro bound to a destructuring pattern', () => {
        sources['a.ts'] = [
            'export const { flag } = $$ifdef(\'DEV\');',
            'export const [ first ] = $$ifdef(\'DEV\');'
        ].join('\n');

        expect([ ...analyzeMacros([ 'a.ts' ], { DEV: 'false' }) ]).toEqual([]);
    });

    test('should read every file through the cache once', () => {
        sources['a.ts'] = 'export const a = $$ifdef(\'DEV\');';
        sources['b.ts'] = 'export const b = 1;';

        analyzeMacros([ 'a.ts', 'b.ts' ], { DEV: 'false' });

        expect(touchMock).toHaveBeenCalledTimes(2);
        expect(touchMock).toHaveBeenCalledWith('a.ts');
        expect(touchMock).toHaveBeenCalledWith('b.ts');
    });
});
