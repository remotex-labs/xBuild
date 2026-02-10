/**
 * Import will remove at compile time
 */

import type { CompilerOptions } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';
import { cleanContent } from '@typescript/components/transformer.component';
import { needsCleaning } from '@typescript/components/transformer.component';
import { calculateOutputPath } from '@typescript/components/transformer.component';
import { removeEmptyExports, removeShebang } from '@typescript/components/transformer.component';
import { removeExportModifiers, removeOrphanComments } from '@typescript/components/transformer.component';
import { EXPORT_MODIFIER_REGEX, TRAILING_COMMENT_REGEX } from '@typescript/components/transformer.component';
import { EMPTY_EXPORT_REGEX, ORPHAN_COMMENT_REGEX, SHEBANG_REGEX } from '@typescript/components/transformer.component';

/**
 * Tests
 */

describe('clean-content utilities', () => {
    afterEach(() => {
        xJet.restoreAllMocks();
    });

    describe('SHEBANG_REGEX', () => {
        test('should match shebang at beginning of file', () => {
            expect(SHEBANG_REGEX.test('#!/usr/bin/env node\nconsole.log(1);')).toBe(true);
        });

        test('should not match content without shebang', () => {
            expect(SHEBANG_REGEX.test('console.log(1);')).toBe(false);
        });
    });

    describe('EMPTY_EXPORT_REGEX', () => {
        test('should match empty export statements', () => {
            const content = 'export {};\nexport const x = 1;';
            expect(content.match(EMPTY_EXPORT_REGEX)?.length).toBe(1);
        });
    });

    describe('ORPHAN_COMMENT_REGEX', () => {
        test('should match orphaned JSDoc blocks', () => {
            const content = `
                /** First */
                /** Second */
                export const x = 1;
            `;
            expect(ORPHAN_COMMENT_REGEX.test(content)).toBe(true);
        });
    });

    describe('EXPORT_MODIFIER_REGEX', () => {
        test('should strip export and export default modifiers', () => {
            expect(
                'export const x = 1;'.replace(EXPORT_MODIFIER_REGEX, '')
            ).toBe('const x = 1;');

            expect(
                'export default interface X {}'.replace(EXPORT_MODIFIER_REGEX, '')
            ).toBe('interface X {}');
        });
    });

    describe('TRAILING_COMMENT_REGEX', () => {
        test('should match trailing JSDoc comments', () => {
            expect(
                TRAILING_COMMENT_REGEX.test('const x = 1; /** comment */')
            ).toBe(true);
        });
    });

    describe('removeShebang()', () => {
        test('should remove shebang when present', () => {
            const input = '#!/usr/bin/env node\nconsole.log("ok");';
            expect(removeShebang(input)).toBe('console.log("ok");');
        });

        test('should return original content when no shebang exists', () => {
            const input = 'console.log("ok");';
            expect(removeShebang(input)).toBe(input);
        });
    });

    describe('removeEmptyExports()', () => {
        test('should remove empty export statements', () => {
            const input = 'export {};\nexport const x = 1;';
            expect(removeEmptyExports(input)).toBe('export const x = 1;');
        });

        test('should skip processing when no empty export exists', () => {
            const input = 'export const x = 1;';
            expect(removeEmptyExports(input)).toBe(input);
        });
    });

    describe('removeOrphanComments()', () => {
        test('should remove trailing JSDoc comments', () => {
            const input = 'const x = 1; /** trailing */';
            expect(removeOrphanComments(input)).toBe('const x = 1;');
        });

        test('should keep only the last orphaned JSDoc block', () => {
            const input = `
                /** First */
                /** Second */
                /** Third */
                export const x = 1;
            `;

            const output = removeOrphanComments(input);

            expect(output).toContain('/** Third */');
            expect(output).not.toContain('/** First */');
            expect(output).not.toContain('/** Second */');
        });
    });

    describe('removeExportModifiers()', () => {
        test('should remove export modifiers from declarations', () => {
            const input = `
                export const a = 1;
                export function foo() {}
                export default interface Bar {}
            `;

            const output = removeExportModifiers(input);

            expect(output).toContain('const a = 1;');
            expect(output).toContain('function foo() {}');
            expect(output).toContain('interface Bar {}');
        });
    });

    describe('needsCleaning()', () => {
        test('should detect shebang', () => {
            expect(needsCleaning('#!/bin/bash\nx')).toBe(true);
        });

        test('should detect empty export', () => {
            expect(needsCleaning('export {};')).toBe(true);
        });

        test('should detect JSDoc', () => {
            expect(needsCleaning('/** doc */\nexport const x = 1;')).toBe(true);
        });

        test('should return false for clean content', () => {
            expect(needsCleaning('export const x = 1;')).toBe(false);
        });
    });

    describe('cleanContent()', () => {
        test('should apply all cleaning steps', () => {
            const input = `#!/usr/bin/env node
                export {};
                export const x = 1;
            `.replace(/^\s+/gm, '');

            const output = cleanContent(input);

            expect(output).toBe('export const x = 1;\n');
        });

        test('should return original content when no cleaning needed', () => {
            const input = 'export const x = 1;';
            expect(cleanContent(input)).toBe(input);
        });
    });

    describe('calculateOutputPath()', () => {
        test('should calculate output path using outDir and rootDir', () => {
            xJet.spyOn(ts.sys, 'resolvePath').mockImplementation((p) => p);
            const options: CompilerOptions = {
                outDir: '/project/dist',
                rootDir: '/project/src'
            };

            const result = calculateOutputPath(
                '/project/src/index.ts',
                options
            );

            expect(result).toBe('/project/dist/index.d.ts');
        });

        test('should prefer declarationDir over outDir', () => {
            xJet.spyOn(ts.sys, 'resolvePath').mockImplementation((p) => p);
            const options: CompilerOptions = {
                outDir: '/project/dist',
                declarationDir: '/project/types',
                rootDir: '/project/src'
            };

            const result = calculateOutputPath(
                '/project/src/a/b.ts',
                options
            );

            expect(result).toBe('/project/types/a/b.d.ts');
        });

        test('should normalize windows paths to forward slashes', () => {
            xJet.spyOn(ts.sys, 'resolvePath').mockImplementation((p) => p);

            const options: CompilerOptions = {
                outDir: 'dist',
                rootDir: 'src'
            };

            const result = calculateOutputPath(
                'src\\index.ts',
                options
            );

            expect(result).toContain('/');
            expect(result).not.toContain('\\');
        });
    });
});
