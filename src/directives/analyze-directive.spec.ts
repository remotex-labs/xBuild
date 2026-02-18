/**
 * Import will remove at compile time
 */

import type { MacrosStateInterface } from '@directives/interfaces/analyze-directive.interface';
import type { BuildContextInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
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
            expect(result.column).toBe(6);
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
            const result = getLineAndColumn(text, '$$debug', 'test.ts', 0);

            expect(result.column).toBe(6);
        });
    });

    describe('isCommentLine', () => {
        test('returns true for single-line comment with //', () => {
            const code = '// const $$debug = $$ifdef("DEBUG");\nconst $$prod = $$ifdef("PROD");';

            expect(isCommentLine(code, code.indexOf('$$debug'))).toBe(true);
        });

        test('returns false for code not in comment', () => {
            const code = '// const $$debug = $$ifdef("DEBUG");\nconst $$prod = $$ifdef("PROD");';

            expect(isCommentLine(code, code.indexOf('$$prod'))).toBe(false);
        });

        test('returns true for multi-line comment with /* */', () => {
            const code = '/*\n * const $$feature = $$ifdef("FEATURE");\n */\nconst $$active = $$ifdef("ACTIVE");';

            expect(isCommentLine(code, code.indexOf('$$feature'))).toBe(true);
        });

        test('returns false for code after multi-line comment', () => {
            const code = '/*\n * const $$feature = $$ifdef("FEATURE");\n */\nconst $$active = $$ifdef("ACTIVE");';

            expect(isCommentLine(code, code.indexOf('$$active'))).toBe(false);
        });

        test('handles indented comments correctly', () => {
            const code = '    // Commented macro\n    const $$real = $$ifdef("REAL");';

            expect(isCommentLine(code, code.indexOf('Commented'))).toBe(true);
        });

        test('handles JSDoc-style comments with *', () => {
            const code = '/**\n * Some documentation\n * const $$doc = $$ifdef("DOC");\n */';

            expect(isCommentLine(code, code.indexOf('$$doc'))).toBe(true);
        });

        test('returns false when line starts with code', () => {
            const code = 'const x = 1; // comment after';

            expect(isCommentLine(code, code.indexOf('const'))).toBe(false);
        });

        test('handles tabs as whitespace', () => {
            const code = '\t\t// tabbed comment\n\tconst $$x = 1;';

            expect(isCommentLine(code, code.indexOf('tabbed'))).toBe(true);
        });

        test('returns false for code on first line (no preceding newline)', () => {
            const code = 'const $$x = $$ifdef("X");';

            expect(isCommentLine(code, 0)).toBe(false);
        });

        test('returns true for inline // comment before macro', () => {
            const code = 'const x = 1;\n  // const $$x = $$ifdef("X");';

            expect(isCommentLine(code, code.indexOf('$$x'))).toBe(true);
        });
    });

    describe('analyzeMacroMetadata', () => {
        let variant: any;
        let context: BuildContextInterface & { stage: MacrosStateInterface };
        let filesModel: any;

        const injectMock = xJet.mock(inject);

        beforeEach(() => {
            xJet.resetAllMocks();

            filesModel = {
                getOrTouchFile: xJet.fn(),
                resolve: xJet.fn((path: string) => path)
            };

            injectMock.mockReturnValue(filesModel);

            variant = {
                config: {
                    define: {
                        DEBUG: true,
                        PRODUCTION: false
                    }
                },
                dependencies: {}
            };

            context = {
                build: {
                    initialOptions: {
                        entryPoints: [ 'src/index.ts' ]
                    }
                },
                stage: {}
            } as any;
        });

        test('initializes metadata with empty sets', async () => {
            const result = await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata).toBeDefined();
            expect(context.stage.defineMetadata.disabledMacroNames).toBeInstanceOf(Set);
            expect(context.stage.defineMetadata.filesWithMacros).toBeInstanceOf(Set);
            expect(result.warnings).toEqual([]);
        });

        test('handles empty dependencies', async () => {
            variant.dependencies = {};
            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings).toEqual([]);
            expect(context.stage.defineMetadata.filesWithMacros.size).toBe(0);
        });

        test('handles files with no snapshot content', async () => {
            variant.dependencies = { 'src/missing.ts': 'src/missing.ts' };
            filesModel.getOrTouchFile.mockReturnValue(null);

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings).toEqual([]);
            expect(context.stage.defineMetadata.filesWithMacros.size).toBe(0);
        });

        test('handles undefined define configuration', async () => {
            variant.config.define = undefined;
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: { text: 'const $$feature = $$ifdef("FEATURE");' }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$feature')).toBe(true);
        });

        test.each(
            'const $$flag = $$ifdef("DEBUG");',
            'let $$flag = $$ifdef("DEBUG");',
            'var $$flag = $$ifdef("DEBUG");'
        )('detects macro declared with %s', (content, done) => {
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            variant.config.define = { DEBUG: true };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            analyzeMacroMetadata(variant, context).then(() => {
                expect(context.stage.defineMetadata.filesWithMacros.has('src/test.ts')).toBe(true);
                expect(context.stage.defineMetadata.disabledMacroNames.has('$$flag')).toBe(false);

                done();
            });
        });

        test.each(
            'const $$flag = $$ifdef("DISABLED");',
            'let $$flag = $$ifdef("DISABLED");',
            'var $$flag = $$ifdef("DISABLED");'
        )('disables macro declared with %s when define is false', (content, done) => {
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            variant.config.define = { DISABLED: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            analyzeMacroMetadata(variant, context).then(() => {
                expect(context.stage.defineMetadata.disabledMacroNames.has('$$flag')).toBe(true);
                done();
            });
        });

        test.each(
            'export const $$pub = $$ifdef("PUBLIC_API");',
            'export let $$pub = $$ifdef("PUBLIC_API");',
            'export var $$pub = $$ifdef("PUBLIC_API");'
        )('detects macro declared with %s', (content, done) => {
            variant.dependencies = { 'src/api.ts': 'src/api.ts' };
            variant.config.define = { PUBLIC_API: true };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            analyzeMacroMetadata(variant, context).then(() => {
                expect(context.stage.defineMetadata.filesWithMacros.has('src/api.ts')).toBe(true);
                expect(context.stage.defineMetadata.disabledMacroNames.has('$$pub')).toBe(false);
                done();
            });
        });

        test.each(
            'export const $$pub = $$ifdef("DISABLED");',
            'export let $$pub = $$ifdef("DISABLED");',
            'export var $$pub = $$ifdef("DISABLED");'
        )('disables exported macro declared with %s when define is false', (content, done) => {
            variant.dependencies = { 'src/api.ts': 'src/api.ts' };
            variant.config.define = { DISABLED: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            analyzeMacroMetadata(variant, context).then(() => {
                expect(context.stage.defineMetadata.disabledMacroNames.has('$$pub')).toBe(true);
                done();
            });
        });

        test('disables macros for ifdef when define is false', async () => {
            variant.dependencies = { 'src/config.ts': 'src/config.ts' };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: {
                    text: 'const $$hasDebug = $$ifdef("DEBUG");\nconst $$hasProd = $$ifdef("PRODUCTION");'
                }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasProd')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasDebug')).toBe(false);
        });

        test('disables macros for ifndef when define is true', async () => {
            variant.dependencies = { 'src/config.ts': 'src/config.ts' };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: {
                    text: 'const $$noDebug = $$ifndef("DEBUG");\nconst $$noProd = $$ifndef("PRODUCTION");'
                }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$noDebug')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$noProd')).toBe(false);
        });

        test('detects inline directive and registers file', async () => {
            variant.dependencies = { 'src/inline.ts': 'src/inline.ts' };
            variant.config.define = { FEATURE: true };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: { text: 'const $$inlined = $$inline(() => { console.log("ads"); });' }
            });

            await analyzeMacroMetadata(variant, context);

            // inline is not ifdef/ifndef so the disabled logic does not apply,
            // but the file must still be tracked
            expect(context.stage.defineMetadata.filesWithMacros.has('src/inline.ts')).toBe(true);
        });

        test('tracks file for bare $$ifdef call without assignment', async () => {
            variant.dependencies = { 'src/bare.ts': 'src/bare.ts' };
            variant.config.define = { DEBUG: true };
            filesModel.getOrTouchFile.mockReturnValue({
                // no "const x =" prefix — regex group 1 is undefined
                contentSnapshot: { text: '$$ifdef("DEBUG");' }
            });

            await analyzeMacroMetadata(variant, context);

            // fn is undefined → no entry in disabledMacroNames, but file still tracked
            expect(context.stage.defineMetadata.filesWithMacros.has('src/bare.ts')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.size).toBe(0);
        });

        test('tracks file for bare $$ifndef call without assignment', async () => {
            variant.dependencies = { 'src/bare.ts': 'src/bare.ts' };
            variant.config.define = { DEBUG: false };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: { text: '$$ifndef("DEBUG");' }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.filesWithMacros.has('src/bare.ts')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.size).toBe(0);
        });

        test('detects macro nested inside a function body', async () => {
            const content = `
                function setup() {
                    const $$nested = $$ifdef("DEBUG");
                }
            `;

            variant.dependencies = { 'src/fn.ts': 'src/fn.ts' };
            variant.config.define = { DEBUG: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$nested')).toBe(true);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/fn.ts')).toBe(true);
        });

        test('detects macro nested inside an arrow function', async () => {
            const content = `
                const init = () => {
                    let $$arrowMacro = $$ifdef("FEATURE");
                };
            `;

            variant.dependencies = { 'src/arrow.ts': 'src/arrow.ts' };
            variant.config.define = { FEATURE: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$arrowMacro')).toBe(true);
        });

        test('detects macro nested inside a class method', async () => {
            const content = `
                class MyService {
                    configure() {
                        var $$classMacro = $$ifndef("PRODUCTION");
                    }
                }
            `;

            variant.dependencies = { 'src/service.ts': 'src/service.ts' };
            // PRODUCTION is false, so ifndef("PRODUCTION") → enabled (not disabled)
            variant.config.define = { PRODUCTION: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$classMacro')).toBe(false);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/service.ts')).toBe(true);
        });

        test('detects macro nested inside a class method and disabled correctly', async () => {
            const content = `
                class MyService {
                    configure() {
                        var $$classMacro = $$ifndef("PRODUCTION");
                    }
                }
            `;

            variant.dependencies = { 'src/service.ts': 'src/service.ts' };
            // PRODUCTION is true, so ifndef("PRODUCTION") → disabled
            variant.config.define = { PRODUCTION: true };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$classMacro')).toBe(true);
        });

        test('detects exported macro nested inside a class', async () => {
            const content = `
                export class Config {
                    static init() {
                        export const $$exportedNested = $$ifdef("RELEASE");
                    }
                }
            `;

            variant.dependencies = { 'src/config.ts': 'src/config.ts' };
            variant.config.define = { RELEASE: true };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.filesWithMacros.has('src/config.ts')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$exportedNested')).toBe(false);
        });

        test('handles deeply nested macros across multiple contexts', async () => {
            const content = `
                class Outer {
                    method() {
                        function inner() {
                            const $$deep = $$ifdef("DEEP");
                        }
                    }
                }
            `;

            variant.dependencies = { 'src/deep.ts': 'src/deep.ts' };
            variant.config.define = { DEEP: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$deep')).toBe(true);
        });
        test('skips macros in single-line comments', async () => {
            const content = '// const $$commented = $$ifdef("DEBUG");\nconst $$real = $$ifdef("DEBUG");';
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$commented')).toBe(false);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/test.ts')).toBe(true);
        });

        test('skips macros in multi-line comments', async () => {
            const content = '/* const $$commented = $$ifdef("DEBUG"); */\nconst $$real = $$ifdef("DEBUG");';
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$commented')).toBe(false);
        });

        test('skips macros inside JSDoc comment blocks', async () => {
            const content = `
                /**
                 * const $$docMacro = $$ifdef("DOC");
                 */
                const $$realMacro = $$ifdef("DEBUG");
            `;
            variant.dependencies = { 'src/jsdoc.ts': 'src/jsdoc.ts' };
            variant.config.define = { DOC: true, DEBUG: true };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$docMacro')).toBe(false);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/jsdoc.ts')).toBe(true);
        });

        test('generates warning for macro without $$ prefix', async () => {
            const content = 'const myMacro = $$ifdef("FEATURE");';
            variant.dependencies = { 'src/feature.ts': 'src/feature.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings!.length).toBe(1);
            expect(result.warnings![0].text).toContain('Macro function \'myMacro\' not start with \'$$\' prefix');
            expect(result.warnings![0].location?.file).toBe('src/feature.ts');
        });

        test('generates warning for exported macro without $$ prefix', async () => {
            const content = 'export const badName = $$ifdef("FEATURE");';
            variant.dependencies = { 'src/feature.ts': 'src/feature.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings!.length).toBe(1);
            expect(result.warnings![0].text).toContain('Macro function \'badName\' not start with \'$$\' prefix');
        });

        test('generates one warning per offending macro across multiple', async () => {
            const content = `
                const badA = $$ifdef("FEATURE_A");
                const badB = $$ifndef("FEATURE_B");
                const $$good = $$ifdef("FEATURE_C");
            `;

            variant.dependencies = { 'src/warn.ts': 'src/warn.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings!.length).toBe(2);
            expect(result.warnings!.map(w => w.text)).toEqual(
                expect.arrayContaining([
                    expect.stringContaining('badA'),
                    expect.stringContaining('badB')
                ])
            );
        });

        test('no warnings for correctly prefixed macros', async () => {
            const content = 'const $$good = $$ifdef("FEATURE");\nexport let $$alsoGood = $$ifndef("OTHER");';
            variant.dependencies = { 'src/good.ts': 'src/good.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            const result = await analyzeMacroMetadata(variant, context);

            expect(result.warnings).toEqual([]);
        });

        test('treats 0, empty string, and false as falsy defines', async () => {
            const content = [
                'const $$hasZero = $$ifdef("ZERO");',
                'const $$hasEmpty = $$ifdef("EMPTY_STRING");',
                'const $$hasFalse = $$ifdef("FALSE_VAL");'
            ].join('\n');

            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            variant.config.define = { ZERO: 0, EMPTY_STRING: '', FALSE_VAL: false };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasZero')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasEmpty')).toBe(true);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$hasFalse')).toBe(true);
        });

        test('handles missing define key as falsy', async () => {
            variant.dependencies = { 'src/test.ts': 'src/test.ts' };
            variant.config.define = { DEBUG: true };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: { text: 'const $$feature = $$ifdef("UNDEFINED_FEATURE");' }
            });

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$feature')).toBe(true);
        });

        test('tracks only files that contain macros', async () => {
            variant.dependencies = {
                'src/feature.ts': 'src/feature.ts',
                'src/utils.ts': 'src/utils.ts'
            };

            filesModel.getOrTouchFile.mockImplementation((file: string) => ({
                contentSnapshot: {
                    text: file === 'src/feature.ts'
                        ? 'const $$feature = $$ifdef("FEATURE");'
                        : 'const x = 1;'
                }
            }));

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.filesWithMacros.has('src/feature.ts')).toBe(true);
            expect(context.stage.defineMetadata.filesWithMacros.has('src/utils.ts')).toBe(false);
        });

        test('handles multiple macros across multiple files', async () => {
            variant.dependencies = {
                'src/a.ts': 'src/a.ts',
                'src/b.ts': 'src/b.ts'
            };

            variant.config.define = { FEAT_A: true, FEAT_B: false };

            filesModel.getOrTouchFile.mockImplementation((file: string) => ({
                contentSnapshot: {
                    text: file === 'src/a.ts'
                        ? 'const $$macroA = $$ifdef("FEAT_A");'
                        : 'const $$macroB = $$ifdef("FEAT_B");'
                }
            }));

            await analyzeMacroMetadata(variant, context);

            expect(context.stage.defineMetadata.disabledMacroNames.has('$$macroA')).toBe(false);
            expect(context.stage.defineMetadata.disabledMacroNames.has('$$macroB')).toBe(true);
        });

        test('correctly resolves file paths via filesModel.resolve', async () => {
            variant.dependencies = { 'relative/path.ts': 'relative/path.ts' };
            filesModel.getOrTouchFile.mockReturnValue({
                contentSnapshot: { text: 'const $$test = $$ifdef("TEST");' }
            });
            filesModel.resolve.mockReturnValue('absolute/relative/path.ts');

            await analyzeMacroMetadata(variant, context);

            expect(filesModel.resolve).toHaveBeenCalledWith('relative/path.ts');
            expect(context.stage.defineMetadata.filesWithMacros.has('absolute/relative/path.ts')).toBe(true);
        });

        test('resolve is called once per file, not once per macro match', async () => {
            const content = [
                'const $$a = $$ifdef("DEBUG");',
                'const $$b = $$ifdef("PRODUCTION");',
                'const $$c = $$ifndef("DEBUG");'
            ].join('\n');

            variant.dependencies = { 'src/multi.ts': 'src/multi.ts' };
            filesModel.getOrTouchFile.mockReturnValue({ contentSnapshot: { text: content } });

            await analyzeMacroMetadata(variant, context);

            expect(filesModel.resolve).toHaveBeenCalledTimes(1);
        });
    });
});
