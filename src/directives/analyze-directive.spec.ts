
/**
 * Import will remove at compile time
 */

import type { MacrosStaeInterface } from '@directives/interfaces/analyze-directive.interface';
import type { BuildContextInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
import { analyzeDependencies } from '@services/transpiler.service';
import { getLineAndColumn, isCommentLine, analyzeMacroMetadata } from './analyze.directive';

/**
 * Tests
 */

describe('analyze.directive', () => {
    describe('getLineAndColumn', () => {
        test('returns correct line and column for single-line text', () => {
            const text = 'const $$debug = $$ifdef("DEBUG");';
            const result = getLineAndColumn(text, '$$debug', 'test.ts', 6);

            expect(result.file).toBe('test.ts');
            expect(result.line).toBe(1);
            expect(result.column).toBe(0);
        });

        test('returns correct line and column for multi-line text', () => {
            const text = 'import x from "y";\nconst $$myMacro = $$ifdef("DEBUG");';
            const macroIndex = text.indexOf('const');
            const result = getLineAndColumn(text, '$$myMacro', 'src/app.ts', macroIndex);

            expect(result.file).toBe('src/app.ts');
            expect(result.line).toBe(2);
            expect(result.column).toBe(6);
        });

        test('calculates column relative to match index', () => {
            const text = 'const x = 1;\nconst y = 2;\nconst $$feature = $$ifdef("FEATURE_X");';
            const index = text.indexOf('const $$feature');
            const result = getLineAndColumn(text, '$$feature', 'config.ts', index);

            expect(result.line).toBe(3);
            expect(result.column).toBe(6);
        });

        test('handles text with multiple newlines correctly', () => {
            const text = 'line1\n\n\nconst $$macro = $$ifdef("TEST");';
            const index = text.indexOf('const');
            const result = getLineAndColumn(text, '$$macro', 'file.ts', index);

            expect(result.line).toBe(4);
        });

        test('column is offset from the match index to where name appears', () => {
            const text = 'const $$debug = $$ifdef("DEBUG");';
            // index starts at "const", name "$$debug" appears 6 chars later
            const result = getLineAndColumn(text, '$$debug', 'test.ts', 0);

            expect(result.column).toBe(6);
        });
    });

    describe('isCommentLine', () => {
        test('returns true for single-line comment with //', () => {
            const code = '// const $$debug = $$ifdef("DEBUG");\nconst $$prod = $$ifdef("PROD");';
            const debugIndex = code.indexOf('$$debug');

            expect(isCommentLine(code, debugIndex)).toBe(true);
        });

        test('returns false for code not in comment', () => {
            const code = '// const $$debug = $$ifdef("DEBUG");\nconst $$prod = $$ifdef("PROD");';
            const prodIndex = code.indexOf('$$prod');

            expect(isCommentLine(code, prodIndex)).toBe(false);
        });

        test('returns true for multi-line comment with /* */', () => {
            const code = `/*
 * const $$feature = $$ifdef("FEATURE");
 */
const $$active = $$ifdef("ACTIVE");`;
            const featureIndex = code.indexOf('$$feature');

            expect(isCommentLine(code, featureIndex)).toBe(true);
        });

        test('returns false for code after multi-line comment', () => {
            const code = `/*
 * const $$feature = $$ifdef("FEATURE");
 */
const $$active = $$ifdef("ACTIVE");`;
            const activeIndex = code.indexOf('$$active');

            expect(isCommentLine(code, activeIndex)).toBe(false);
        });

        test('handles indented comments correctly', () => {
            const code = '    // Commented macro\n    const $$real = $$ifdef("REAL");';
            const commentIndex = code.indexOf('Commented');

            expect(isCommentLine(code, commentIndex)).toBe(true);
        });

        test('handles JSDoc-style comments with *', () => {
            const code = `/**
 * Some documentation
 * const $$doc = $$ifdef("DOC");
 */`;
            const docIndex = code.indexOf('$$doc');

            expect(isCommentLine(code, docIndex)).toBe(true);
        });

        test('returns false when line starts with code', () => {
            const code = 'const x = 1; // comment after';
            const index = code.indexOf('const');

            expect(isCommentLine(code, index)).toBe(false);
        });

        test('handles tabs as whitespace', () => {
            const code = '\t\t// tabbed comment\n\tconst $$x = 1;';
            const commentIndex = code.indexOf('tabbed');

            expect(isCommentLine(code, commentIndex)).toBe(true);
        });
    });

    describe('analyzeMacroMetadata', () => {
        let variant: any;
        let context: BuildContextInterface & { stage: MacrosStaeInterface };
        let filesModel: any;

        const injectMock = xJet.mock(inject);
        const analyzeDependenciesMock = xJet.mock(analyzeDependencies);

        beforeEach(() => {
            xJet.resetAllMocks();

            // Setup variant mock
            variant = {
                config: {
                    define: {
                        DEBUG: true,
                        PRODUCTION: false
                    }
                }
            };

            // Setup context mock
            context = {
                build: {
                    initialOptions: {
                        entryPoints: [ 'src/index.ts' ]
                    }
                },
                stage: {}
            } as any;

            // Setup FilesModel mock
            filesModel = {
                getSnapshot: xJet.fn(),
                touchFile: xJet.fn(),
                resolve: xJet.fn((path: string) => path)
            };

            // Setup inject mock
            injectMock.mockReturnValue(filesModel);

            // Setup analyzeDependencies mock
            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {}
                }
            } as any);
        });

        test('initializes metadata with empty sets', async () => {
            const result = await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata).toBeDefined();
            expect(context.stage.defineMetadata.disabledMacroNames).toBeInstanceOf(Set);
            expect(context.stage.defineMetadata.filesWithMacros).toBeInstanceOf(Set);
            expect(result.warnings).toEqual([]);
        });

        test('disables macros for ifdef when define is false', async () => {
            const content = 'const $$hasDebug = $$ifdef("DEBUG", () => {});\nconst $$hasProd = $$ifdef("PRODUCTION", () => {});';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/config.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            await analyzeMacroMetadata(variant, context);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasProd')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasDebug')).toBe(false);
        });

        test('disables macros for ifndef when define is true', async () => {
            const content = 'const $$noDebug = $$ifndef("DEBUG");\nconst $$noProd = $$ifndef("PRODUCTION");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/config.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$noDebug')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$noProd')).toBe(false);
        });

        test('tracks files with macros', async () => {
            const content = 'const $$feature = $$ifdef("FEATURE");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/feature.ts': {},
                        'src/utils.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockImplementation((file: string) => {
                if (file === 'src/feature.ts') {
                    return { contentSnapshot: { text: content } };
                }

                return { contentSnapshot: { text: 'const x = 1;' } };
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.filesWithMacros.has('src/feature.ts')).toBe(true);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/utils.ts')).toBe(false);
        });

        test('generates warnings for macros without $$ prefix', async () => {
            const content = 'const myMacro = $$ifdef("FEATURE");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/feature.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings!.length).toBe(1);
            expect(result.warnings![0].text).toContain('Macro function \'myMacro\' not start with \'$$\' prefix');
            expect(result.warnings![0].location?.file).toBe('src/feature.ts');
        });

        test('skips macros in single-line comments', async () => {
            const content = '// const $$commented = $$ifdef("DEBUG");\nconst $$real = $$ifdef("DEBUG");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/test.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$commented')).toBe(false);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/test.ts')).toBe(true);
        });

        test('skips macros in multi-line comments', async () => {
            const content = '/* const $$commented = $$ifdef("DEBUG"); */\nconst $$real = $$ifdef("DEBUG");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/test.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$commented')).toBe(false);
        });

        test('handles files with no snapshot content', async () => {
            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/missing.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue(null);
            filesModel.touchFile.mockReturnValue(null);

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings).toEqual([]);
            expect(context.stage.defineMetadata.filesWithMacros.size).toBe(0);
        });

        test('handles undefined define configuration', async () => {
            variant.config.define = undefined;
            const content = 'const $$feature = $$ifdef("FEATURE");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/test.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            await analyzeMacroMetadata(variant, context);

            // When define is undefined, FEATURE is not defined, so ifdef macro should be disabled
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$feature')).toBe(true);
        });

        test('supports export declarations with macros', async () => {
            const content = 'export const $$publicApi = $$ifdef("PUBLIC_API");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/api.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            variant.config.define = { PUBLIC_API: true };

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$publicApi')).toBe(false);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/api.ts')).toBe(true);
        });

        test('handles multiple macros in single file', async () => {
            const content = `
const $$debug = $$ifdef("DEBUG");
const $$prod = $$ifdef("PRODUCTION");
const $$noTest = $$ifndef("TEST");
`;

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/multi.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            variant.config.define = { DEBUG: true, PRODUCTION: false, TEST: false };

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$debug')).toBe(false);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$prod')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$noTest')).toBe(false);
        });

        test('correctly resolves file paths', async () => {
            const content = 'const $$test = $$ifdef("TEST");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'relative/path.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            filesModel.resolve.mockReturnValue('absolute/relative/path.ts');

            await analyzeMacroMetadata(variant, context);

            expect(filesModel.resolve).toHaveBeenCalledWith('relative/path.ts');
            expect(context.stage.defineMetadata.filesWithMacros.has('absolute/relative/path.ts')).toBe(true);
        });

        test('handles missing define as falsy value', async () => {
            const content = 'const $$feature = $$ifdef("UNDEFINED_FEATURE");';

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/test.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            variant.config.define = { DEBUG: true };

            await analyzeMacroMetadata(variant, context);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$feature')).toBe(true);
        });

        test('handles falsy define values correctly', async () => {
            const content = `
const $$hasZero = $$ifdef("ZERO");
const $$hasEmpty = $$ifdef("EMPTY_STRING");
const $$hasFalse = $$ifdef("FALSE_VAL");
`;

            analyzeDependenciesMock.mockResolvedValue({
                metafile: {
                    inputs: {
                        'src/test.ts': {}
                    }
                }
            } as any);

            filesModel.getSnapshot.mockReturnValue({
                contentSnapshot: { text: content }
            });

            variant.config.define = {
                ZERO: 0,
                EMPTY_STRING: '',
                FALSE_VAL: false
            };

            await analyzeMacroMetadata(variant, context);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasZero')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasEmpty')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasFalse')).toBe(true);
        });
    });
});
