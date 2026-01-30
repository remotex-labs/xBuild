/**
 * Imports
 */

import { xBuildLazy } from '@errors/stack.error';
import { extractEntryPoints } from '@components/entry-points.component';

/**
 * Tests
 */

describe('ExtractEntryPoints', () => {
    test('should handle array of { in: string, out: string }', () => {
        const entryPoints = [
            { in: 'src/index.ts', out: 'dist/index.js' },
            { in: 'src/utils.ts', out: 'dist/utils.js' }
        ];
        expect(extractEntryPoints(entryPoints)).toEqual({
            'dist/index.js': 'src/index.ts',
            'dist/utils.js': 'src/utils.ts'
        });
    });

    test('should handle array of strings', () => {
        const entryPoints = [ 'src/index.ts', 'src/utils.ts' ];
        expect(extractEntryPoints(entryPoints)).toEqual({
            'src/index': 'src/index.ts',
            'src/utils': 'src/utils.ts'
        });
    });

    test('should handle Record<string, string>', () => {
        const entryPoints = {
            'index': 'src/index.ts',
            'utils': 'src/utils.ts'
        };
        expect(extractEntryPoints(entryPoints)).toEqual(entryPoints);
    });

    test('should throw error for unsupported format', () => {
        xJet.mock(xBuildLazy).mockReturnValue(<any>{
            get service() {
                return {
                    file: 'x'
                };
            }
        });

        expect(() => extractEntryPoints(123 as any)).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints('{}' as any)).toThrow('Unsupported entry points format');
        expect(() => extractEntryPoints(null as any)).toThrow('Unsupported entry points format');
    });
});
