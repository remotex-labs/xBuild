/**
 * Custom error class representing type-related runtime errors.
 *
 * @remarks
 * The {@link TypesError} class extends the built-in `Error` class to provide specific
 * error handling for issues related to type mismatches, type validation failures, or
 * other type-related problems in your application.
 *
 * This custom error type enables:
 * - Precise error categorization and handling
 * - Distinction between type errors and other error categories
 * - Proper error chaining via the `cause` option (ECMAScript 2022+)
 * - Better debugging with specific error names
 *
 * @example
 * ```ts
 * // Basic usage
 * throw new TypesError('Expected string, but received number');
 *
 * // With error chaining
 * try {
 *   validateType(value);
 * } catch (error) {
 *   throw new TypesError('Type validation failed', { cause: error as Error });
 * }
 *
 * // Catching specific errors
 * try {
 *   someOperation();
 * } catch (error) {
 *   if (error instanceof TypesError) {
 *     console.error('Type error:', error.message);
 *   }
 * }
 * ```
 *
 * @see Error
 * @since 1.0.0
 */

export class TypesError extends Error {
    /**
     * Creates an instance of {@link TypesError}.
     *
     * @param message - A human-readable message providing details about the type error.
     * @param options - Optional configuration for the error.
     * @param options.cause - An optional underlying error that caused this type error (ECMAScript 2022+).
     *
     * @remarks
     * The error name is automatically set to `'TypesError'` for identification.
     * The prototype chain is properly configured to ensure `instanceof` checks work correctly.
     *
     * @example
     * ```ts
     * const error = new TypesError('Invalid type encountered', {
     *   cause: new Error('Original cause')
     * });
     *
     * console.log(error.name); // 'TypesError'
     * console.log(error.cause); // Error: Original cause
     * ```
     *
     * @since 1.0.0
     */

    constructor(message?: string, options?: { cause?: Error }) {
        super(message);
        this.name = 'TypesError';

        Object.setPrototypeOf(this, TypesError.prototype);
        if (options?.cause) {
            this.cause = options.cause;
        }
    }
}
