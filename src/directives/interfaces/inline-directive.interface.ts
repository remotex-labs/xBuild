/**
 * Import will remove at compile time
 */

import type { Node, FunctionDeclaration, ArrowFunction, FunctionExpression } from 'typescript';

/**
 * Represents executable code extracted from an AST node for inline macro evaluation.
 *
 * @remarks
 * This interface encapsulates both the source AST node and its extracted executable code
 * for inline macro processing. The dual representation is necessary because:
 * - The `data` field contains the formatted, executable code (potentially wrapped in an IIFE)
 * - The `node` field preserves the original AST location for accurate error reporting
 *
 * When errors occur during execution, the `node` is used to calculate line offsets and
 * provide accurate stack traces that point back to the original source location.
 *
 * @example Function reference extraction
 * ```ts
 * // Source: function myFunc() { return 42; }
 * // Inline macro: $$inline(myFunc)
 *
 * const executable: ExecutableInterface = {
 *   node: functionDeclarationNode,  // Original FunctionDeclaration AST node
 *   data: '(function myFunc() { return 42; })()'  // Wrapped for execution
 * };
 * ```
 *
 * @example Arrow function extraction
 * ```ts
 * // Inline macro: $$inline(() => 1 + 1)
 *
 * const executable: ExecutableInterface = {
 *   node: arrowFunctionNode,  // Original ArrowFunction AST node
 *   data: '(() => 1 + 1)()'  // Wrapped in IIFE
 * };
 * ```
 *
 * @example Expression extraction
 * ```ts
 * // Inline macro: $$inline(process.env.NODE_ENV)
 *
 * const executable: ExecutableInterface = {
 *   node: propertyAccessNode,  // Original PropertyAccessExpression node
 *   data: 'process.env.NODE_ENV'  // Direct expression, no wrapping
 * };
 * ```
 *
 * @see {@link extractExecutableCode} for code extraction
 * @see {@link evaluateCode} for execution and error handling
 *
 * @since 2.0.0
 */

export interface ExecutableInterface {
    /**
     * The original AST node from which the executable code was extracted.
     *
     * @remarks
     * Used for error location tracking when execution fails. The node's position
     * in the source file is used to calculate line offsets and generate accurate
     * stack traces via {@link InlineError}.
     *
     * Can be any AST node type, including
     * - `Identifier` (function name reference)
     * - `ArrowFunction` (inline arrow function)
     * - `FunctionExpression` (inline function expression)
     * - Any other expression node
     *
     * @since 2.0.0
     */

    node: Node;

    /**
     * The formatted executable code ready for evaluation.
     *
     * @remarks
     * Contains the JavaScript code string that will be executed in the sandbox.
     * The format depends on the source node type:
     * - Functions are wrapped in IIFEs: `(function() {})()`
     * - Expressions are used directly: `1 + 1`
     * - Empty string indicates extraction failure
     *
     * The code is transpiled and bundled before execution by {@link evaluateCode}.
     *
     * @since 2.0.0
     */

    data: string;
}

/**
 * Union type representing all TypeScript function node types supported by inline macros.
 *
 * @remarks
 * This type encompasses the three ways functions can be defined in TypeScript:
 * - **Function declarations**: `function myFunc() {}`
 * - **Arrow functions**: `() => {}` or `const myFunc = () => {}`
 * - **Function expressions**: `function() {}` or `const myFunc = function() {}`
 *
 * Used by {@link findFunctionByName} and related functions to type-safely handle
 * function lookups when inline macros reference functions by name rather than
 * defining them inline.
 *
 * @example Function declaration
 * ```ts
 * function myFunc(): number {
 *   return 42;
 * }
 * // Type: FunctionDeclaration
 * ```
 *
 * @example Arrow function
 * ```ts
 * const myFunc = (): number => 42;
 * // Type: ArrowFunction
 * ```
 *
 * @example Function expression
 * ```ts
 * const myFunc = function(): number {
 *   return 42;
 * };
 * // Type: FunctionExpression
 * ```
 *
 * @see {@link findFunctionByName} for usage in function lookup
 * @see {@link extractExecutableCode} for code extraction from function nodes
 *
 * @since 2.0.0
 */

export type FunctionNodeType = FunctionDeclaration | ArrowFunction | FunctionExpression;

/**
 * Union type representing JavaScript variable declaration keywords.
 *
 * @remarks
 * Used to preserve the original variable declaration style when transforming
 * inline macro variable declarations. The keyword is extracted from TypeScript's
 * node flags and used to generate the replacement code.
 *
 * - `'const'`: Block-scoped, immutable binding
 * - `'let'`: Block-scoped, mutable binding
 * - `'var'`: Function-scoped, mutable binding
 *
 * @example Preserving const
 * ```ts
 * // Original: const x = $$inline(() => 42);
 * // Transformed: const x = undefined;
 * // Keyword: 'const'
 * ```
 *
 * @example Preserving let
 * ```ts
 * // Original: let x = $$inline(() => 42);
 * // Transformed: let x = undefined;
 * // Keyword: 'let'
 * ```
 *
 * @example Preserving var
 * ```ts
 * // Original: var x = $$inline(() => 42);
 * // Transformed: var x = undefined;
 * // Keyword: 'var'
 * ```
 *
 * @see {@link astInlineVariable} for variable transformation
 * @see {@link getVariableKeyword} for keyword extraction from node flags
 *
 * @since 2.0.0
 */

export type VariableKeywordType = 'const' | 'let' | 'var';

/**
 * Represents a CommonJS module object with an exports property for sandboxed code execution.
 *
 * @remarks
 * This interface models the CommonJS `module` object provided to inline macro code
 * during execution in the sandboxed VM environment. It allows executed code to:
 * - Export values via `module.exports`
 * - Access module metadata if needed
 * - Interact with the CommonJS module system
 *
 * The interface uses an index signature to allow custom properties that might be
 * added by executed code or the sandbox environment, while ensuring the standard
 * `exports` property is always present.
 *
 * @example Basic module object
 * ```ts
 * const module: ModuleInterface = {
 *   exports: {}
 * };
 *
 * // In sandboxed code:
 * // module.exports = { value: 42 };
 * ```
 *
 * @example Module with metadata
 * ```ts
 * const module: ModuleInterface = {
 *   exports: {},
 *   id: '/path/to/file.js',
 *   filename: '/path/to/file.js',
 *   loaded: false
 * };
 * ```
 *
 * @example Used in sandbox context
 * ```ts
 * const module: ModuleInterface = { exports: {} };
 * const context = createSandboxContext(fileName, module, require);
 *
 * await sandboxExecute(code, context);
 * // Executed code can now use module.exports
 * ```
 *
 * @see {@link evaluateCode} for execution context
 * @see {@link createSandboxContext} for sandbox context creation
 *
 * @since 2.0.0
 */

export interface ModuleInterface {
    /**
     * Index signature allowing custom properties on the module object.
     *
     * @remarks
     * Provides flexibility for the sandbox environment to add custom properties
     * or for executed code to attach metadata to the module object.
     *
     * Common properties might include:
     * - `id`: Module identifier (file path)
     * - `filename`: Absolute path to the module
     * - `loaded`: Whether the module has finished loading
     * - `parent`: Parent module that required this one
     * - `children`: Array of modules required by this module
     *
     * @since 2.0.0
     */

    [key: string]: unknown;

    /**
     * The exports object where the module can export values.
     *
     * @remarks
     * This is the standard CommonJS exports object that executed code can populate
     * to export values. In the inline macro context, this allows executed code to:
     * - Export single values: `module.exports = 42;`
     * - Export multiple values: `module.exports = { a: 1, b: 2 };`
     * - Use named exports: `module.exports.myFunc = () => {};`
     *
     * The exported values can be accessed after execution to retrieve computed results.
     *
     * @since 2.0.0
     */

    exports: Record<string, unknown>;
}

