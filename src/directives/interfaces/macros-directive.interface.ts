/**
 * Import will remove at compile time
 */

import type { SourceFile } from 'typescript';
import type { PartialMessage } from 'esbuild';
import type { MacrosStaeInterface } from '@directives/interfaces/analyze-directive.interface';

/**
 * Type alias for build-time definition values used in conditional compilation.
 *
 * @remarks
 * This type represents the structure of the `define` configuration object that controls
 * conditional macro behavior. Each key is a definition name referenced by `$$ifdef` or
 * `$$ifndef` macros, and the value determines whether the macro is included or excluded.
 *
 * **Value interpretation**:
 * - Truthy values (`true`, non-zero numbers, non-empty strings): Definition is considered "defined"
 * - Falsy values (`false`, `0`, `''`, `null`, `undefined`): Definition is considered "not defined"
 *
 * The values can be any type, but are typically booleans for clarity. JavaScript's truthiness
 * rules are applied when evaluating macro conditions.
 *
 * @example Basic boolean definitions
 * ```ts
 * const defines: DefinesType = {
 *   DEBUG: true,
 *   PRODUCTION: false,
 *   TEST: false
 * };
 * ```
 *
 * @example Mixed value types
 * ```ts
 * const defines: DefinesType = {
 *   DEBUG: true,
 *   LOG_LEVEL: 'info',        // Truthy (non-empty string)
 *   MAX_RETRIES: 3,            // Truthy (non-zero number)
 *   EXPERIMENTAL: 0,           // Falsy
 *   FEATURE_FLAG: undefined    // Falsy
 * };
 * ```
 *
 * @example Usage in configuration
 * ```ts
 * const config = {
 *   define: {
 *     DEBUG: process.env.NODE_ENV !== 'production',
 *     API_URL: process.env.API_URL || 'http://localhost:3000'
 *   }
 * };
 * ```
 *
 * @see {@link StateInterface.defines} for usage context
 * @see {@link isDefinitionMet} for condition evaluation logic
 *
 * @since 2.0.0
 */

export type DefinesType = Record<string, unknown>;

/**
 * Represents the complete state during macro transformation of a source file.
 *
 * @remarks
 * This interface encapsulates all data needed during AST traversal and macro transformation.
 * It provides:
 * - **Metadata access**: Build stage information including disabled macro names
 * - **Configuration**: Build-time definitions controlling conditional compilation
 * - **Source information**: TypeScript AST and original file content
 * - **Diagnostic collection**: Arrays for warnings and errors during transformation
 *
 * The state is passed through the entire transformation pipeline, allowing functions
 * to access configuration, collect diagnostics, and track the transformation process.
 *
 * **State lifecycle**:
 * 1. Created in {@link transformerDirective} with initial configuration
 * 2. Passed to {@link astProcess} for transformation
 * 3. Passed to individual node processors ({@link isVariableStatement}, {@link isCallExpression})
 * 4. Passed to macro transformers ({@link astInlineVariable}, {@link astDefineVariable})
 * 5. Diagnostics extracted and returned in the final result
 *
 * @example State initialization
 * ```ts
 * const state: StateInterface = {
 *   stage: stage as MacrosStaeInterface,
 *   defines: { DEBUG: true, PRODUCTION: false },
 *   sourceFile: languageService.getProgram()?.getSourceFile(path)!,
 *   contents: fileContents,
 *   errors: [],
 *   warnings: []
 * };
 * ```
 *
 * @example Collecting diagnostics during transformation
 * ```ts
 * function processNode(node: Node, state: StateInterface): void {
 *   if (isInvalidMacro(node)) {
 *     state.warnings.push({
 *       text: 'Invalid macro usage',
 *       location: getLocation(node, state.sourceFile)
 *     });
 *   }
 * }
 * ```
 *
 * @example Accessing definitions
 * ```ts
 * function shouldIncludeMacro(name: string, state: StateInterface): boolean {
 *   const value = state.defines[name];
 *   return name in state.defines && !!value;
 * }
 * ```
 *
 * @see {@link transformerDirective} for state creation
 * @see {@link astProcess} for state usage during transformation
 * @see {@link MacrosStaeInterface} for stage metadata structure
 *
 * @since 2.0.0
 */

export interface StateInterface {
    /**
     * The build stage containing macro analysis metadata.
     *
     * @remarks
     * Provides access to metadata collected during the analysis phase, including:
     * - Set of files containing macros
     * - Set of disabled macro names (based on definitions)
     *
     * This metadata is used to optimize transformation by skipping files without
     * macros and replacing disabled macro references with `undefined`.
     *
     * @see {@link MacrosStaeInterface} for metadata structure
     * @see {@link analyzeMacroMetadata} for metadata generation
     *
     * @since 2.0.0
     */

    stage: MacrosStaeInterface;

    /**
     * Array of error messages collected during transformation.
     *
     * @remarks
     * Contains partial esbuild messages representing errors that occurred during
     * macro processing. Common error sources include:
     * - Invalid macro syntax
     * - Runtime errors during inline code evaluation
     * - TypeScript compilation errors
     *
     * Errors are non-fatal during transformation but are reported in the final result
     * and may cause the build to fail.
     *
     * @example Adding an error
     * ```ts
     * state.errors.push({
     *   text: 'Cannot evaluate inline macro',
     *   location: { file: filePath, line: 42, column: 10 }
     * });
     * ```
     *
     * @since 2.0.0
     */

    errors: Array<PartialMessage>;

    /**
     * Build-time definitions controlling conditional macro inclusion.
     *
     * @remarks
     * A record mapping definition names to their values. Used by `$$ifdef` and `$$ifndef`
     * macros to determine whether code should be included in the build output.
     *
     * Typically sourced from `variant.config.define` in the build configuration.
     *
     * @example
     * ```ts
     * const state: StateInterface = {
     *   defines: {
     *     DEBUG: true,
     *     PRODUCTION: false,
     *     API_URL: 'https://api.example.com'
     *   },
     *   // ... other properties
     * };
     * ```
     *
     * @see {@link DefinesType} for type structure
     * @see {@link isDefinitionMet} for evaluation logic
     *
     * @since 2.0.0
     */

    defines: DefinesType;

    /**
     * Array of warning messages collected during transformation.
     *
     * @remarks
     * Contains partial esbuild messages representing non-fatal issues discovered
     * during macro processing. Common warning sources include:
     * - Macro names missing the `$$` prefix convention
     * - References to undefined functions in inline macros
     * - Deprecated macro patterns
     *
     * Warnings do not prevent successful transformation but indicate potential issues.
     *
     * @example Adding a warning
     * ```ts
     * state.warnings.push({
     *   text: `Function ${functionName} not found`,
     *   location: { file: filePath, line: 10, column: 5 }
     * });
     * ```
     *
     * @since 2.0.0
     */

    warnings: Array<PartialMessage>;

    /**
     * The current file content being transformed.
     *
     * @remarks
     * Contains the complete source file text. During transformation, this content
     * is modified by applying replacement operations. The final transformed content
     * is returned in the build result.
     *
     * Updated during the transformation process as macros are replaced with their
     * expanded or evaluated forms.
     *
     * @since 2.0.0
     */

    contents: string;

    /**
     * The TypeScript source file AST.
     *
     * @remarks
     * Provides the parsed Abstract Syntax Tree of the source file, used for:
     * - AST traversal to locate macro calls
     * - Text extraction from AST nodes
     * - Position calculation for diagnostics
     * - Source location mapping
     *
     * Obtained from TypeScript's language service and represents the current
     * state of the file in the compilation.
     *
     * @since 2.0.0
     */

    sourceFile: SourceFile;
}

/**
 * Represents a text substitution operation for macro replacement.
 *
 * @remarks
 * This interface defines a single replacement operation to be performed on source code
 * during macro transformation. Each substitution specifies:
 * - The region of text to replace (via start and end positions)
 * - The replacement text to insert
 *
 * Substitutions are collected during AST traversal and applied in reverse order
 * (from end to start) to avoid position invalidation as earlier replacements
 * are applied.
 *
 * **Position handling**:
 * - Positions are character offsets from the start of the file (0-based)
 * - `start` is inclusive (first character to replace)
 * - `end` is exclusive (one past the last character to replace)
 * - Region length: `end - start`
 *
 * **Application strategy**:
 * Replacements are sorted by `start` position in descending order before application,
 * ensuring that later positions are replaced first, preventing earlier replacements
 * from shifting positions of subsequent replacements.
 *
 * @example Basic substitution
 * ```ts
 * const subst: SubstInterface = {
 *   start: 50,  // Start of the macro call
 *   end: 85,    // End of macro call
 *   replacement: 'function $$debug() { return console.log; }'
 * };
 * ```
 *
 * @example Replacing a macro with undefined
 * ```ts
 * // Replace disabled macro reference
 * const subst: SubstInterface = {
 *   start: 120,
 *   end: 127,  // Length of '$$debug'
 *   replacement: 'undefined'
 * };
 * ```
 *
 * @example Multiple substitutions
 * ```ts
 * const replacements: SubstInterface[] = [
 *   { start: 100, end: 150, replacement: 'transformed1' },
 *   { start: 50, end: 80, replacement: 'transformed2' }
 * ];
 *
 * // Sort by start position (descending)
 * replacements.sort((a, b) => b.start - a.start);
 *
 * // Apply in reverse order
 * for (const subst of replacements) {
 *   content = content.slice(0, subst.start) +
 *             subst.replacement +
 *             content.slice(subst.end);
 * }
 * ```
 *
 * @see {@link isVariableStatement} for substitution creation
 * @see {@link astProcess} for substitution collection and application
 *
 * @since 2.0.0
 */

export interface SubstInterface {
    /**
     * The exclusive end position of the text region to replace.
     *
     * @remarks
     * Character offset representing one position past the last character to replace.
     * The character at this position is not included in the replacement.
     *
     * Obtained from `node.getEnd()` on the AST node being replaced.
     *
     * @since 2.0.0
     */

    end: number;

    /**
     * The inclusive start position of the text region to replace.
     *
     * @remarks
     * Character offset representing the first character to replace in the source text.
     * The character at this position is included in the replacement.
     *
     * Obtained from `node.getStart(sourceFile)` on the AST node being replaced.
     *
     * @since 2.0.0
     */

    start: number;

    /**
     * The replacement text to insert at the specified position.
     *
     * @remarks
     * The complete text that will replace the region defined by `start` and `end`.
     * Can be:
     * - Transformed macro code (function declarations, constants)
     * - Evaluated inline results
     * - The string `'undefined'` for disabled macros
     * - Empty string for removed macros
     *
     * @example
     * ```ts
     * replacement: 'function $$debug() { return console.log; }'
     * replacement: 'undefined'
     * replacement: 'export const API_URL = "https://api.example.com";'
     * replacement: ''
     * ```
     *
     * @since 2.0.0
     */

    replacement: string;
}
