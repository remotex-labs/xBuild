/**
 * Type imports (removed at compile time)
 */

import type { VariableDeclaration, CallExpression } from 'typescript';
import type { DefinesType, StateInterface } from './interfaces/macros-directive.interface';
import type { SourceFile, Node, NodeArray, Expression, ArrowFunction, FunctionExpression } from 'typescript';

/**
 * Imports
 */

import ts from 'typescript';

/**
 * The name of the conditional inclusion directive for checking if a definition is truthy.
 *
 * @remarks
 * Used to identify `$$ifdef` macro calls in the AST. Paired with `$$ifndef` (not-defined check),
 * this directive enables conditional compilation based on build-time definitions.
 *
 * @see {@link isDefinitionMet} for condition evaluation logic
 *
 * @since 2.0.0
 */

const IFDEF_DIRECTIVE = '$$ifdef';

/**
 * Transforms an AST node into a function declaration or constant assignment.
 *
 * @param fnName - The name for the generated function or constant
 * @param node - The AST node to transform (typically a function or expression)
 * @param sourceFile - The source file containing the node (for text extraction)
 * @param hasExport - Whether to prepend `export` keyword; defaults to `false`
 *
 * @returns A string containing the transformed function declaration or constant assignment
 *
 * @remarks
 * This function handles transformation for conditional macro definitions by converting
 * the macro's callback argument into a named function or constant. The transformation
 * strategy depends on the node type:
 *
 * **For function-like nodes** (arrow functions and function expressions):
 * - Extracts parameters, return type, and body
 * - Generates a proper function declaration
 * - Preserves type annotations if present
 *
 * **For other node types** (expressions, literals, etc.):
 * - Generates a constant assignment
 * - Uses the node's text representation as the value
 *
 * The `hasExport` parameter controls whether the generated declaration is exported,
 * preserving the original export status of the macro variable.
 *
 * @example Arrow function transformation
 * ```ts
 * // Source: const $$debug = $$ifdef('DEBUG', () => console.log);
 * const node = arrowFunctionNode; // () => console.log
 * const result = transformToFunction('$$debug', node, sourceFile, false);
 * // 'function $$debug() { return console.log; }'
 * ```
 *
 * @example Function expression with types
 * ```ts
 * // Source: export const $$getConfig = $$ifdef('DEV', function(): Config { return devConfig; });
 * const result = transformToFunction('$$getConfig', node, sourceFile, true);
 * // 'export function $$getConfig(): Config { return devConfig; }'
 * ```
 *
 * @example Non-function transformation
 * ```ts
 * // Source: const $$apiUrl = $$ifdef('PROD', 'https://api.example.com');
 * const node = stringLiteralNode;
 * const result = transformToFunction('$$apiUrl', node, sourceFile, false);
 * // 'const $$apiUrl = "https://api.example.com";'
 * ```
 *
 * @see {@link astDefineVariable} for the calling context
 * @see {@link transformFunctionLikeNode} for function-specific transformation
 *
 * @since 2.0.0
 */

export function transformToFunction(fnName: string, node: Node, sourceFile: SourceFile, hasExport = false): string {
    const prefix = hasExport ? 'export function ' : 'function ';
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
        return transformFunctionLikeNode(fnName, node, sourceFile, prefix);

    // Fallback for other node types
    const constPrefix = hasExport ? 'export const ' : 'const ';

    return `${ constPrefix }${ fnName } = ${ node.getText(sourceFile) };`;
}

/**
 * Transforms arrow functions and function expressions into proper function declarations.
 *
 * @param fnName - The name for the generated function
 * @param node - The arrow function or function expression to transform
 * @param sourceFile - The source file containing the node
 * @param prefix - The declaration prefix (e.g., `'function '` or `'export function '`)
 *
 * @returns A string containing the function declaration
 *
 * @remarks
 * This function extracts the components of a function-like node and reconstructs them
 * as a proper function declaration:
 * - **Parameters**: Extracted with full type annotations
 * - **Return type**: Preserved if present in the original
 * - **Body**: Transformed using {@link getFunctionBody} to handle arrow function syntax
 *
 * The transformation preserves all type information, making it suitable for TypeScript
 * projects that rely on type safety in conditional compilation scenarios.
 *
 * @example Arrow function with return type
 * ```ts
 * const node = parseExpression('(x: number): number => x * 2');
 * const result = transformFunctionLikeNode('double', node, sourceFile, 'export function ');
 * // 'export function double(x: number): number { return x * 2; }'
 * ```
 *
 * @example Function expression without types
 * ```ts
 * const node = parseExpression('function(a, b) { return a + b; }');
 * const result = transformFunctionLikeNode('add', node, sourceFile, 'function ');
 * // 'function add(a, b) { return a + b; }'
 * ```
 *
 * @see {@link getFunctionBody} for body extraction
 * @see {@link transformToFunction} for the calling context
 *
 * @since 2.0.0
 */

function transformFunctionLikeNode(
    fnName: string, node: ArrowFunction | FunctionExpression, sourceFile: SourceFile, prefix: string
): string {
    const params = node.parameters.map(p => p.getText(sourceFile)).join(', ');
    const returnType = node.type ? `: ${ node.type.getText(sourceFile) }` : '';
    const body = getFunctionBody(node, sourceFile);

    return `${ prefix }${ fnName }(${ params })${ returnType } ${ body }`;
}

/**
 * Extracts and formats the function body, handling arrow function shorthand syntax.
 *
 * @param node - The arrow function or function expression to extract from
 * @param sourceFile - The source file containing the node
 *
 * @returns The formatted function body as a string
 *
 * @remarks
 * This function handles two body formats:
 * - **Block body**: Returns as-is (already wrapped in `{}`)
 * - **Expression body**: Wraps in block with `return` statement
 *
 * This ensures that all transformed functions have proper block bodies,
 * which is necessary for function declarations (they cannot have expression bodies).
 *
 * @example Arrow function with expression body
 * ```ts
 * const node = parseExpression('() => 42');
 * const body = getFunctionBody(node, sourceFile);
 * // '{ return 42; }'
 * ```
 *
 * @example Arrow function with block body
 * ```ts
 * const node = parseExpression('() => { console.log("test"); return 42; }');
 * const body = getFunctionBody(node, sourceFile);
 * // '{ console.log("test"); return 42; }'
 * ```
 *
 * @example Function expression (always has block body)
 * ```ts
 * const node = parseExpression('function() { return true; }');
 * const body = getFunctionBody(node, sourceFile);
 * // '{ return true; }'
 * ```
 *
 * @see {@link transformFunctionLikeNode} for the calling context
 *
 * @since 2.0.0
 */

function getFunctionBody(node: ArrowFunction | FunctionExpression, sourceFile: SourceFile): string {
    const bodyText = node.body.getText(sourceFile);
    if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) {
        return `{ return ${ bodyText }; }`;
    }

    return bodyText;
}

/**
 * Transforms an AST node into an Immediately Invoked Function Expression (IIFE).
 *
 * @param node - The AST node to transform
 * @param sourceFile - The source file containing the node
 *
 * @returns A string containing the IIFE expression
 *
 * @remarks
 * This function wraps code in IIFE syntax for immediate execution in expression contexts.
 * The transformation strategy depends on the node type:
 *
 * **For function-like nodes** (arrow functions and function expressions):
 * - Wraps directly: `(function)()` or `(() => value)()`
 * - Preserves the function as-is
 *
 * **For other node types** (expressions, statements):
 * - Wraps in an arrow function IIFE with explicit return
 * - Ensures the value is returned for use in expressions
 *
 * Used when conditional macros appear in expression contexts where a function
 * declaration is not valid syntax.
 *
 * @example Arrow function to IIFE
 * ```ts
 * const node = parseExpression('() => 42');
 * const result = transformToIIFE(node, sourceFile);
 * // '(() => 42)()'
 * ```
 *
 * @example Function expression to IIFE
 * ```ts
 * const node = parseExpression('function() { return "hello"; }');
 * const result = transformToIIFE(node, sourceFile);
 * // '(function() { return "hello"; })()'
 * ```
 *
 * @example Expression to IIFE
 * ```ts
 * const node = parseExpression('1 + 1');
 * const result = transformToIIFE(node, sourceFile);
 * // '(() => { return 1 + 1; })()'
 * ```
 *
 * @see {@link astDefineCallExpression} for the calling context
 *
 * @since 2.0.0
 */

export function transformToIIFE(node: Node, sourceFile: SourceFile): string {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return `(${ node.getText(sourceFile) })()`;
    }

    return `(() => { return ${ node.getText(sourceFile) }; })()`;
}

/**
 * Determines whether a conditional macro definition should be included based on build definitions.
 *
 * @param defineName - The definition name to check (e.g., `'DEBUG'`, `'PRODUCTION'`)
 * @param directiveName - The directive name (`'$$ifdef'` or `'$$ifndef'`)
 * @param defines - The build definitions object mapping names to boolean values
 *
 * @returns `true` if the definition condition is met, `false` otherwise
 *
 * @remarks
 * This function implements the core conditional logic for `$$ifdef` and `$$ifndef` macros:
 *
 * **For `$$ifdef`** (if defined):
 * - Returns `true` when the definition exists and is truthy
 * - Returns `false` when the definition is missing, `false`, `0`, `''`, etc.
 *
 * **For `$$ifndef`** (if not defined):
 * - Returns `true` when the definition is missing or falsy
 * - Returns `false` when the definition exists and is truthy
 *
 * The check uses JavaScript's truthiness rules via `!!defines[defineName]`.
 *
 * @example `$$ifdef` with true definition
 * ```ts
 * const defines = { DEBUG: true, PRODUCTION: false };
 * isDefinitionMet('DEBUG', '$$ifdef', defines); // true
 * isDefinitionMet('PRODUCTION', '$$ifdef', defines); // false
 * ```
 *
 * @example `$$ifndef` with false definition
 * ```ts
 * const defines = { DEBUG: true, PRODUCTION: false };
 * isDefinitionMet('DEBUG', '$$ifndef', defines); // false
 * isDefinitionMet('PRODUCTION', '$$ifndef', defines); // true
 * ```
 *
 * @example Missing definition
 * ```ts
 * const defines = { DEBUG: true };
 * isDefinitionMet('MISSING', '$$ifdef', defines); // false
 * isDefinitionMet('MISSING', '$$ifndef', defines); // true
 * ```
 *
 * @see {@link astDefineVariable} for usage context
 * @see {@link astDefineCallExpression} for usage context
 *
 * @since 2.0.0
 */

function isDefinitionMet(defineName: string, directiveName: string, defines: DefinesType): boolean {
    const isDefined = defineName in defines && !!defines[defineName];

    return (directiveName === IFDEF_DIRECTIVE) === isDefined;
}

/**
 * Transforms a conditional macro variable declaration into a function or returns an empty string if excluded.
 *
 * @param decl - The variable declaration node containing the macro
 * @param init - The call expression node representing the macro call
 * @param hasExport - Whether the variable declaration has an `export` modifier
 * @param state - The macro transformation state containing definitions and source file
 *
 * @returns The transformed function/constant string, empty string if excluded, or `false` if invalid
 *
 * @remarks
 * This function processes conditional macro variable declarations of the form:
 * ```ts
 * const $$myFunc = $$ifdef('DEFINITION', callback);
 * const $$myFunc = $$ifndef('DEFINITION', callback);
 * ```
 *
 * The transformation process:
 * 1. Validates that the first argument is a string literal (the definition name)
 * 2. Checks if the definition condition is met using {@link isDefinitionMet}
 * 3. If included: transforms the callback into a function using {@link transformToFunction}
 * 4. If excluded: returns an empty string (macro is stripped from output)
 * 5. If invalid: returns `false` (non-string definition argument)
 *
 * The variable name from the declaration becomes the function name in the output.
 *
 * @example Included macro (DEBUG=true)
 * ```ts
 * // Source: const $$debug = $$ifdef('DEBUG', () => console.log);
 * // With: { DEBUG: true }
 * const result = astDefineVariable(decl, init, false, state);
 * // 'function $$debug() { return console.log; }'
 * ```
 *
 * @example Excluded macro (DEBUG=false)
 * ```ts
 * // Source: const $$debug = $$ifdef('DEBUG', () => console.log);
 * // With: { DEBUG: false }
 * const result = astDefineVariable(decl, init, false, state);
 * // ''
 * ```
 *
 * @example Exported macro
 * ```ts
 * // Source: export const $$feature = $$ifdef('FEATURE_X', () => true);
 * // With: { FEATURE_X: true }
 * const result = astDefineVariable(decl, init, true, state);
 * // 'export function $$feature() { return true; }'
 * ```
 *
 * @example Invalid macro (non-string definition)
 * ```ts
 * // Source: const $$bad = $$ifdef(DEBUG, () => {});
 * const result = astDefineVariable(decl, init, false, state);
 * // false
 * ```
 *
 * @see {@link isDefinitionMet} for condition evaluation
 * @see {@link transformToFunction} for transformation logic
 *
 * @since 2.0.0
 */

export function astDefineVariable(
    decl: VariableDeclaration, init: CallExpression, hasExport: boolean, state: StateInterface
): string | false {
    const [ defineArg, callbackArg ] = init.arguments;

    if (!ts.isStringLiteral(defineArg)) return false;

    const fnName = (init.expression as ts.Identifier).text;
    const defineName = defineArg.text;

    if (!isDefinitionMet(defineName, fnName, state.defines)) {
        return '';
    }

    const varName = decl.name.getText(state.sourceFile);

    return transformToFunction(varName, callbackArg, state.sourceFile, hasExport);
}

/**
 * Transforms a conditional macro call expression into an IIFE or returns empty string if excluded.
 *
 * @param args - The arguments passed to the macro call
 * @param fnName - The macro function name (`'$$ifdef'` or `'$$ifndef'`)
 * @param state - The macro transformation state containing definitions and source file
 *
 * @returns The transformed IIFE string, empty string if excluded, or `false` if invalid
 *
 * @remarks
 * This function processes standalone conditional macro calls that appear in expression contexts:
 * ```ts
 * console.log($$ifdef('DEBUG', () => "debug mode"));
 * const value = $$ifndef('PRODUCTION', () => devValue);
 * ```
 *
 * Unlike {@link astDefineVariable}, this handles macros that are not part of variable
 * declarations but are used directly as expressions.
 *
 * The transformation process:
 * 1. Validates that the first argument is a string literal (the definition name)
 * 2. Checks if the definition condition is met using {@link isDefinitionMet}
 * 3. If included: transforms the callback into an IIFE using {@link transformToIIFE}
 * 4. If excluded: returns an empty string (macro evaluates to undefined)
 * 5. If invalid: returns `false` (non-string definition argument)
 *
 * @example Included expression (DEBUG=true)
 * ```ts
 * // Source: console.log($$ifdef('DEBUG', () => "debugging"));
 * // With: { DEBUG: true }
 * const result = astDefineCallExpression(args, '$$ifdef', state);
 * // '(() => "debugging")()'
 * // Result: console.log((() => "debugging")());
 * ```
 *
 * @example Excluded expression (DEBUG=false)
 * ```ts
 * // Source: console.log($$ifdef('DEBUG', () => "debugging"));
 * // With: { DEBUG: false }
 * const result = astDefineCallExpression(args, '$$ifdef', state);
 * // ''
 * // Result: console.log();
 * ```
 *
 * @example Using `$$ifndef`
 * ```ts
 * // Source: const url = $$ifndef('PRODUCTION', () => 'http://localhost');
 * // With: { PRODUCTION: false }
 * const result = astDefineCallExpression(args, '$$ifndef', state);
 * // '(() => "http://localhost")()'
 * ```
 *
 * @see {@link isDefinitionMet} for condition evaluation
 * @see {@link transformToIIFE} for transformation logic
 * @see {@link astDefineVariable} for variable declaration handling
 *
 * @since 2.0.0
 */

export function astDefineCallExpression(args: NodeArray<Expression>, fnName: string, state: StateInterface): string | false {
    const [ defineArg, callbackArg ] = args;

    if (!ts.isStringLiteral(defineArg)) return false;

    const defineName = defineArg.text;

    if (!isDefinitionMet(defineName, fnName, state.defines)) {
        return '';
    }

    return transformToIIFE(callbackArg, state.sourceFile);
}
