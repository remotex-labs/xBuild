/**
 * Import will remove at compile time
 */

import type { BuildResult } from 'esbuild';

/**
 * Extended build result interface with normalized error and warning arrays.
 *
 * @remarks
 * This interface extends esbuild's {@link BuildResult} while replacing the `errors` and `warnings`
 * properties with normalized Error instances instead of esbuild's Message objects. This normalization
 * provides consistent error handling throughout the xBuild system with proper stack traces, formatting,
 * and error classification.
 *
 * **Key differences from esbuild's BuildResult**:
 * - `errors`: Changed from `Message[]` to `Error[]` with normalized error types
 * - `warnings`: Changed from `Message[]` to `Error[]` with normalized error types
 * - All other properties (metafile, outputFiles, mangleCache) are preserved unchanged
 *
 * **Benefits of normalization**:
 * - Consistent error handling across different error sources (esbuild, TypeScript, VM runtime)
 * - Proper error inheritance and type checking
 * - Rich stack trace information with source mapping
 * - Formatted error output with syntax highlighting
 * - Integration with xBuild's custom error classes
 *
 * The normalized errors may include:
 * - {@link TypesError} for TypeScript type checking failures
 * - {@link esBuildError} for esbuild compilation errors with location information
 * - {@link VMRuntimeError} for runtime errors during build hooks
 * - {@link xBuildBaseError} for custom build system errors
 *
 * @example
 * ```ts
 * const result: BuildResultInterface = {
 *   errors: [
 *     new esBuildError(esbuildMessage),
 *     new TypesError('Type checking failed', diagnostics)
 *   ],
 *   warnings: [
 *     new VMRuntimeError(new Error('Deprecation warning'))
 *   ],
 *   metafile: { ... },
 *   outputFiles: [ ... ],
 *   mangleCache: { ... }
 * };
 * ```
 *
 * @see {@link BuildResult} from esbuild for the base interface
 *
 * @since 2.0.0
 */

export interface BuildResultInterface extends Omit<BuildResult, 'errors' | 'warnings'>{
    /**
     * Array of normalized error instances encountered during the build.
     *
     * @remarks
     * Contains Error instances converted from esbuild messages and other error sources.
     * Unlike esbuild's native error array which contains Message objects, this array
     * contains fully normalized Error instances with proper stack traces and formatting.
     *
     * Errors in this array may originate from:
     * - Compilation errors (syntax, resolution failures)
     * - Type checking failures
     * - Build hook execution errors
     * - Plugin errors
     *
     * @example
     * ```ts
     * if (result.errors.length > 0) {
     *   console.error(`Build failed with ${result.errors.length} errors`);
     *   result.errors.forEach(err => console.error(err.stack));
     * }
     * ```
     *
     * @since 2.0.0
     */

    errors: Array<Error>;

    /**
     * Array of normalized warning instances encountered during the build.
     *
     * @remarks
     * Contains Error instances converted from esbuild warning messages and other warning sources.
     * Unlike esbuild's native warning array which contains Message objects, this array
     * contains fully normalized Error instances with proper stack traces and formatting.
     *
     * Warnings indicate non-fatal issues that don't prevent build completion but may
     * require attention, such as:
     * - Deprecated API usage
     * - Type checking warnings
     * - Performance concerns
     * - Potential runtime issues
     *
     * @example
     * ```ts
     * if (result.warnings.length > 0) {
     *   console.warn(`Build completed with ${result.warnings.length} warnings`);
     *   result.warnings.forEach(warn => console.warn(warn.message));
     * }
     * ```
     *
     * @since 2.0.0
     */

    warnings: Array<Error>;
}
