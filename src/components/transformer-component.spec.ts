/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { SourceEditInterface } from './interfaces/transformer-component.interface';

/**
 * Imports
 */

import { removeNode, applyEdits } from './transformer.component';

/**
 * Tests
 */

describe('removeNode', () => {
    test.each(
        { case: 'the line terminator after the node', content: 'const a = 1;\nconst b = 2;', end: 13 },
        { case: 'the spaces and tabs before the terminator', content: 'const a = 1;  \t\nconst b = 2;', end: 16 },
        { case: 'a CRLF terminator as one unit', content: 'const a = 1;\r\nconst b = 2;', end: 14 },
        { case: 'a bare CR terminator', content: 'const a = 1;\rconst b = 2;', end: 13 },
        { case: 'nothing past a non-blank character', content: 'const a = 1; const b = 2;', end: 13 },
        { case: 'nothing at the end of the content', content: 'const a = 1;', end: 12 },
        { case: 'the blanks that end the content', content: 'const a = 1;  ', end: 14 },
        { case: 'only the first of two terminators', content: 'const a = 1;\n\nconst b = 2;', end: 13 }
    )('should consume $case', ({ content, end }) => {
        const edits: Array<SourceEditInterface> = [];
        removeNode({ start: 0, end: 12 }, content, edits);

        expect(edits).toEqual([{ start: 0, end }]);
    });

    test('should leave the line without a gap where the node stood', () => {
        const content = 'const a = 1;\nconst b = 2;';
        const edits: Array<SourceEditInterface> = [];

        removeNode({ start: 0, end: 12 }, content, edits);

        expect(applyEdits(content, edits)).toBe('const b = 2;');
    });

    test('should keep what precedes the node on its line', () => {
        const content = 'let x; const a = 1;\nconst b = 2;';
        const edits: Array<SourceEditInterface> = [];

        removeNode({ start: 7, end: 19 }, content, edits);

        expect(edits).toEqual([{ start: 7, end: 20 }]);
        expect(applyEdits(content, edits)).toBe('let x; const b = 2;');
    });

    test('should record a deletion carrying no replacement text', () => {
        const edits: Array<SourceEditInterface> = [];
        removeNode({ start: 0, end: 12 }, 'const a = 1;\nconst b = 2;', edits);

        expect(edits[0].text).toBeUndefined();
    });

    test('should append to the collector rather than replacing it', () => {
        const edits: Array<SourceEditInterface> = [{ start: 13, end: 18, text: 'let' }];
        removeNode({ start: 0, end: 12 }, 'const a = 1;\nconst b = 2;', edits);

        expect(edits).toHaveLength(2);
        expect(edits[0].text).toBe('let');
    });
});

describe('applyEdits', () => {
    const replace: SourceEditInterface = { start: 0, end: 5, text: 'let' };

    test.each(
        { case: 'a single replacement', edits: [ replace ], expected: 'let a = 1;' },
        { case: 'several edits left to right', edits: [ replace, { start: 6, end: 7, text: 'b' }], expected: 'let b = 1;' },
        { case: 'edits given out of order', edits: [{ start: 6, end: 7, text: 'b' }, replace ], expected: 'let b = 1;' },
        { case: 'an edit overlapping an earlier one', edits: [ replace, { start: 2, end: 6, text: 'X' }], expected: 'let a = 1;' },
        { case: 'an edit starting where the last ended', edits: [ replace, { start: 5, end: 6, text: '_' }], expected: 'let_a = 1;' },
        { case: 'a deletion carrying no text', edits: [{ start: 0, end: 6 }], expected: 'a = 1;' },
        { case: 'a deletion carrying empty text', edits: [{ start: 0, end: 6, text: '' }], expected: 'a = 1;' },
        { case: 'an insertion', edits: [{ start: 5, end: 5, text: ' very' }], expected: 'const very a = 1;' },
        { case: 'two insertions at one offset', edits: [{ start: 5, end: 5, text: ' one' }, { start: 5, end: 5, text: ' two' }], expected: 'const one two a = 1;' },
        { case: 'a replacement of the whole content', edits: [{ start: 0, end: 12, text: 'let b = 2;' }], expected: 'let b = 2;' },
        { case: 'an edit at the end of the content', edits: [{ start: 12, end: 12, text: ' // done' }], expected: 'const a = 1; // done' },
        { case: 'an edit running past the end of the content', edits: [{ start: 6, end: 99, text: 'X' }], expected: 'const X' }
    )('should apply $case', ({ edits, expected }) => {
        expect(applyEdits('const a = 1;', [ ...edits ])).toBe(expected);
    });

    test('should return the content itself when there is nothing to apply', () => {
        const content = 'const a = 1;';

        expect(applyEdits(content, [])).toBe(content);
    });

    test('should sort the given array in place', () => {
        const edits: Array<SourceEditInterface> = [
            { start: 6, end: 7, text: 'b' },
            { start: 0, end: 5, text: 'let' }
        ];

        applyEdits('const a = 1;', edits);

        expect(edits.map(edit => edit.start)).toEqual([ 0, 6 ]);
    });
});
