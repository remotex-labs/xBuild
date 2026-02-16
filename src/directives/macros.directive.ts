/**
 * Import will remove at compile time
 */

import type { OnLoadResult } from 'esbuild';
import type { VariantService } from '@services/variant.service';
import type { CallExpression, VariableStatement, ExpressionStatement } from 'typescript';
import type { MacrosStaeInterface } from '@directives/interfaces/analyze-directive.interface';
import type { LoadContextInterface } from '@providers/interfaces/lifecycle-provider.interface';
import type { SubstInterface, StateInterface } from '@directives/interfaces/macros-directive.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { astDefineVariable, astDefineCallExpression } from '@directives/define.directive';
import { astInlineCallExpression, astInlineVariable } from '@directives/inline.directive';

/**
 * Regular expression matching TypeScript and JavaScript file extensions.
 *
 * @remarks
 * Used to filter files that should undergo macro transformation. Only files
 * with `.ts` or `.js` extensions are processed by the transformer directive.
 *
 * @since 2.0.0
 */

const TS_JS_REGEX = /\.(ts|js)$/;

/**
 * Array of recognized macro function names for conditional compilation and inline evaluation.
 *
 * @remarks
 * Defines the complete set of macro directives supported by xBuild:
 * - `$$ifdef`: Conditional inclusion when definition is truthy
 * - `$$ifndef`: Conditional inclusion when definition is falsy or undefined
 * - `$$inline`: Runtime code evaluation during build time
 *
 * Used for:
 * - Validating macro calls during AST traversal
 * - Determining argument count requirements
 * - Filtering disabled macro references
 *
 * @since 2.0.0
 */

const MACRO_FUNCTIONS = [ '$$ifdef', '$$ifndef', '$$inline' ];

/**
 * Processes variable statements containing macro calls and adds replacements to the replacement set.
 *
 * @param node - The variable statement node to process
 * @param replacements - Set of code replacements to populate
 * @param state - The macro transformation state containing definitions and source file
 *
 * @returns A promise that resolves when all variable declarations have been processed
 *
 * @remarks
 * This function handles macro variable declarations of the form:
 * ```ts
 * const $$myFunc = $$ifdef('DEFINITION', callback);
 * export const $$inline = $$inline(() => computeValue());
 * let $$feature = $$ifndef('PRODUCTION', devFeature);
 * ```
 *
 * The processing flow:
 * 1. Iterates through all variable declarations in the statement
 * 2. Validates that the initializer is a macro call expression
 * 3. Checks that the macro function name is recognized
 * 4. Validates argument count (2 for ifdef/ifndef, 1 for inline)
 * 5. Detects export modifiers to preserve in the output
 * 6. Delegates to the appropriate transformer based on macro type
 * 7. Adds successful transformations to the replacement set
 *
 * **Macro type routing**:
 * - `$$inline`: Delegates to {@link astInlineVariable} (async evaluation)
 * - `$$ifdef`/`$$ifndef`: Delegates to {@link astDefineVariable} (conditional inclusion)
 *
 * Replacements track the start and end positions of the original statement
 * for accurate text substitution during the final transformation pass.
 *
 * @example Processing conditional macro
 * ```ts
 * // Source: const $$debug = $$ifdef('DEBUG', () => console.log);
 * // With: { DEBUG: true }
 * await isVariableStatement(node, replacements, state);
 * // replacements contains: {
 * //   start: 0,
 * //   end: 52,
 * //   replacement: 'function $$debug() { return console.log; }'
 * // }
 * ```
 *
 * @example Processing inline macro
 * ```ts
 * // Source: export const API_URL = $$inline(() => process.env.API);
 * await isVariableStatement(node, replacements, state);
 * // replacements contains: {
 * //   start: 0,
 * //   end: 59,
 * //   replacement: 'export const API_URL = undefined;'
 * // }
 * ```
 *
 * @example Invalid macro (skipped)
 * ```ts
 * // Source: const $$bad = $$ifdef('DEV'); // Missing callback argument
 * await isVariableStatement(node, replacements, state);
 * // No replacement added (insufficient arguments)
 * ```
 *
 * @see {@link astProcess} for the calling context
 * @see {@link astInlineVariable} for inline macro transformation
 * @see {@link astDefineVariable} for conditional macro transformation
 *
 * @since 2.0.0
 */

export async function isVariableStatement(node: VariableStatement, replacements: Set<SubstInterface>, state: StateInterface): Promise<void> {
    for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression)) continue;

        const fnName = init.expression.text;
        if (!MACRO_FUNCTIONS.includes(fnName)) continue;

        const argsCount = fnName == MACRO_FUNCTIONS[2] ? 1 : 2;
        if(!MACRO_FUNCTIONS.includes(fnName)) return;
        if (init.arguments.length < argsCount || init.arguments.length > argsCount) {
            throw new Error(`Invalid macro call: ${ fnName } with ${ init.arguments.length } arguments`);

            // replacements.add({
            //     replacement: 'undefined',
            //     end: node.getEnd(),
            //     start: node.getStart(state.sourceFile)
            // });
            //
            // return;
        }

        const hasExport =
            node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

        let replacement: string | false = false;
        if (fnName === MACRO_FUNCTIONS[2]) replacement = await astInlineVariable(decl, node, init, hasExport, state);
        else replacement = astDefineVariable(decl, init, hasExport, state);

        if (replacement !== false) {
            replacements.add({
                replacement,
                end: node.getEnd(),
                start: node.getStart(state.sourceFile)
            });
        }
    }
}

/**
 * Processes standalone macro call expressions and adds replacements to the replacement set.
 *
 * @param node - The expression statement containing the macro call
 * @param replacements - Set of code replacements to populate
 * @param state - The macro transformation state containing definitions and source file
 *
 * @returns A promise that resolves when the expression has been processed
 *
 * @remarks
 * This function handles standalone macro calls that appear as expression statements:
 * ```ts
 * $$ifdef('DEBUG', () => console.log('debug'));
 * $$inline(() => initialize());
 * ```
 *
 * The processing flow:
 * 1. Validates that the expression is a macro call with identifier
 * 2. Checks that the macro function name is recognized
 * 3. Validates argument count (2 for ifdef/ifndef, 1 for inline)
 * 4. Delegates to the appropriate transformer based on macro type
 * 5. Adds successful transformations to the replacement set
 *
 * **Macro type routing**:
 * - `$$inline`: Delegates to {@link astInlineCallExpression} (async evaluation)
 * - `$$ifdef`/`$$ifndef`: Delegates to {@link astDefineCallExpression} (conditional inclusion)
 *
 * **Note**: The define call expression handler currently doesn't return a replacement
 * (returns `false` implicitly), so only inline macros result in replacements at this level.
 *
 * @example Processing inline call
 * ```ts
 * // Source: $$inline(() => configureApp());
 * await isCallExpression(node, replacements, state);
 * // replacements contains: {
 * //   start: 0,
 * //   end: 35,
 * //   replacement: 'undefined'
 * // }
 * ```
 *
 * @example Processing conditional call
 * ```ts
 * // Source: $$ifdef('DEBUG', () => enableDebugMode());
 * await isCallExpression(node, replacements, state);
 * // No replacement added (define expressions handle differently)
 * ```
 *
 * @see {@link astProcess} for the calling context
 * @see {@link astInlineCallExpression} for inline macro transformation
 * @see {@link astDefineCallExpression} for conditional macro transformation
 *
 * @since 2.0.0
 */

export async function isCallExpression(
    node: ExpressionStatement, replacements: Set<SubstInterface>, state: StateInterface
): Promise<void> {
    const callExpr = <CallExpression>node.expression;
    if (!ts.isIdentifier(callExpr.expression)) return;

    const fnName = callExpr.expression.text;
    const argsCount = fnName == MACRO_FUNCTIONS[2] ? 1 : 2;
    if(!MACRO_FUNCTIONS.includes(fnName)) return;
    if (callExpr.arguments.length < argsCount || callExpr.arguments.length > argsCount) {
        throw new Error(`Invalid macro call: ${ fnName } with ${ callExpr.arguments.length } arguments`);
        // replacements.add({
        //     replacement: 'undefined',
        //     end: node.getEnd(),
        //     start: node.getStart(state.sourceFile)
        // });
        //
        // return;
    }

    let replacement: string | false = false;
    if (fnName == MACRO_FUNCTIONS[2]) replacement = await astInlineCallExpression(callExpr.arguments, state);
    else replacement = astDefineCallExpression(callExpr.arguments, fnName, state);

    if (replacement !== false) {
        replacements.add({
            replacement,
            end: node.getEnd(),
            start: node.getStart(state.sourceFile)
        });
    }
}

/**
 * Recursively traverses the AST to find and transform all macro occurrences in the source file.
 *
 * @param state - The macro transformation state containing source file, definitions, and content
 *
 * @returns A promise resolving to the transformed source code with all macro replacements applied
 *
 * @remarks
 * This is the main transformation function that orchestrates macro processing across the entire
 * source file. It performs a recursive AST traversal to locate and transform different macro patterns:
 *
 * **Macro patterns handled**:
 * 1. **Variable statements**: `const $$x = $$ifdef(...)` or `const x = $$inline(...)`
 * 2. **Expression statements**: Standalone `$$ifdef(...)` or `$$inline(...)` calls
 * 3. **Nested inline calls**: `$$inline(...)` within other expressions (not variable/expression statements)
 * 4. **Disabled macro calls**: Calls to macros marked as disabled in metadata
 * 5. **Disabled macro identifiers**: References to disabled macro names (replaced with `undefined`)
 *
 * **Processing algorithm**:
 * 1. Creates a set to collect all code replacements
 * 2. Retrieves the set of disabled macro names from metadata
 * 3. Recursively visits all AST nodes in depth-first order
 * 4. For each node type, applies appropriate transformation logic
 * 5. Collects all replacements with their positions
 * 6. Sorts replacements by position (reverse order for safe text replacement)
 * 7. Applies replacements sequentially to the source content
 *
 * **Replacement strategy**:
 * - Sorts replacements from end to start to avoid position invalidation
 * - Uses string slicing for efficient text replacement
 * - Preserves source text outside macro regions unchanged
 *
 * @example Complete transformation
 * ```ts
 * // Original source:
 * const $$debug = $$ifdef('DEBUG', () => console.log);
 * const value = $$inline(() => 42);
 * $$debug();
 *
 * // With definitions: { DEBUG: false }
 * const result = await astProcess(state);
 *
 * // Transformed result:
 * const value = undefined;
 * undefined();
 * ```
 *
 * @example Handling disabled macros
 * ```ts
 * // Original source (with DEBUG=false):
 * const $$debug = $$ifdef('DEBUG', log);
 * if ($$debug) $$debug();
 *
 * // After processing:
 * if (undefined) undefined();
 * ```
 *
 * @example No macros (short circuit)
 * ```ts
 * const state = { contents: 'const x = 1;', sourceFile, ... };
 * const result = await astProcess(state);
 * // Returns original content unchanged
 * ```
 *
 * @see {@link astInlineCallExpression} for nested inline calls
 * @see {@link isCallExpression} for expression statement handling
 * @see {@link isVariableStatement} for variable declaration handling
 *
 * @since 2.0.0
 */

export async function astProcess(state: StateInterface): Promise<string> {
    const replacements: Set<SubstInterface> = new Set();
    const fnToRemove = state.stage.defineMetadata.disabledMacroNames;

    const visit = async (node: ts.Node): Promise<void> => {
        if (ts.isVariableStatement(node)) {
            await isVariableStatement(node, replacements, state);
        } else if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
            await isCallExpression(node, replacements, state);
        } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === MACRO_FUNCTIONS[2]) {
            const parent = node.parent;
            if (!parent || (!ts.isVariableDeclaration(parent) && !ts.isExpressionStatement(parent))) {
                const replacement = await astInlineCallExpression(node.arguments, state);
                if (replacement !== false) {
                    replacements.add({
                        replacement,
                        end: node.getEnd(),
                        start: node.getStart(state.sourceFile)
                    });
                }
            }
        } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && fnToRemove.has(node.expression.text)) {
            replacements.add({ start: node.getStart(state.sourceFile), end: node.getEnd(), replacement: 'undefined' });
        } else if (ts.isIdentifier(node) && fnToRemove.has(node.text)) {
            const parent = node.parent;
            const parentText = parent?.getText(state.sourceFile);

            if (!parent || !ts.isCallExpression(parent) || parent.expression !== node) {
                if (!parentText || MACRO_FUNCTIONS.every(key => !parentText.includes(key))) {
                    replacements.add({
                        start: node.getStart(state.sourceFile),
                        end: node.getEnd(),
                        replacement: 'undefined'
                    });
                }
            }
        }

        const children = node.getChildren(state.sourceFile);
        for (const child of children) {
            await visit(child);
        }
    };

    await visit(state.sourceFile);

    if (replacements.size === 0) return state.contents;
    const replacementsArray = Array.from(replacements);
    replacementsArray.sort((a, b) => b.start - a.start);

    for (const { start, end, replacement } of replacementsArray) {
        state.contents = state.contents.slice(0, start) + replacement + state.contents.slice(end);
    }

    return state.contents;
}

/**
 * Main transformer directive that processes macro transformations for a build variant.
 *
 * @param variant - The build variant service containing configuration and TypeScript services
 * @param context - The load context containing file information, loader type, and build stage
 *
 * @returns A promise resolving to the transformed file result with processed macros, warnings, and errors
 *
 * @remarks
 * This is the entry point for macro transformation during the build process, integrated as
 * an esbuild plugin loader. It orchestrates the complete transformation pipeline:
 *
 * **Transformation pipeline**:
 * 1. **File filtering**: Validates file extension and content length
 * 2. **Source file acquisition**: Retrieves or creates TypeScript source file
 * 3. **State initialization**: Prepares transformation state with definitions and metadata
 * 4. **Macro processing**: Applies AST transformations via {@link astProcess}
 * 5. **Alias resolution**: Resolves TypeScript path aliases for non-bundled builds
 * 6. **Result assembly**: Returns transformed content with diagnostics
 *
 * **Early exits**:
 * - Non-TypeScript/JavaScript files: Returns content unchanged
 * - Empty files: Returns content unchanged
 * - Files without macros: Processes but no transformations occur
 *
 * **Alias resolution**:
 * When not bundling (`variant.config.esbuild.bundle === false`), path aliases are
 * resolved to relative paths with `.js` extensions for proper module resolution.
 *
 * **Source file handling**:
 * If the source file isn't in the language service program, it's touched (loaded)
 * to ensure the TypeScript compiler has current file information.
 *
 * @example Basic transformation flow
 * ```ts
 * const context = {
 *   args: { path: 'src/index.ts' },
 *   loader: 'ts',
 *   stage: { defineMetadata: { ... } },
 *   contents: 'const $$debug = $$ifdef("DEBUG", log);'
 * };
 *
 * const result = await transformerDirective(variant, context);
 * // result.contents: transformed code
 * // result.warnings: macro warnings
 * // result.errors: transformation errors
 * ```
 *
 * @example Non-TypeScript file (skipped)
 * ```ts
 * const context = {
 *   args: { path: 'styles.css' },
 *   loader: 'css',
 *   contents: '.class { color: red; }'
 * };
 *
 * const result = await transformerDirective(variant, context);
 * // result.contents === original content (unchanged)
 * ```
 *
 * @example With alias resolution
 * ```ts
 * // Source contains: import { utils } from '@utils/helpers';
 * // Non-bundled build
 * const result = await transformerDirective(variant, context);
 * // Import resolved: import { utils } from './utils/helpers.js';
 * ```
 *
 * @see {@link astProcess} for macro transformation logic
 * @see {@link LanguageHostService.resolveAliases} for alias resolution
 * @see {@link LoadContextInterface} for context structure
 *
 * @since 2.0.0
 */

export async function transformerDirective(variant: VariantService, context: LoadContextInterface): Promise<OnLoadResult | undefined> {
    const { args, loader, stage, contents } = context;
    if (args.path.includes('node_modules')) return;

    if (contents.length < 1) return;
    if (!TS_JS_REGEX.test(args.path)) return;

    const languageService = variant.typescript.languageService;
    const sourceFile = languageService.getProgram()?.getSourceFile(args.path);
    if (!sourceFile) return;

    let content = contents.toString();
    const state: StateInterface = {
        stage: stage as MacrosStaeInterface,
        errors: [],
        contents: content,
        warnings: [],
        defines: variant.config.define ?? {},
        sourceFile: sourceFile!
    };

    if (sourceFile) {
        content = await astProcess(state);
    }

    if (!variant.config.esbuild.bundle) {
        const alias = variant.typescript.languageHostService.aliasRegex;
        if (alias) {
            content = variant.typescript.languageHostService.resolveAliases(content, args.path, '.js');
        }
    }

    return { loader, contents: content, warnings: state.warnings, errors: state.errors };
}
