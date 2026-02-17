/**
 * Import will remove at compile time
 */

import type { VariantService } from '@services/variant.service';
import type { PartialMessage, Location, OnLoadResult } from 'esbuild';
import type { BuildContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { MacrosMetadataInterface } from '@directives/interfaces/analyze-directive.interface';

/**
 * Imports
 */

import { inject } from '@symlinks/symlinks.module';
import { FilesModel } from '@typescript/models/files.model';

/**
 * Constants
 */

const MACRO_PREFIX = '$$';
const IFDEF_REGEX = /(?:(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*)?\$\$(ifdef|ifndef|inline)\s*\(\s*(?:['"]([^'"]+)['"])?/g;

/**
 * Calculates the line and column position of a macro name within source text.
 *
 * @param text - The complete source file content
 * @param name - The macro name to locate
 * @param file - The file path for location reporting
 * @param index - The starting index in the text where the match was found
 * @returns A partial {@link Location} object containing file, line, and column information
 *
 * @remarks
 * Line numbers are 1-based. The column is calculated relative to the match index.
 * This function is primarily used for generating accurate diagnostic messages.
 *
 * @example
 * ```ts
 * const sourceCode = 'import x from "y";\nconst $$myMacro = $$ifdef("DEBUG");';
 * const macroIndex = sourceCode.indexOf('$$myMacro');
 *
 * const location = getLineAndColumn(sourceCode, '$$myMacro', 'src/app.ts', macroIndex);
 * console.log(location);
 * // Output: {
 * //   file: 'src/app.ts',
 * //   line: 2,
 * //   column: 6
 * // }
 * ```
 *
 * @example Multi-line file positioning
 * ```ts
 * const code = [
 *   'const x = 1;',
 *   'const y = 2;',
 *   'const $$feature = $$ifdef("FEATURE_X");'
 * ].join('\n');
 *
 * const index = code.indexOf('$$feature');
 * const loc = getLineAndColumn(code, '$$feature', 'config.ts', index);
 * // loc.line === 3
 * ```
 *
 * @see {@link Location}
 * @since 2.0.0
 */

export function getLineAndColumn(text: string, name: string, file: string, index: number): Partial<Location> {
    let line = 1;
    for (let i = 0; i < index; i++) {
        if (text[i] === '\n') {
            line++;
        }
    }

    return {
        file,
        line,
        column: text.indexOf(name, index) - index
    };
}

/**
 * Determines whether a given position in source code is within a comment.
 *
 * @param content - The complete source file content
 * @param index - The position to check
 * @returns `true` if the position is within a single-line (`//`), multi-line (`\/* *\/`), or JSDoc comment, otherwise `false`
 *
 * @remarks
 * Scans backward from the given index to the start of the line, skipping whitespace.
 * Checks if the first non-whitespace characters form a comment start sequence.
 * This is used to avoid processing macros that appear in comments.
 *
 * @example Single-line comment detection
 * ```ts
 * const code = '// const $$debug = $$ifdef("DEBUG");\nconst $$prod = $$ifdef("PROD");';
 *
 * const debugIndex = code.indexOf('$$debug');
 * console.log(isCommentLine(code, debugIndex)); // true
 *
 * const prodIndex = code.indexOf('$$prod');
 * console.log(isCommentLine(code, prodIndex)); // false
 * ```
 *
 * @example Multi-line comment detection
 * ```ts
 * const code = `/*
 *  * const $$feature = $$ifdef("FEATURE");
 *  *\/
 * const $$active = $$ifdef("ACTIVE");`;
 *
 * const featureIndex = code.indexOf('$$feature');
 * console.log(isCommentLine(code, featureIndex)); // true
 *
 * const activeIndex = code.indexOf('$$active');
 * console.log(isCommentLine(code, activeIndex)); // false
 * ```
 *
 * @example Indented code
 * ```ts
 * const code = '    // Commented macro\n    const $$real = $$ifdef("REAL");';
 * const index = code.indexOf('// Commented');
 * console.log(isCommentLine(code, index)); // true
 * ```
 *
 * @since 2.0.0
 */

export function isCommentLine(content: string, index: number): boolean {
    let lineStart = content.lastIndexOf('\n', index - 1) + 1;
    while (lineStart < index && (content[lineStart] === ' ' || content[lineStart] === '\t')) {
        lineStart++;
    }

    if (lineStart >= index) return false;
    const char1 = content[lineStart];
    const char2 = content[lineStart + 1];

    return (char1 === '/' && (char2 === '/' || char2 === '*')) || char1 === '*';
}

/**
 * Analyzes all project files for macro usage and generates metadata about disabled macros.
 *
 * @param variant - The current build variant containing define configurations
 * @param context - The build context to store metadata and configuration
 * @returns A promise resolving to an {@link AnalyzerMessageInterface} containing any warnings
 *
 * @remarks
 * Scans all entry point dependencies for `$$ifdef` and `$$ifndef` macro declarations.
 * Determines which macros should be disabled based on the variant's definition configuration.
 * Generates warnings for macros that don't follow the `$$` naming convention.
 * Stores results in `context.stage.defineMetadata` for use during the build process.
 *
 * @example Basic macro analysis with definitions
 * ```ts
 * const variant = {
 *   config: {
 *     define: {
 *       DEBUG: true,
 *       PRODUCTION: false
 *     }
 *   }
 * };
 *
 * const context = {
 *   build: {
 *     initialOptions: {
 *       entryPoints: ['src/index.ts']
 *     }
 *   },
 *   stage: {}
 * };
 *
 * const result = await analyzeMacroMetadata(variant, context);
 *
 * // context.stage.defineMetadata now contains:
 * // {
 * //   disabledMacroNames: Set(['$$noProd']),  // from $$ifndef('PRODUCTION')
 * //   filesWithMacros: Set(['src/index.ts', 'src/config.ts'])
 * // }
 *
 * console.log(result.warnings); // Array of warnings for improperly named macros
 * ```
 *
 * @example Handling ifdef vs. ifndef
 * ```ts
 * // the Source file contains:
 * // const $$hasDebug = $$ifdef('DEBUG'); // enabled when DEBUG=true
 * // const $$noDebug = $$ifndef('DEBUG'); // enabled when DEBUG=false
 *
 * const variant = {
 *   config: {
 *     define: { DEBUG: true }
 *   }
 * };
 *
 * await analyzeMacroMetadata(variant, context);
 * // disabledMacroNames will contain: Set(['$$noDebug'])
 * ```
 *
 * @example Warning generation for invalid macro names
 * ```ts
 * // Source contains: const myMacro = $$ifdef('FEATURE');
 * // (missing $$ prefix)
 *
 * const result = await analyzeMacroMetadata(variant, context);
 *
 * console.log(result.warnings);
 * // [{
 * //   text: "Macro function 'myMacro' not start with '$$' prefix to avoid conflicts",
 * //   location: { file: 'src/feature.ts', line: 10, column: 6 }
 * // }]
 * ```
 *
 * @see {@link MacrosMetadataInterface}
 *
 * @since 2.0.0
 */

export async function analyzeMacroMetadata(variant: VariantService, context: BuildContextInterface): Promise<OnLoadResult> {
    const metadata: MacrosMetadataInterface = { disabledMacroNames: new Set(), filesWithMacros: new Set() };
    context.stage.defineMetadata = metadata;
    const warnings: Array<PartialMessage> = [];

    const filesModel = inject(FilesModel);
    const defines = variant.config.define ?? {};

    const files = Object.values(variant.dependencies ?? {});
    if(!files) return Promise.resolve({ warnings });
    for (const file of files) {
        const snapshot = filesModel.getOrTouchFile(file);
        const content = snapshot?.contentSnapshot?.text;
        if (!content) continue;

        IFDEF_REGEX.lastIndex = 0;
        for (const match of content.matchAll(IFDEF_REGEX)) {
            if (isCommentLine(content, match.index!)) continue;
            metadata.filesWithMacros.add(filesModel.resolve(file));

            const [ , fn, directive, define ] = match;
            if(!fn) continue;

            const isDefined = define in defines && !!defines[define];
            if ((directive === 'ifndef') === isDefined) {
                metadata.disabledMacroNames.add(fn);
            }

            if (!fn.startsWith(MACRO_PREFIX)) {
                warnings.push({
                    text: `Macro function '${ fn }' not start with '${ MACRO_PREFIX }' prefix to avoid conflicts`,
                    location: getLineAndColumn(content, fn, file, match.index!)
                });
            }
        }
    }

    return { warnings };
}
