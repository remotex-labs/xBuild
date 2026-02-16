/**
 * Import will remove at compile time
 */

import type { TypesError } from '@errors/types.error';
import type { xBuildBaseError } from '@errors/base.error';

/**
 * Represents any type of issue that can occur during the build process.
 *
 * @remarks
 * This union type encompasses all error types that the printer component
 * can handle and format for console output. It provides a unified type
 * for error handling and logging across the build system.
 *
 * The type includes:
 * - Generic {@link Error}: Standard JavaScript errors from any source
 * - {@link TypesError}: TypeScript type checking errors containing diagnostics
 * - {@link xBuildBaseError}: Enhanced build errors with metadata and stack traces
 *
 * This type is primarily used by printer component functions like
 * {@link appendIssue}, {@link logBuildIssues}, and {@link logError}
 * to accept any build-related error for formatting and display.
 *
 * @example
 * ```ts
 * function handleIssue(issue: IssueType): void {
 *   if (issue instanceof TypesError) {
 *     // Handle TypeScript diagnostics
 *     console.log(`Found ${issue.diagnostics.length} type errors`);
 *   } else if (issue instanceof xBuildBaseError) {
 *     // Handle enhanced build errors
 *     console.log('Build error:', issue.message);
 *   } else {
 *     // Handle generic errors
 *     console.log('Generic error:', issue.message);
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * // Collecting different issue types
 * const issues: Array<IssueType> = [
 *   new Error('Runtime error'),
 *   new TypesError([diagnostic1, diagnostic2]),
 *   new xBuildBaseError('Build failed', metadata)
 * ];
 *
 * logBuildIssues(issues, 'Errors');
 * ```
 *
 * @see {@link TypesError}
 * @see {@link xBuildBaseError}
 *
 * @since 2.0.0
 */

export type IssueType = Error | TypesError | xBuildBaseError;
