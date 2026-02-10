/**
 * Import will remove at compile time
 */

import type { DiagnosticsInterface } from '@typescript/typescript.module';

/**
 * Represents a TypeScript type checking error with associated diagnostic information.
 *
 * @remarks
 * The `TypesError` class extends the native `Error` class to provide enhanced error reporting
 * for TypeScript type checking failures. It captures and preserves diagnostic information
 * from TypeScript's type checker, allowing structured access to individual diagnostics.
 *
 * **Error context**:
 * Each `TypesError` can contain zero or more {@link DiagnosticsInterface} objects that provide:
 * - Source file location (file path, line, column)
 * - Diagnostic code for error identification
 * - Detailed error messages
 *
 * @example
 * ```ts
 * import { TypesError } from '@errors/types.error';
 * import type { DiagnosticsInterface } from '@typescript/interfaces/typescript.interface';
 *
 * // Create error with diagnostics from type checker
 * const diagnostics: DiagnosticsInterface[] = [
 *   {
 *     file: 'src/index.ts',
 *     line: 10,
 *     column: 5,
 *     code: 2322,
 *     message: 'Type "string" is not assignable to type "number"'
 *   }
 * ];
 *
 * throw new TypesError('Type checking failed', diagnostics);
 * ```
 *
 * @see {@link Typescript.check} for type checking context
 * @see {@link DiagnosticsInterface} for diagnostic structure
 *
 * @since 2.0.0
 */

export class TypesError extends Error {

    /**
     * Array of diagnostic information from TypeScript type checking.
     *
     * @remarks
     * Contains all diagnostics collected during type checking that led to this error.
     * May be empty if the error is not directly related to specific diagnostics.
     *
     * Each diagnostic includes:
     * - **file**: Source file path relative to project root
     * - **line**: 1-based line number where the issue occurred
     * - **column**: 1-based column number where the issue occurred
     * - **code**: TypeScript error code for identifying error type
     * - **message**: Human-readable error description
     *
     * Read-only to prevent modification after error creation.
     *
     * @example
     * ```ts
     * const error = new TypesError('Type check failed', diagnostics);
     * for (const diag of error.diagnostics) {
     *   console.log(`${diag.file}:${diag.line}:${diag.column} - ${diag.message}`);
     * }
     * ```
     *
     * @see {@link DiagnosticsInterface}
     *
     * @since 2.0.0
     */

    readonly diagnostics: Array<DiagnosticsInterface>;

    /**
     * Creates a new instance of `TypesError`.
     *
     * @param message - Optional error message describing the type checking failure
     * @param diagnostics - Optional array of diagnostic information (defaults to an empty array)
     *
     * @remarks
     * Initializes the error with:
     * 1. Message passed to parent `Error` class
     * 2. Error name set to `'TypesError'` for identification
     * 3. Stored diagnostics array for later inspection
     * 4. Prototype chain properly configured for instanceof checks
     *
     * **Prototype chain setup**:
     * Sets the prototype explicitly to ensure `instanceof` checks work correctly
     * across different execution contexts and transpilation scenarios.
     *
     * @example
     * ```ts
     * // Create error with message and diagnostics
     * const error = new TypesError('Type checking failed', [{
     *   file: 'src/app.ts',
     *   line: 42,
     *   column: 15,
     *   code: 2339,
     *   message: 'Property "config" does not exist'
     * }]);
     *
     * // Create error with a message only
     * const simple = new TypesError('Type checking failed');
     *
     * // Create error with diagnostics only
     * const diag = new TypesError(undefined, diagnostics);
     * ```
     *
     * @since 2.0.0
     */

    constructor(message?: string, diagnostics: Array<DiagnosticsInterface> = []) {
        super(message);
        this.name = 'TypesError';
        this.diagnostics = diagnostics;

        Object.setPrototypeOf(this, TypesError.prototype);
    }
}
