/**
 * Import will remove at compile time
 */

import type { CallExpression, VariableDeclaration, Node } from 'typescript';
import type { SourceFile, NodeArray, Expression, VariableStatement } from 'typescript';
import type { StateInterface } from '@directives/interfaces/macros-directive.interface';
import type { FunctionNodeType, ModuleInterface } from '@directives/interfaces/inline-directive.interface';
import type { ExecutableInterface, VariableKeywordType } from '@directives/interfaces/inline-directive.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { createRequire } from 'module';
import { InlineError } from '@errors/inline.error';
import { inject } from '@symlinks/symlinks.module';
import { sandboxExecute } from '@services/vm.service';
import { dirname, relative } from '@components/path.component';
import { FrameworkService } from '@services/framework.service';
import { buildFromString } from '@services/transpiler.service';

/**
 * Evaluates inline macro code in a sandboxed environment and returns the result as a string.
 *
 * @param code - The JavaScript code to execute (typically an IIFE wrapping a function or expression)
 * @param state - The current macro transformation state containing source file and error tracking
 * @param node - The AST node representing the inline macro call (used for error location tracking)
 *
 * @returns A promise resolving to the stringified result of the code execution, or `'undefined'` on error
 *
 * @remarks
 * This function performs the following steps:
 * 1. Transpiles and bundles the code using {@link buildFromString} in CommonJS format
 * 2. Creates a sandboxed execution context with access to Node.js globals and the file system
 * 3. Executes the code using {@link sandboxExecute} in an isolated VM context
 * 4. Captures and formats any errors using {@link InlineError} with source mapping
 * 5. Returns `'undefined'` on failure (errors are tracked in `state.errors`)
 *
 * The sandbox has access to:
 * - Global Node.js APIs (`Buffer`, `process`, `console`)
 * - Module system (`require`, `module`, `__dirname`, `__filename`)
 * - Timers (`setTimeout`, `setInterval`, and their clear counterparts)
 * - Standard JavaScript globals from `globalThis`
 *
 * Errors that occur during execution are enhanced with source maps to point back to the
 * original source code location, accounting for line offsets where the inline macro appears.
 *
 * @example Basic inline evaluation
 * ```ts
 * const code = '(() => { return 42; })()';
 * const result = await evaluateCode(code, state, node);
 * // result === 'undefined' (function executed but returns undefined as string)
 * ```
 *
 * @example Inline computation with imports
 * ```ts
 * const code = `(() => {
 *   const fs = require('fs');
 *   return fs.existsSync('./package.json') ? 'found' : 'missing';
 * })()`;
 *
 * const result = await evaluateCode(code, state, node);
 * // Executes in sandbox with require() support
 * ```
 *
 * @example Error handling with source mapping
 * ```ts
 * const code = '(() => { throw new Error("Test error"); })()';
 * const result = await evaluateCode(code, state, node);
 * // Returns 'undefined'
 * // state.errors contains InlineError with mapped stack trace
 * ```
 *
 * @see {@link sandboxExecute} for VM execution
 * @see {@link InlineError} for error formatting
 * @see {@link createSandboxContext} for context creation
 * @see {@link handleExecutionError} for error processing
 * @see {@link buildFromString} for transpilation and bundling
 *
 * @since 2.0.0
 */

export async function evaluateCode(code: string, state: StateInterface, node: Node): Promise<string> {
    const [ map, data ] = (await buildFromString(code, state.sourceFile.fileName, {
        bundle: true,
        format: 'cjs',
        platform: 'node',
        packages: 'external'
    })).outputFiles!;

    try {
        const module = { exports: {} };
        const require = createRequire(state.sourceFile.fileName);

        const result = await sandboxExecute(data.text, createSandboxContext(state.sourceFile.fileName, module, require), {
            filename: state.sourceFile.fileName
        });

        if (result === null) return 'undefined';
        if (typeof result === 'string') return result;
        if (typeof result === 'number' || typeof result === 'boolean') return String(result);

        return JSON.stringify(result);
    } catch (err) {
        handleExecutionError(err, state, map.text, node);
    }

    return 'undefined';
}

/**
 * Creates a sandboxed execution context with Node.js globals and module system access.
 *
 * @param fileName - The absolute path to the source file (used for `__filename` and module resolution)
 * @param module - The CommonJS module object with `exports` property
 * @param require - The require function scoped to the source file's location
 *
 * @returns A context object containing all globals available during inline macro execution
 *
 * @remarks
 * The sandbox context provides a controlled environment for executing inline macros with:
 * - **Standard globals**: All properties from `globalThis` (including `RegExp` explicitly)
 * - **Node.js APIs**: `Buffer`, `process`, `console`
 * - **Module system**: `module`, `require`, `__dirname`, `__filename`
 * - **Timers**: `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`
 *
 * The context is designed to mimic a normal Node.js execution environment while maintaining
 * isolation from the build process. The `require` function is scoped to the source file's
 * directory, allowing relative imports to resolve correctly.
 *
 * @example Context structure
 * ```ts
 * const module = { exports: {} };
 * const require = createRequire('/project/src/config.ts');
 *
 * const context = createSandboxContext('/project/src/config.ts', module, require);
 *
 * // context contains:
 * // - process, Buffer, console
 * // - require (scoped to /project/src/)
 * // - __dirname === '/project/src'
 * // - __filename === '/project/src/config.ts'
 * // - setTimeout, setInterval, etc.
 * ```
 *
 * @example Usage in inline evaluation
 * ```ts
 * const context = createSandboxContext(state.sourceFile.fileName, module, require);
 *
 * await sandboxExecute(compiledCode, context, {
 *   filename: state.sourceFile.fileName
 * });
 * ```
 *
 * @see {@link sandboxExecute} for execution
 * @see {@link evaluateCode} for usage context
 *
 * @since 2.0.0
 */

export function createSandboxContext(fileName: string, module: ModuleInterface, require: NodeJS.Require): Record<string, unknown> {
    return {
        ...globalThis,
        Error,
        RegExp,
        process,
        Buffer,
        module,
        require,
        console,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        ReferenceError,
        __dirname: dirname(fileName),
        __filename: fileName
    };
}

/**
 * Handles execution errors during inline macro evaluation and adds them to the transformation state.
 *
 * @param err - The error that occurred during execution
 * @param state - The macro transformation state to store the error in
 * @param mapText - The source map text for mapping error locations back to original source
 * @param node - The AST node representing the inline macro (used for calculating line offset)
 *
 * @remarks
 * This function processes errors that occur during {@link evaluateCode} by:
 * 1. Filtering out non-Error objects (ignores thrown primitives or undefined)
 * 2. Calculating the line offset where the inline macro appears in the source file
 * 3. Creating an {@link InlineError} with source map support and line offset adjustment
 * 4. Adding the formatted error to `state.errors` for build reporting
 *
 * The line offset is crucial for accurate error reporting because inline macros are extracted
 * from their original location, compiled separately, and executed in isolation. The offset
 * ensures that error locations point to the correct line in the original source file.
 *
 * @example Error handling flow
 * ```ts
 * try {
 *   await sandboxExecute(code, context);
 * } catch (err) {
 *   // err is a runtime error from the executed code
 *   handleExecutionError(err, state, sourceMapText, node);
 *   // state.errors now contains formatted error with correct source location
 * }
 * ```
 *
 * @example Error output
 * ```ts
 * // Original source at line 42: const x = $$inline(() => undefined.toString());
 * // After handling:
 * // state.errors === [{
 * //   text: "Cannot read property 'toString' of undefined",
 * //   detail: InlineError (with formatted stack pointing to line 42)
 * // }]
 * ```
 *
 * @see {@link evaluateCode} for execution context
 * @see {@link InlineError} for error formatting and source mapping
 *
 * @since 2.0.0
 */

function handleExecutionError(err: unknown, state: StateInterface, mapText: string, node: Node): void {
    if (!err || (typeof err !== 'object') || !('stack' in err)) {
        err = new Error(String(err));
    }

    const start = node.getStart(state.sourceFile);
    const { line } = state.sourceFile.getLineAndCharacterOfPosition(start);

    inject(FrameworkService).setSource(mapText, state.sourceFile.fileName);
    const error = new InlineError(<Error> err, line);

    state.errors.push({
        text: error.message,
        detail: error
    });
}

/**
 * Searches for a function declaration or function variable by name in the source file.
 *
 * @param functionName - The name of the function to find
 * @param sourceFile - The TypeScript source file to search
 *
 * @returns The found function node (declaration, arrow function, or function expression), or `null` if not found
 *
 * @remarks
 * This function recursively traverses the AST to locate functions that match the given name.
 * It handles three types of function definitions:
 * - `function myFunction() {}` (function declarations)
 * - `const myFunction = () => {}` (arrow functions in variable declarations)
 * - `const myFunction = function() {}` (function expressions in variable declarations)
 *
 * The search stops at the first match found. This is used when an inline macro references
 * a function by name rather than providing an inline function expression.
 *
 * @example Finding a function declaration
 * ```ts
 * const sourceFile = ts.createSourceFile(
 *   'test.ts',
 *   'function myFunc() { return 42; }',
 *   ts.ScriptTarget.Latest
 * );
 *
 * const func = findFunctionByName('myFunc', sourceFile);
 * // func is a FunctionDeclaration node
 * ```
 *
 * @example Finding an arrow function variable
 * ```ts
 * const sourceFile = ts.createSourceFile(
 *   'test.ts',
 *   'const myFunc = () => 42;',
 *   ts.ScriptTarget.Latest
 * );
 *
 * const func = findFunctionByName('myFunc', sourceFile);
 * // func is an ArrowFunction node
 * ```
 *
 * @example Function not found
 * ```ts
 * const func = findFunctionByName('nonExistent', sourceFile);
 * // func === null
 * ```
 *
 * @see {@link extractFromIdentifier} for usage context
 * @see {@link findFunctionInVariableStatement} for variable extraction logic
 *
 * @since 2.0.0
 */

function findFunctionByName(functionName: string, sourceFile: SourceFile): FunctionNodeType | null {
    let foundFunction: FunctionNodeType | null = null;

    const visit = (node: Node): void => {
        if (foundFunction) return;
        if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
            foundFunction = node;

            return;
        }

        if (ts.isVariableStatement(node)) {
            foundFunction = findFunctionInVariableStatement(node, functionName);
            if (foundFunction) return;
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return foundFunction;
}

/**
 * Extracts a function initializer from a variable statement if it matches the given name.
 *
 * @param node - The variable statement to search
 * @param functionName - The variable name to match
 *
 * @returns The arrow function or function expression initializer, or `null` if not found
 *
 * @remarks
 * This helper function is used by {@link findFunctionByName} to extract functions defined
 * as variables with arrow functions or function expressions as initializers.
 *
 * Only matches variables declared with simple identifiers (not destructured patterns)
 * that have arrow functions or function expressions as their initializer.
 *
 * @example Matching arrow function
 * ```ts
 * const statement = parseStatement('const myFunc = () => 42;');
 * const func = findFunctionInVariableStatement(statement, 'myFunc');
 * // func is the ArrowFunction node
 * ```
 *
 * @example Matching function expression
 * ```ts
 * const statement = parseStatement('const myFunc = function() { return 42; };');
 * const func = findFunctionInVariableStatement(statement, 'myFunc');
 * // func is the FunctionExpression node
 * ```
 *
 * @example No match
 * ```ts
 * const statement = parseStatement('const myFunc = 42;');
 * const func = findFunctionInVariableStatement(statement, 'myFunc');
 * // func === null (initializer is not a function)
 * ```
 *
 * @see {@link findFunctionByName} for the calling context
 *
 * @since 2.0.0
 */

function findFunctionInVariableStatement(node: VariableStatement, functionName: string): FunctionNodeType | null {
    for (const decl of node.declarationList.declarations) {
        if (
            ts.isIdentifier(decl.name) &&
            decl.name.text === functionName &&
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
            return decl.initializer;
        }
    }

    return null;
}

/**
 * Wraps JavaScript code in an Immediately Invoked Function Expression (IIFE).
 *
 * @param code - The code to wrap
 *
 * @returns The code wrapped in IIFE syntax: `module.exports = (code)();`
 *
 * @remarks
 * Converts function definitions or expressions into immediately executed forms for
 * inline evaluation. This is necessary when the inline macro contains a function
 * that should be executed and its return value used, rather than the function itself.
 *
 * The wrapping ensures that:
 * - Function declarations become function expressions (valid in expression context)
 * - Arrow functions and function expressions are immediately invoked
 * - The result of execution is captured rather than the function object
 *
 * @example Wrapping an arrow function
 * ```ts
 * const code = '() => 42';
 * const wrapped = wrapInIIFE(code);
 * // 'module.exports = (() => 42)();'
 * ```
 *
 * @example Wrapping a function expression
 * ```ts
 * const code = 'function() { return "hello"; }';
 * const wrapped = wrapInIIFE(code);
 * // 'module.exports = (function() { return "hello"; })();'
 * ```
 *
 * @example Wrapping a function declaration
 * ```ts
 * const code = 'function myFunc() { return 123; }';
 * const wrapped = wrapInIIFE(code);
 * // 'module.exports = (function myFunc() { return 123; })();'
 * ```
 *
 * @see {@link evaluateCode} for execution
 * @see {@link extractExecutableCode} for usage context
 *
 * @since 2.0.0
 */

export function wrapInIIFE(code: string): string {
    return `module.exports = (${ code })();`;
}

/**
 * Determines the variable keyword (`const`, `let`, or `var`) from TypeScript node flags.
 *
 * @param flags - TypeScript node flags from a variable declaration list
 *
 * @returns The appropriate variable keyword
 *
 * @remarks
 * Extracts the variable declaration keyword by checking TypeScript's node flags:
 * - Returns `'const'` if `NodeFlags.Const` is set
 * - Returns `'let'` if `NodeFlags.Let` is set
 * - Returns `'var'` as the default fallback
 *
 * This is used when transforming inline macro variable declarations to preserve
 * the original variable declaration style in the output.
 *
 * @example
 * ```ts
 * const flags = ts.NodeFlags.Const;
 * const keyword = getVariableKeyword(flags);
 * // 'const'
 * ```
 *
 * @example
 * ```ts
 * const flags = ts.NodeFlags.Let;
 * const keyword = getVariableKeyword(flags);
 * // 'let'
 * ```
 *
 * @example
 * ```ts
 * const flags = ts.NodeFlags.None;
 * const keyword = getVariableKeyword(flags);
 * // 'var'
 * ```
 *
 * @see {@link astInlineVariable} for usage context
 *
 * @since 2.0.0
 */

function getVariableKeyword(flags: ts.NodeFlags): VariableKeywordType {
    if (flags & ts.NodeFlags.Const) return 'const';
    if (flags & ts.NodeFlags.Let) return 'let';

    return 'var';
}

/**
 * Extracts executable code from various AST node types for inline macro evaluation.
 *
 * @param node - The AST node to extract code from
 * @param state - The macro transformation state for error reporting and source file access
 *
 * @returns An object containing the extracted code and the source node, or `null` if extraction fails
 *
 * @remarks
 * This function handles multiple node types:
 * - **Identifiers**: Looks up function declarations by name and wraps them in IIFEs
 * - **Arrow functions**: Wraps them in IIFEs for immediate execution
 * - **Function expressions**: Wraps them in IIFEs for immediate execution
 * - **Other expressions**: Returns the code as-is for direct evaluation
 *
 * When a function is referenced by name (identifier), the function must be defined
 * in the same source file. If not found, a warning is added to the transformation state.
 *
 * The returned `ExecutableInterface` contains both the formatted executable code and
 * the original AST node for error location tracking during execution.
 *
 * @example Extracting from an identifier reference
 * ```ts
 * // Source contains: function myFunc() { return 42; }
 * const node = ts.factory.createIdentifier('myFunc');
 * const result = extractExecutableCode(node, state);
 * // result.data === '(function myFunc() { return 42; })()'
 * ```
 *
 * @example Extracting from an arrow function
 * ```ts
 * const node = parseExpression('() => 42');
 * const result = extractExecutableCode(node, state);
 * // result.data === '(() => 42)()'
 * ```
 *
 * @example Extracting from an expression
 * ```ts
 * const node = parseExpression('1 + 2');
 * const result = extractExecutableCode(node, state);
 * // result.data === '1 + 2'
 * ```
 *
 * @example Function not found (generates warning)
 * ```ts
 * const node = ts.factory.createIdentifier('nonExistent');
 * const result = extractExecutableCode(node, state);
 * // result.data === ''
 * // state.warnings contains: "Function $$inline(nonExistent); not found in ..."
 * ```
 *
 * @see {@link evaluateCode} for execution
 * @see {@link wrapInIIFE} for IIFE wrapping
 * @see {@link extractFromIdentifier} for identifier handling
 *
 * @since 2.0.0
 */

export function extractExecutableCode(node: Node, state: StateInterface): ExecutableInterface | null {
    if (!node) return null;

    // Handle identifier (function name reference)
    if (ts.isIdentifier(node)) {
        return extractFromIdentifier(node, state);
    }

    // Handle arrow functions and function expressions
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return {
            node,
            data: wrapInIIFE(node.getText(state.sourceFile))
        };
    }

    // Handle other expressions
    return {
        node,
        data: node.getText(state.sourceFile)
    };
}

/**
 * Extracts executable code from a function identifier reference.
 *
 * @param node - The identifier node referencing a function name
 * @param state - The macro transformation state for function lookup and warnings
 *
 * @returns An object containing the wrapped function code and source node, or empty code with warning if not found
 *
 * @remarks
 * This function handles inline macros that reference functions by name rather than
 * defining them inline. It:
 * 1. Searches for the function declaration in the source file using {@link findFunctionByName}
 * 2. If found, wraps the function in an IIFE for immediate execution
 * 3. If not found, adds a warning to the transformation state and returns empty code
 *
 * The warning includes the relative path to help developers locate the issue quickly.
 *
 * @example Successful extraction
 * ```ts
 * // Source contains: function myFunc() { return 42; }
 * const identifier = ts.factory.createIdentifier('myFunc');
 * const result = extractFromIdentifier(identifier, state);
 * // result.data === '(function myFunc() { return 42; })()'
 * // result.node === FunctionDeclaration node
 * ```
 *
 * @example Function not found
 * ```ts
 * const identifier = ts.factory.createIdentifier('missing');
 * const result = extractFromIdentifier(identifier, state);
 * // result.data === ''
 * // result.node === identifier
 * // state.warnings contains a warning message
 * ```
 *
 * @see {@link findFunctionByName} for function lookup
 * @see {@link extractExecutableCode} for the calling context
 * @see {@link addFunctionNotFoundWarning} for warning generation
 *
 * @since 2.0.0
 */

function extractFromIdentifier(node: ts.Identifier, state: StateInterface): ExecutableInterface {
    const functionDeclaration = findFunctionByName(node.text, state.sourceFile);

    if (!functionDeclaration) {
        addFunctionNotFoundWarning(node.text, state, node);

        return { data: '', node };
    }

    return {
        node: functionDeclaration,
        data: wrapInIIFE(functionDeclaration.getText(state.sourceFile))
    };
}

/**
 * Adds a warning to the transformation state when a referenced function is not found.
 *
 * @param functionName - The name of the function that was not found
 * @param state - The macro transformation state to add the warning to
 * @param node - The AST node representing the function reference (used for location tracking)
 *
 * @remarks
 * Generates a user-friendly warning message with the relative file path and precise location
 * information to help developers quickly identify and fix missing function references in inline macros.
 *
 * The warning includes:
 * - A descriptive message with the function name and file path
 * - Precise location information (line, column, file path)
 * - The source line text containing the reference
 *
 * The warning message format is:
 * ```
 * Function $$inline(functionName); not found in path/to/file.ts
 * ```
 *
 * @example
 * ```ts
 * // In file: /project/src/config.ts at line 42, column 15
 * // Code contains: const x = $$inline(missingFunc);
 *
 * const identifier = ts.factory.createIdentifier('missingFunc');
 * addFunctionNotFoundWarning('missingFunc', state, identifier);
 * // state.warnings === [{
 * //   text: "Function $$inline(missingFunc); not found in src/config.ts",
 * //   location: {
 * //     line: 43,  // 1-indexed
 * //     column: 15,
 * //     file: '/project/src/config.ts',
 * //     lineText: 'asd'
 * //   }
 * // }]
 * ```
 *
 * @see {@link extractFromIdentifier} for the calling context
 *
 * @since 2.0.0
 */

function addFunctionNotFoundWarning(functionName: string, state: StateInterface, node: Node): void {
    const start = node.getStart(state.sourceFile);
    const { line, character } = state.sourceFile.getLineAndCharacterOfPosition(start);
    const relativePath = relative('.', state.sourceFile.fileName);

    state.warnings.push({
        text: `Function $$inline(${ functionName }); not found in ${ relativePath }`,
        location: {
            line: line + 1,
            column: character,
            file: state.sourceFile.fileName,
            lineText: 'asd'
        }
    });
}

/**
 * Transforms an inline macro variable declaration into executable code with the evaluated result.
 *
 * @param decl - The variable declaration node containing the inline macro
 * @param node - The complete variable statement (needed for flags and export status)
 * @param init - The call expression node representing the `$$inline()` macro call
 * @param hasExport - Whether the variable declaration has an `export` modifier
 * @param state - The macro transformation state for code extraction and evaluation
 *
 * @returns A promise resolving to the transformed variable declaration string, or `false` if transformation fails
 *
 * @remarks
 * This function processes inline macro variable declarations of the form:
 * ```ts
 * const myVar = $$inline(...);
 * export const myVar = $$inline(...);
 * ```
 *
 * The transformation process:
 * 1. Extracts the executable code from the macro argument using {@link extractExecutableCode}
 * 2. Evaluates the code in a sandboxed environment using {@link evaluateCode}
 * 3. Replaces the macro call with the evaluated result
 * 4. Preserves the variable keyword (`const`, `let`, or `var`) and export status
 *
 * @example Basic inline variable
 * ```ts
 * // Input AST for: a const result = $$inline(() => 1 + 1);
 * const transformed = await astInlineVariable(decl, node, init, false, state);
 * // transformed === 'const result = undefined;'
 * // (actual evaluation would return the computed value)
 * ```
 *
 * @example Exported inline variable
 * ```ts
 * // Input AST for: export const API_URL = $$inline(() => process.env.API_URL);
 * const transformed = await astInlineVariable(decl, node, init, true, state);
 * // transformed === 'export const API_URL = undefined;'
 * ```
 *
 * @example With function reference
 * ```ts
 * // Input AST for: let config = $$inline(getConfig);
 * const transformed = await astInlineVariable(decl, node, init, false, state);
 * // transformed === 'let config = undefined;'
 * ```
 *
 * @see {@link evaluateCode} for code evaluation
 * @see {@link extractExecutableCode} for code extraction
 * @see {@link getVariableKeyword} for variable keyword detection
 *
 * @since 2.0.0
 */

export async function astInlineVariable(
    decl: VariableDeclaration, node: VariableStatement, init: CallExpression, hasExport: boolean, state: StateInterface
): Promise<string | false> {
    const arg = init.arguments[0];
    const code = extractExecutableCode(arg, state);
    if (!code) return false;

    const result = await evaluateCode(code.data, state, code.node);
    const varKeyword = getVariableKeyword(node.declarationList.flags);
    const exportPrefix = hasExport ? 'export ' : '';
    const varName = decl.name.getText(state.sourceFile);

    return `${ exportPrefix }${ varKeyword } ${ varName } = ${ result };`;
}

/**
 * Transforms an inline macro call expression into its evaluated result.
 *
 * @param args - The arguments passed to the `$$inline()` call
 * @param state - The macro transformation state for code extraction and evaluation
 *
 * @returns A promise resolving to the evaluated result string, or `false` if transformation fails
 *
 * @remarks
 * This function processes standalone inline macro calls that appear in expression contexts:
 * ```ts
 * console.log($$inline(() => "hello"));
 * const x = someFunction($$inline(getValue));
 * ```
 *
 * Unlike {@link astInlineVariable}, this handles inline macros that are not part of
 * variable declarations but are used directly as expressions.
 *
 * The transformation process:
 * 1. Extracts the executable code from the first argument using {@link extractExecutableCode}
 * 2. Evaluates the code using {@link evaluateCode}
 * 3. Returns the stringified result to replace the macro call
 *
 * @example Inline function call
 * ```ts
 * // Input AST for: console.log($$inline(() => 42));
 * const transformed = await astInlineCallExpression(args, state);
 * // transformed === 'undefined'
 * // Original: console.log($$inline(() => 42));
 * // Result: console.log(undefined);
 * ```
 *
 * @example Inline with function reference
 * ```ts
 * // Input AST for: const result = compute($$inline(getValue));
 * const transformed = await astInlineCallExpression(args, state);
 * // transformed === 'undefined'
 * ```
 *
 * @example Extraction failure
 * ```ts
 * const transformed = await astInlineCallExpression([], state);
 * // transformed === false
 * ```
 *
 * @see {@link evaluateCode} for code evaluation
 * @see {@link extractExecutableCode} for code extraction
 * @see {@link astInlineVariable} for variable declaration handling
 *
 * @since 2.0.0
 */

export async function astInlineCallExpression(args: NodeArray<Expression>, state: StateInterface): Promise<string | false> {
    const arg = args[0];
    const code = extractExecutableCode(arg, state);

    if (!code) return false;

    return evaluateCode(code.data, state, code.node);
}
