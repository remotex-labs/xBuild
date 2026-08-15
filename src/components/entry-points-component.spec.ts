/**
 * Imports
 */

import { cwd } from 'process';
import { collectFiles } from '@components/glob.component';
import { extractEntryPoints } from '@components/entry-points.component';

/**
 * Tests
 */

const collectMock = xJet.mock(collectFiles);

beforeEach(() => {
    xJet.resetAllMocks();
    collectMock.mockReturnValue([]);
});

describe('extractEntryPoints', () => {
    test('should return undefined when no entry points are given', () => {
        expect(extractEntryPoints(undefined)).toBeUndefined();
    });

    test('should throw for an unsupported entry points format', () => {
        expect(() => extractEntryPoints(<any> 123)).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints(<any> 'src/index.ts')).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints(<any> null)).toThrow('Unsupported entry points format');
    });

    test('should return a record as it stands, without copying it', () => {
        const record = { index: 'src/index.ts' };

        expect(extractEntryPoints(record)).toBe(record);
    });

    test('should return an empty record for an empty list rather than matching everything', () => {
        expect(extractEntryPoints([])).toEqual({});
        expect(collectFiles).not.toHaveBeenCalled();
    });

    test('should key a list of in and out pairs by their out', () => {
        expect(extractEntryPoints([
            { in: 'src/index.ts', out: 'bundle' },
            { in: 'src/worker.ts', out: 'nested/worker' }
        ])).toEqual({
            'bundle': 'src/index.ts',
            'nested/worker': 'src/worker.ts'
        });
    });

    test('should match globs from the working directory whatever the root says', () => {
        extractEntryPoints([ 'src/**' ], 'src/components');

        expect(collectFiles).toHaveBeenCalledWith(cwd(), [ 'src/**' ]);
    });

    test('should key a matched file by its path with the extension dropped', () => {
        collectMock.mockReturnValue([ 'src/index.ts', 'src/components/glob.component.ts' ]);

        expect(extractEntryPoints([ 'src/**' ])).toEqual({
            'src/index': 'src/index.ts',
            'src/components/glob.component': 'src/components/glob.component.ts'
        });
    });

    test('should shorten a matched file against the root', () => {
        collectMock.mockReturnValue([ 'src/components/glob.component.ts' ]);

        expect(extractEntryPoints([ 'src/**' ], 'src')).toEqual({
            'components/glob.component': 'src/components/glob.component.ts'
        });
    });

    test('should name a file outside the root by its whole path', () => {
        collectMock.mockReturnValue([ 'src/components/glob.component.ts', 'src/services/vm.service.ts' ]);

        expect(extractEntryPoints([ 'src/**' ], 'src/components')).toEqual({
            'glob.component': 'src/components/glob.component.ts',
            'src/services/vm.service': 'src/services/vm.service.ts'
        });
    });

    test('should shorten nothing when the root is the working directory', () => {
        collectMock.mockReturnValue([ 'src/index.ts' ]);
        const expected = { 'src/index': 'src/index.ts' };

        expect(extractEntryPoints([ 'src/**' ])).toEqual(expected);
        expect(extractEntryPoints([ 'src/**' ], '.')).toEqual(expected);
        expect(extractEntryPoints([ 'src/**' ], cwd())).toEqual(expected);
    });

    test('should name every file by its whole path when the root lies outside the working directory', () => {
        collectMock.mockReturnValue([ 'src/index.ts' ]);

        expect(extractEntryPoints([ 'src/**' ], '../elsewhere')).toEqual({ 'src/index': 'src/index.ts' });
    });

    test('should drop the last extension alone from a name that carries several dots', () => {
        collectMock.mockReturnValue([ 'src/glob.component.ts', 'src/.eslintrc.json' ]);

        expect(extractEntryPoints([ 'src/**' ])).toEqual({
            'src/glob.component': 'src/glob.component.ts',
            'src/.eslintrc': 'src/.eslintrc.json'
        });
    });

    test('should keep the whole name of a file that carries no extension', () => {
        collectMock.mockReturnValue([ 'LICENSE', 'src/.eslintrc' ]);

        expect(extractEntryPoints([ '**' ])).toEqual({
            'LICENSE': 'LICENSE',
            'src/.eslintrc': 'src/.eslintrc'
        });
    });
});
