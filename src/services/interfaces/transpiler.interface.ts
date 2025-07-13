/**
 * Represents the result of transpiling a TypeScript file.
 *
 * This interface defines the structure of the output returned from a TypeScript transpilation process,
 * including the transpiled JavaScript code and the associated source map.
 *
 * @property code - The transpiled JavaScript code generated from the TypeScript file.
 * @property sourceMap - The source map associated with the transpiled JavaScript code.
 *
 * @remarks
 * - The `code` property contains the JavaScript code after TypeScript transpilation.
 * - The `sourceMap` property provides the source map that maps the transpiled JavaScript code back to the original TypeScript source.
 * - The source map is useful for debugging as it allows developers to trace errors in the generated JavaScript back to the original TypeScript code.
 *
 * @example
 * ```typescript
 * import { TranspileFileInterface } from './TranspileFileInterface';
 *
 * const result: TranspileFileInterface = {
 *     code: 'console.log("Hello, world!");',
 *     sourceMap: 'version: 3\nfile: out.js\nsources: ["file.ts"]\n'
 * };
 *
 * console.log(result.code); // Output: console.log("Hello, world!");
 * console.log(result.sourceMap); // Output: version: 3\nfile: out.js\nsources: ["file.ts"]\n
 * ```
 *
 * In this example, the `TranspileFileInterface` is used to represent the result of transpiling a TypeScript file.
 * The `code` contains the JavaScript code, while the `sourceMap` provides the mapping information for debugging purposes.
 *
 * @public
 * @category Interfaces
 */

export interface TranspileFileInterface {
    code: string;
    sourceMap: string;
}
