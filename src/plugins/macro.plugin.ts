/**
 * Import will remove at compile time
 */

import type { Loader, Metafile, OnLoadArgs, OnLoadResult } from 'esbuild';
import type { BuildStateInterface } from '@plugins/interfaces/plugin.interface';
import type { PluginResultType } from '@providers/interfaces/plugins.interface';
import type { ConfigurationInterface } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import ts from 'typescript';
import { promises } from 'fs';
import { analyzeDependencies } from '@services/transpiler.service';

/**
 * The `collectFunctionNames` function analyzes the provided TypeScript code and collects the names of functions
 * that should be removed based on specific conditions. The function searches for function declarations and variable
 * declarations where the function name or variable is prefixed with `$$`, and adds these function names to the
 * `removeFunctions` set in the provided `state` object.
 *
 * - **Input**:
 *   - `code`: A string containing the TypeScript code to be analyzed.
 *   - `state`: An object representing the current build state, specifically the `mocks` state, which includes
 *     a `removeFunctions` set that will hold the names of functions that need to be removed.
 *
 * - **Output**: The function does not return any value. Instead, it modifies the `removeFunctions` set inside the
 *   `state` object by adding function names that meet the criteria for removal.
 *
 * ## Error Handling:
 * - The function does not explicitly handle errors. If invalid TypeScript code is provided, `ts.createSourceFile`
 *   may throw an error, which should be handled by the caller if necessary.
 *
 * @param code - The TypeScript code as a string that will be analyzed.
 * @param state - The build state containing the `removeFunctions` set to store the names of functions to be removed.
 * @returns `void` - The function modifies the `state` directly and does not return a value.
 */

export function collectFunctionNames(code: string, state: BuildStateInterface['macros']): void {
    // Parse the code into an AST
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.Latest, true);

    // Traverse the AST and collect function names
    const visitNode = (node: ts.Node): void => {
        if (ts.isFunctionDeclaration(node) && node.name && node.name.text.startsWith('$$')) {
            // Function declaration: function $$name() {}
            state.removeFunctions.add(node.name.text);

            return;
        }

        if (ts.isVariableStatement(node) && node.declarationList.declarations.length > 0) {
            // Variable declarations (e.g., arrow functions)
            node.declarationList.declarations.forEach((declaration) => {
                if (
                    ts.isIdentifier(declaration.name) &&
                    declaration.name.text.startsWith('$$') &&
                    declaration.initializer &&
                    (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
                ) {
                    state.removeFunctions.add(declaration.name.text);
                }
            });

            return;
        }

        if(ts.isIdentifier(node) && ts.isExpression(node) && node.escapedText && node.escapedText.startsWith('$$')) {
            state.removeFunctions.add(node.escapedText);

            return;
        }

        // Recursively visit child nodes
        ts.forEachChild(node, visitNode);
    };

    visitNode(sourceFile);
}

/**
 * The `collectDeclaredFunctions` function processes the provided `meta` metafile and reads each file's contents
 * to find function declarations within preprocessor directives. It uses regular expressions to match `// ifdef` and
 * `// endif` blocks in the code and collects the function names from the code inside the `ifdef` block, based on the
 * `define` configuration in the `config` object. If the condition defined in the `ifdef` is not met (i.e., not defined
 * in the `config.define`), the function names found inside the block will be collected and added to the `removeFunctions`
 * set in the `state` object.
 *
 * - **Input**:
 *   - `meta`: The `Metafile` object that contains the input files. The keys are file paths, and the values contain
 *     metadata about those files.
 *   - `config`: The configuration object containing a `define` field, which is an object of conditions that may be used
 *     in the `ifdef` blocks. If a condition in an `ifdef` block is not defined in `config.define`, the functions in
 *     that block will be collected.
 *   - `state`: The build state, specifically the `mocks` state, which includes a `removeFunctions` set that stores
 *     function names to be removed.
 *
 * - **Output**: This function does not return a value. It modifies the `removeFunctions` set within the provided `state`
 *   object by adding the names of functions found inside unprocessed `ifdef` blocks.
 *
 * ## Error Handling:
 * - If a file cannot be read due to a filesystem error, the function will throw an error.
 * - If the provided `meta` or `config` is malformed, it may result in runtime errors. The caller should ensure valid input.
 *
 * @param meta - The `Metafile` object containing the list of input files and their metadata.
 * @param config - The configuration object that defines conditions used in `ifdef` blocks.
 * @param state - The build state containing the `removeFunctions` set to store function names to be removed.
 * @returns `void` - The function modifies the `state` directly and does not return a value.
 */

export async function collectDeclaredFunctions(meta: Metafile, config: ConfigurationInterface, state: BuildStateInterface['macros']): Promise<void> {
    const files = Object.keys(meta.inputs);
    for (const file of files) {
        const contents = await promises.readFile(file, 'utf8');
        const regex = /\/\/\s?ifdef\s?(\w+)([\s\S]*?)\/\/\s?endif/g;
        let match;

        while ((match = regex.exec(contents)) !== null) {
            const [ , condition, code ] = match;

            if (!config.define[condition]) {
                collectFunctionNames(code, state);
            }
        }
    }
}

/**
 * The `transformSourceCode` function takes a TypeScript `sourceFile` and transforms it by modifying or removing
 * function calls based on the build state. Specifically, if a function name starts with `$$` and is present in the
 * `removeFunctions` set within the `state`, the function call is replaced with `undefined`. This transformation is
 * achieved using TypeScript's transformation API.
 *
 * - **Input**:
 *   - `sourceFile`: The TypeScript source file to be transformed, represented as a `ts.SourceFile` object.
 *   - `state`: The build state containing the `mocks` object, which includes a `removeFunctions` set. This set tracks
 *     functions that should be removed (i.e., replaced with `undefined`) during the transformation process.
 *
 * - **Output**: The transformed source code as a string, with the specified function calls replaced by `undefined`.
 *
 * ## Error Handling:
 * - This function assumes valid TypeScript code in the `sourceFile` and a properly initialized `state`.
 * - If the `removeFunctions` set contains function names, the function calls will be replaced with `undefined`.
 * - If no matching function calls are found, the code is returned unchanged.
 *
 * @param sourceFile - The TypeScript source file (`ts.SourceFile`) to be transformed.
 * @param state - The build state containing the `removeFunctions` set that tracks functions to be removed.
 * @returns The transformed source code as a string, with specified function calls replaced by `undefined`.
 */

function transformSourceCode(sourceFile: ts.SourceFile, state: BuildStateInterface['macros']): string {
    // Track the ranges of nodes that need to be replaced
    const replacements: Array<{ start: number; end: number; replacement: string }> = [];

    // Visitor function to identify nodes to replace
    function visit(node: ts.Node): void {
        if (ts.isCallExpression(node)) {
            const text = node.expression.getText();
            const functionName = text.endsWith('!') ? text.slice(0, -1) : text;

            if (functionName.startsWith('$$') && state.removeFunctions.has(functionName)) {
                replacements.push({
                    start: node.getStart(),
                    end: node.getEnd(),
                    replacement: 'undefined'
                });
            }

            // Check for object.$$methodName() pattern
            const expression = node.expression;
            if (ts.isPropertyAccessExpression(expression)) {
                const methodName = expression.name;

                if (ts.isIdentifier(methodName) && methodName.text.startsWith('$$')) {
                    replacements.push({
                        start: node.getStart(),
                        end: node.getEnd(),
                        replacement: 'undefined'
                    });
                }
            }
        }

        // Continue traversing the AST
        ts.forEachChild(node, visit);
    }

    // Traverse the AST to collect replacements
    visit(sourceFile);

    // Sort replacements in reverse order to avoid position shifts
    replacements.sort((a, b) => b.start - a.start);

    // Apply replacements directly to the source text
    let result = sourceFile.getFullText();

    for (const { start, end, replacement } of replacements) {
        // Get the actual full text positions including trivia
        result = result.substring(0, start) + replacement + result.substring(end);
    }

    return result;
}

/**
 * The `parseMacros` function processes TypeScript or JavaScript files to transform macros defined within the content.
 * It ensures that the build state is initialized if necessary, analyzes file dependencies, collects declared functions
 * that are marked for removal, and applies transformations to the source code based on the macros.
 * If the file's extension is not `.ts` or `.js`, the function returns `undefined`. Otherwise, it transforms the code
 * and returns the result in the specified loader format.
 *
 * - **Input**:
 *   - `content`: The content of the file as a string or `Uint8Array` to be parsed.
 *   - `loader`: A string representing the loader type for transforming the code (e.g., `'ts'`, `'js'`).
 *   - `args`: The `OnLoadArgs` object containing metadata for the current loading process, including the file path.
 *   - `state`: The build state containing the `mocks` object, which includes a `removeFunctions` set that tracks
 *     functions to be removed.
 *   - `config`: The configuration object that defines how macros should be handled (e.g., conditions for macro processing).
 *
 * - **Output**: A `Promise` that resolves to an `OnLoadResult`, `PluginResultType`, or `undefined`. If the file is
 *   of type `.ts` or `.js`, the transformed code is returned in the specified loader format (e.g., `'ts'`). If the file
 *   extension is not recognized, the function returns `undefined`.
 *
 * ## Error Handling:
 * - If the file path does not end with `.ts` or `.js`, the function returns `undefined`.
 * - If `state.mocks` is not initialized, it will be set up by analyzing the file dependencies and collecting declared functions.
 * - If any errors occur during the analysis, function collection, or transformation, the function may throw an error.
 *
 * @param content - The content of the file as a string or `Uint8Array` to be parsed.
 * @param loader - The loader type for transforming the code (e.g., `'ts'` or `'js'`).
 * @param args - The `OnLoadArgs` containing metadata, including the file path.
 * @param state - The build state that includes `mocks` with the `removeFunctions` set.
 * @param config - The configuration object defining how macros should be handled.
 * @returns A `Promise` that resolves to the transformed code (`OnLoadResult` or `PluginResultType`), or `undefined`
 *          if the file is not of type `.ts` or `.js`.
 */

export async function parseMacros(
    content: string | Uint8Array, loader: Loader | undefined, args: OnLoadArgs, state: BuildStateInterface, config: ConfigurationInterface
): Promise<OnLoadResult | PluginResultType | undefined> {
    if (!args.path.endsWith('.ts') && !args.path.endsWith('.js')) return { loader: loader, contents: content };
    if (!state.macros) {
        const macros = {
            removeFunctions: new Set<string>()
        };

        const meta = await analyzeDependencies([ args.path ]);
        await collectDeclaredFunctions(meta.metafile, config, macros);
        state.macros = macros;
    }

    const sourceCode = content.toString();
    const sourceFile = ts.createSourceFile(args.path, sourceCode, ts.ScriptTarget.Latest, true);

    return {
        loader: loader ?? 'ts',
        contents: transformSourceCode(sourceFile, state.macros)
    };
}
