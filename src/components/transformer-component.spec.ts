/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { SourceEditInterface } from './interfaces/transformer-component.interface';

/**
 * Imports
 */

import { parseSync } from 'oxc-parser';
import { removeNode, applyEdits, rewrite, resolveSource } from './transformer.component';

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

describe('rewrite', () => {
    const source = { value: '@components/builder', start: 22, end: 43 };

    let ts: any;
    let edits: Array<SourceEditInterface>;

    beforeEach(() => {
        edits = [];
        ts = {
            resolve: xJet.fn((specifier: string) => specifier.startsWith('@')
                ? { extension: '.ts', isExternalLibraryImport: false, relativeFileName: `./${ specifier.slice(1) }.ts` }
                : { extension: '.d.ts', isExternalLibraryImport: true, relativeFileName: '' })
        };
    });

    test('should queue a rewrite pointing at the file emitted beside it', () => {
        rewrite(<any> source, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toEqual([{ start: 22, end: 43, text: '\'./components/builder.js\'' }]);
    });

    test('should resolve the specifier against the file it was written in', () => {
        rewrite(<any> source, 'D:/app/src/index.ts', edits, ts);

        expect(ts.resolve).toHaveBeenCalledWith('@components/builder', 'D:/app/src/index.ts');
    });

    test('should append the emitted extension to a path the resolution reported without one', () => {
        ts.resolve.mockReturnValue({ isExternalLibraryImport: false, relativeFileName: './builder' });
        rewrite(<any> source, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toEqual([{ start: 22, end: 43, text: '\'./builder.js\'' }]);
    });

    test('should leave a specifier naming a package as it was written', () => {
        rewrite(<any> { value: 'typescript', start: 22, end: 34 }, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toEqual([]);
    });

    test('should leave a specifier that resolves nowhere alone', () => {
        ts.resolve.mockReturnValue(undefined);
        rewrite(<any> source, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toEqual([]);
    });

    test('should ignore a statement that carries no specifier', () => {
        rewrite(null, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toEqual([]);
        expect(ts.resolve).not.toHaveBeenCalled();
    });

    test('should append to the collector rather than replacing it', () => {
        edits.push({ start: 0, end: 5, text: 'let' });
        rewrite(<any> source, 'D:/app/src/index.ts', edits, ts);

        expect(edits).toHaveLength(2);
    });
});

describe('resolveSource', () => {
    const target = 'D:/app/src/index.ts';

    let ts: any;

    /**
     * Parses a source text and rewrites its specifiers the way a caller would.
     */

    const resolve = (content: string): string =>
        resolveSource(parseSync(target, content, { sourceType: 'module' }), target, content, ts);

    beforeEach(() => {
        ts = {
            resolve: xJet.fn((specifier: string) => specifier.startsWith('@')
                ? { extension: '.ts', isExternalLibraryImport: false, relativeFileName: `./${ specifier.slice(1) }.ts` }
                : { extension: '.d.ts', isExternalLibraryImport: true, relativeFileName: '' })
        };
    });

    test.each(
        { case: 'an import', content: 'import { build } from "@components/builder";', expected: 'import { build } from \'./components/builder.js\';' },
        { case: 'a star export', content: 'export * from "@components/builder";', expected: 'export * from \'./components/builder.js\';' },
        { case: 'a namespace re-export', content: 'export * as api from "@components/builder";', expected: 'export * as api from \'./components/builder.js\';' },
        { case: 'a named export', content: 'export { build } from "@components/builder";', expected: 'export { build } from \'./components/builder.js\';' },
        { case: 'an import-equals', content: 'import builder = require("@components/builder");', expected: 'import builder = require(\'./components/builder.js\');' }
    )('should rewrite the specifier of $case', ({ content, expected }) => {
        expect(resolve(content)).toBe(expected);
    });

    test('should rewrite every specifier the file carries', () => {
        const content = 'import { build } from "@components/builder";\nimport { files } from "@models/files";';

        expect(resolve(content)).toBe(
            'import { build } from \'./components/builder.js\';\nimport { files } from \'./models/files.js\';'
        );
    });

    test('should leave a package specifier as it was written', () => {
        const content = 'import ts from "typescript";';

        expect(resolve(content)).toBe(content);
    });

    test('should leave an import-equals that names no module alone', () => {
        const content = 'declare namespace A { const b: string; }\nimport C = A.b;';

        expect(resolve(content)).toBe(content);
        expect(ts.resolve).not.toHaveBeenCalled();
    });

    test('should leave an export that carries no from clause alone', () => {
        const content = 'declare const a: string;\nexport { a };';

        expect(resolve(content)).toBe(content);
        expect(ts.resolve).not.toHaveBeenCalled();
    });

    test('should visit the top-level statements alone', () => {
        const content = 'declare module "x" {\n    import { build } from "@components/builder";\n}';

        expect(resolve(content)).toBe(content);
    });

    test('should hand the content back untouched when nothing was rewritten', () => {
        const content = 'declare const a: string;';

        expect(resolve(content)).toBe(content);
    });

    test('should hand empty content back without parsing anything out of it', () => {
        expect(resolveSource(parseSync(target, '', { sourceType: 'module' }), target, '', ts)).toBe('');
        expect(ts.resolve).not.toHaveBeenCalled();
    });
});
