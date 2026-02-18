/**
 * Import will remove at compile time
 */

import type { Metafile } from 'esbuild';
import type { IssueType } from '@components/interfaces/printer-component.interface';
import type { DiagnosticsInterface } from '@typescript/services/interfaces/typescript-service.interface';
import type { BuildContextInterface, ResultContextInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Imports
 */

import { TypesError } from '@errors/types.error';
import { xBuildBaseError } from '@errors/base.error';
import { prefix } from '@components/banner.component';
import { relative } from '@components/path.component';
import { VMRuntimeError } from '@errors/vm-runtime.error';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { enhancedBuildResult } from '@providers/esbuild-messages.provider';
import { mutedColor, pathColor, textColor, warnColor } from '@components/color.component';
import { errorColor, infoColor, keywordColor, okColor } from '@components/color.component';

/**
 * Constants
 */

const INDENT = '   ';
const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * 1024;
const DASH_SYMBOL = '—';
const ARROW_SYMBOL = '→';
const ERROR_SYMBOL = '×';
const WARNING_SYMBOL = '•';

/**
 * Creates a formatted prefix for action log messages.
 *
 * @remarks
 * Generates a standardized prefix combining the build banner prefix,
 * a symbol (typically an arrow), and a colored action name. This ensures
 * consistent formatting across all build action logs.
 *
 * @param action - The action name to display (e.g., 'build', 'completed')
 * @param symbol - The symbol to display, defaults to a dimmed arrow
 *
 * @returns A formatted string with prefix, symbol, and colored action name
 *
 * @example
 * ```ts
 * const buildPrefix = createActionPrefix('build');
 * // Output: "[xBuild] → build"
 *
 * const errorPrefix = createActionPrefix('completed', errorColor(ERROR_SYMBOL));
 * // Output: "[xBuild] × completed"
 * ```
 *
 * @see {@link prefix}
 * @see {@link infoColor}
 *
 * @since 2.0.0
 */

export function createActionPrefix(action: string, symbol: string = infoColor.dim(ARROW_SYMBOL)): string {
    return `${ prefix() } ${ symbol } ${ infoColor(action) }`;
}

/**
 * Formats a byte size into a human-readable string with appropriate units.
 *
 * @remarks
 * Converts raw byte counts into formatted strings using B, KB, or MB units
 * depending on the size. Values are rounded to 2 decimal places for KB and MB.
 * This function is used primarily for displaying file sizes in build output.
 *
 * @param bytes - The number of bytes to format
 *
 * @returns A formatted string with the size and the appropriate unit (B, KB, or MB)
 *
 * @example
 * ```ts
 * formatByteSize(512);        // "512 B"
 * formatByteSize(2048);       // "2.00 KB"
 * formatByteSize(1572864);    // "1.50 MB"
 * ```
 *
 * @since 2.0.0
 */

export function formatByteSize(bytes: number): string {
    if (bytes < KILOBYTE) return `${ bytes } B`;
    if (bytes < MEGABYTE) return `${ (bytes / KILOBYTE).toFixed(2) } KB`;

    return `${ (bytes / MEGABYTE).toFixed(2) } MB`;
}

/**
 * Formats a TypeScript diagnostic's file location into a readable string.
 *
 * @remarks
 * Creates a standardized location string in the format `file:line:column`,
 * similar to standard compiler output. Line and column numbers are 1-based
 * (incremented from TypeScript's 0-based values). The file path is made
 * relative to the current working directory for brevity.
 *
 * @param diagnostic - The TypeScript diagnostic containing location information
 *
 * @returns A formatted location string with colored path and position
 *
 * @example
 * ```ts
 * const diagnostic: DiagnosticsInterface = {
 *   file: '/project/src/index.ts',
 *   line: 10,
 *   column: 5,
 *   code: 2304,
 *   message: 'Cannot find name'
 * };
 *
 * formatDiagnosticLocation(diagnostic);
 * // Output: "src/index.ts:11:6"
 * ```
 *
 * @see {@link pathColor}
 * @see {@link warnColor}
 * @see {@link DiagnosticsInterface}
 *
 * @since 2.0.0
 */

export function formatDiagnosticLocation(diagnostic: DiagnosticsInterface): string {
    const filePath = diagnostic.file ? relative(process.cwd(), diagnostic.file) : '(unknown)';
    const lineNumber = warnColor(String((diagnostic.line ?? 0) + 1));
    const columnNumber = warnColor(String((diagnostic.column ?? 0) + 1));

    return `${ pathColor(filePath) }:${ lineNumber }:${ columnNumber }`;
}

/**
 * Appends formatted error metadata to a buffer array.
 *
 * @remarks
 * Internal helper that adds formatted code snippets and enhanced stack traces
 * to the provided buffer. Only processes errors that have metadata with formatted
 * code. Used by {@link appendIssue} to include additional error context.
 *
 * @param buffer - Array to append formatted lines to
 * @param error - The xBuild error containing metadata to format
 *
 * @since 2.0.0
 */

export function appendErrorMetadata(buffer: Array<string>, error: xBuildBaseError): void {
    if (!error.metadata?.formatCode) return;

    const codeLines = error.metadata.formatCode.split('\n');
    const stackTrace = error.metadata.stacks.join('\n    ');

    buffer.push('');
    for (const line of codeLines) {
        buffer.push(`${ INDENT }${ line }`);
    }
    buffer.push('');
    buffer.push(`${ INDENT }Enhanced Stack Trace:`);
    buffer.push(`    ${ stackTrace }`);
}

/**
 * Logs formatted error metadata to the console.
 *
 * @remarks
 * Outputs formatted code snippets and enhanced stack traces for xBuild errors
 * that contain metadata. Used by {@link logError} to provide detailed error
 * context in the console output.
 *
 * @param error - The xBuild error containing metadata to log
 *
 * @example
 * ```ts
 * const error = new xBuildBaseError('Build failed', {
 *   formatCode: 'const x = undefined;\nx.toString();',
 *   stacks: ['at build.ts:45:12', 'at main.ts:10:5']
 * });
 *
 * logErrorMetadata(error);
 * // Outputs formatted code and stack trace to console
 * ```
 *
 * @see {@link logError}
 * @see {@link xBuildBaseError}
 *
 * @since 2.0.0
 */

export function logErrorMetadata(error: xBuildBaseError): void {
    if (!error.metadata?.formatCode) return;

    const formattedCode = error.metadata.formatCode
        .split('\n')
        .map(line => `${ INDENT }${ line }`)
        .join('\n');

    const stackTrace = error.metadata.stacks.join('\n    ');

    console.log(`\n${ formattedCode }\n\n${ INDENT }Enhanced Stack Trace:\n    ${ stackTrace }`);
}

/**
 * Formats a TypeScript diagnostic into a single-line string.
 *
 * @remarks
 * Internal helper that creates a formatted diagnostic string with location,
 * error code, and message. Used by {@link appendTypesError} to prepare
 * diagnostics for buffer output.
 *
 * @param diagnostic - The TypeScript diagnostic to format
 * @param symbol - The symbol to prefix the diagnostic with
 * @param codeColor - Color function for the error code
 *
 * @returns A formatted diagnostic string
 *
 * @since 2.0.0
 */

export function formatTypescriptDiagnostic(diagnostic: DiagnosticsInterface, symbol: string, codeColor: typeof errorColor): string {
    const location = formatDiagnosticLocation(diagnostic);
    const diagnosticCode = codeColor(`TS${ diagnostic.code }`);
    const message = mutedColor(diagnostic.message);

    return `${ INDENT }${ symbol } ${ location } ${ textColor(ARROW_SYMBOL) } ${ diagnosticCode } ${ textColor(DASH_SYMBOL) } ${ message }`;
}

/**
 * Logs a formatted TypeScript diagnostic to the console.
 *
 * @remarks
 * Outputs a single TypeScript diagnostic with location, error code, and message
 * in a standardized format. Used internally for immediate console output of
 * diagnostics during type checking.
 *
 * @param diagnostic - The TypeScript diagnostic to log
 * @param symbol - The symbol to prefix the diagnostic with
 * @param codeColor - Color function for the error code, defaults to error color
 *
 * @since 2.0.0
 */

export function logTypescriptDiagnostic(diagnostic: DiagnosticsInterface, symbol: string, codeColor: typeof errorColor = errorColor): void {
    const location = formatDiagnosticLocation(diagnostic);
    const diagnosticCode = codeColor(`TS${ diagnostic.code }`);
    const message = mutedColor(diagnostic.message);

    console.log(
        `${ INDENT }${ symbol } ${ location }`,
        textColor(ARROW_SYMBOL),
        `${ diagnosticCode } ${ textColor(DASH_SYMBOL) } ${ message }`
    );
}

/**
 * Appends formatted TypeScript type errors to a buffer array.
 *
 * @remarks
 * Internal helper that processes {@link TypesError} instances and adds their
 * diagnostics to the buffer. If no diagnostics exist, adds a generic warning
 * message. Returns the count of diagnostics processed.
 *
 * @param buffer - Array to append formatted lines to
 * @param error - The TypesError containing diagnostics to format
 * @param symbol - The symbol to prefix each diagnostic with
 *
 * @returns The number of diagnostics added to the buffer
 *
 * @since 2.0.0
 */

export function appendTypesError(buffer: Array<string>, error: TypesError, symbol: string): number {
    const diagnosticCount = error.diagnostics.length;

    if (diagnosticCount === 0) {
        buffer.push(`\n${ INDENT }${ warnColor(symbol) } ${ warnColor('TypesError') }: ${ mutedColor(error.message || 'Type checking warning') }`);

        return 1;
    }

    for (const diagnostic of error.diagnostics) {
        buffer.push(formatTypescriptDiagnostic(diagnostic, warnColor(symbol), xterm.deepOrange));
    }

    return diagnosticCount;
}

/**
 * Appends a formatted generic issue to a buffer array.
 *
 * @remarks
 * Internal helper that processes non-TypesError issues and adds them to the buffer.
 * If the issue is an xBuildBaseError with metadata, also appends the error metadata.
 *
 * @param buffer - Array to append formatted lines to
 * @param issue - The issue to format and append
 * @param symbol - The symbol to prefix the issue with
 * @param color - Color function for the symbol and formatting
 *
 * @since 2.0.0
 */

export function appendGenericIssue(buffer: Array<string>, issue: IssueType, symbol: string, color: typeof errorColor): void {
    buffer.push(`\n${ INDENT }${ color(symbol) } ${ issue }`);
    if (issue instanceof xBuildBaseError) {
        appendErrorMetadata(buffer, issue);
    }
}

/**
 * Appends a formatted build issue to a buffer array.
 *
 * @remarks
 * Processes different types of build issues (TypesError, xBuildBaseError, or
 * generic Error) and appends them to the provided buffer with appropriate
 * formatting. Returns the count of individual issues added, which may be
 * greater than 1 for TypesError containing multiple diagnostics.
 *
 * This function is used by {@link logBuildIssues} to prepare formatted issues
 * for batch console output.
 *
 * @param buffer - Array to append formatted issue lines to
 * @param issue - The build issue to format and append
 * @param symbol - The symbol to prefix the issue with (typically error or warning symbol)
 * @param color - Color function to apply to the symbol and formatting
 *
 * @returns The number of individual issues added to the buffer
 *
 * @example
 * ```ts
 * const buffer: string[] = [];
 * const error = new TypesError([diagnostic1, diagnostic2]);
 *
 * const count = appendIssue(buffer, error, ERROR_SYMBOL, errorColor);
 * // count = 2 (two diagnostics)
 * // buffer contains formatted diagnostic lines
 * ```
 *
 * @see {@link IssueType}
 * @see {@link TypesError}
 * @see {@link logBuildIssues}
 * @see {@link xBuildBaseError}
 *
 * @since 2.0.0
 */

export function appendIssue(buffer: Array<string>, issue: IssueType, symbol: string, color: typeof errorColor): number {
    if (issue instanceof TypesError) {
        return appendTypesError(buffer, issue, symbol);
    }

    appendGenericIssue(buffer, issue, symbol, color);

    return 1;
}

/**
 * Logs all build issues (errors or warnings) to the console in a formatted batch.
 *
 * @remarks
 * Processes an array of build issues and outputs them as a single formatted
 * block with a header showing the issue count. Uses buffering to prepare all
 * output before logging, ensuring clean and consistent console output.
 *
 * If no issues exist, this function returns early without logging anything.
 * The function handles different issue types (TypesError with multiple diagnostics,
 * xBuildBaseError with metadata, and generic errors) and formats them appropriately.
 *
 * @param issues - Array of build issues to log
 * @param issueType - Type label for the issues ('Errors' or 'Warnings')
 *
 * @example
 * ```ts
 * const errors = [
 *   new xBuildBaseError('Build failed'),
 *   new TypesError([diagnostic1, diagnostic2])
 * ];
 *
 * logBuildIssues(errors, 'Errors');
 * // Output:
 * // Errors (3)
 * //    × Build failed
 * //    × src/index.ts:10:5 → TS2304 — Cannot find name 'x'
 * //    × src/index.ts:15:3 → TS2322 — Type mismatch
 * ```
 *
 * @see {@link IssueType}
 * @see {@link appendIssue}
 *
 * @since 2.0.0
 */

export function logBuildIssues(issues: Array<IssueType>, issueType: 'Errors' | 'Warnings'): void {
    if (issues.length === 0) return;

    const isError = issueType === 'Errors';
    const symbol = isError ? ERROR_SYMBOL : WARNING_SYMBOL;
    const color = isError ? errorColor : warnColor;

    let totalIssueCount = 0;
    const buffer: Array<string> = [ '' ];

    for (const issue of issues) {
        totalIssueCount += appendIssue(buffer, issue, symbol, color);
    }

    buffer.push('');
    buffer[0] = `\n ${ color(issueType) } (${ totalIssueCount })\n`;

    console.log(buffer.join('\n'));
}

/**
 * Logs build output files with their sizes to the console.
 *
 * @remarks
 * Processes the esbuild metafile to extract output file information and
 * displays each output file with its size in a formatted list. The output
 * includes a header with the total count of output files.
 *
 * File sizes are automatically formatted using appropriate units (B, KB, MB)
 * for readability.
 *
 * @param metafile - The esbuild metafile containing output information
 *
 * @example
 * ```ts
 * const metafile: Metafile = {
 *   outputs: {
 *     'dist/index.js': { bytes: 1024, inputs: {} },
 *     'dist/utils.js': { bytes: 512, inputs: {} }
 *   }
 * };
 *
 * logBuildOutputs(metafile);
 * // Output:
 * // Outputs (2)
 * //    → dist/index.js: 1.00 KB
 * //    → dist/utils.js: 512 B
 * ```
 *
 * @see {@link Metafile}
 * @see {@link formatByteSize}
 *
 * @since 2.0.0
 */

export function logBuildOutputs(metafile: Metafile): void {
    const outputEntries = Object.entries(metafile.outputs);
    const outputCount = outputEntries.length;

    const buffer: Array<string> = [];
    buffer.push(`\n ${ okColor('Outputs') } (${ outputCount })`);

    for (const [ outputPath, info ] of outputEntries) {
        const size = warnColor.dim(formatByteSize(info.bytes));
        buffer.push(`${ INDENT }${ infoColor(ARROW_SYMBOL) } ${ pathColor(outputPath) }: ${ size }`);
    }

    buffer.push('');
    console.log(buffer.join('\n'));
}

/**
 * Logs an error or issue to the console with appropriate formatting.
 *
 * @remarks
 * Provides unified error logging with special handling for different error types:
 * - {@link AggregateError}: Recursively logs all contained errors
 * - {@link TypesError}: Logs TypeScript diagnostics with file locations
 * - {@link xBuildBaseError}: Logs error with enhanced metadata and stack traces
 * - Generic {@link Error}: Wraps in {@link VMRuntimeError} before logging
 * - Other types: Converts to string, wraps in VMRuntimeError, and logs
 *
 * This is the primary function for error output throughout the build system,
 * ensuring consistent error formatting and the appropriate detail level.
 *
 * @param issue - The error or issue to log
 *
 * @example
 * ```ts
 * try {
 *   await build();
 * } catch (error) {
 *   logError(error);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Logs multiple TypeScript errors
 * const typesError = new TypesError([diagnostic1, diagnostic2]);
 * logError(typesError);
 * // Output:
 * //    × src/index.ts:10:5 → TS2304 — Cannot find name 'x'
 * //    × src/main.ts:20:3 → TS2322 — Type mismatch
 * ```
 *
 * @see {@link TypesError}
 * @see {@link VMRuntimeError}
 * @see {@link xBuildBaseError}
 * @see {@link logErrorMetadata}
 *
 * @since 2.0.0
 */

export function logError(issue: unknown): void {
    if (issue instanceof AggregateError) {
        for (const error of issue.errors) {
            logError(error);
        }
    } else if (issue instanceof TypesError) {
        for (const diagnostic of issue.diagnostics) {
            logTypescriptDiagnostic(diagnostic, errorColor(ERROR_SYMBOL));
        }
    } else if (issue instanceof xBuildBaseError) {
        console.log(`\n${ INDENT }${ errorColor(ERROR_SYMBOL) } ${ issue }`);
        logErrorMetadata(issue);
    } else if (issue instanceof Error) {
        logError(new VMRuntimeError(issue));
    } else {
        logError(new VMRuntimeError(new Error(String(issue))));
    }
}

/**
 * Logs TypeScript diagnostics for a single variant to the console.
 *
 * @remarks
 * Internal helper that outputs diagnostics for a named variant with a
 * completion status. Shows an error symbol if diagnostics exist, or
 * an arrow symbol for successful completion.
 *
 * @param name - The variant name
 * @param diagnostics - Array of TypeScript diagnostics for this variant
 *
 * @since 2.0.0
 */

export function logTypeDiagnostic(name: string, diagnostics: Array<DiagnosticsInterface>): void {
    const hasErrors = diagnostics.length > 0;
    const nameColor = hasErrors ? warnColor(name) : keywordColor(name);
    const statusSymbol = hasErrors ? errorColor(ERROR_SYMBOL) : infoColor.dim(ARROW_SYMBOL);
    const status = createActionPrefix('completed', statusSymbol);

    console.log(`${ status } ${ nameColor }`);

    if (hasErrors) {
        console.log('');
        for (const diagnostic of diagnostics) {
            logTypescriptDiagnostic(diagnostic, errorColor(ERROR_SYMBOL));
        }
        console.log('');
    }
}

/**
 * Logs TypeScript type diagnostics for all variants to the console.
 *
 * @remarks
 * Processes a record of variant names to diagnostic arrays and outputs
 * each variant's type checking results. Used to provide feedback after
 * TypeScript type checking operations across multiple build variants.
 *
 * Each variant is logged with its completion status and any diagnostics
 *  found during type checking.
 *
 * @param diagnostics - Record mapping variant names to their diagnostic arrays
 *
 * @example
 * ```ts
 * const diagnostics = {
 *   'production': [diagnostic1, diagnostic2],
 *   'development': []
 * };
 *
 * logTypeDiagnostics(diagnostics);
 * // Output:
 * // [xBuild] → completed production
 * //    × src/index.ts:10:5 → TS2304 — Cannot find name 'x'
 * //    × src/main.ts:15:3 → TS2322 — Type mismatch
 * //
 * // [xBuild] → completed development
 * ```
 *
 * @see {@link DiagnosticsInterface}
 *
 * @since 2.0.0
 */

export function logTypeDiagnostics(diagnostics: Record<string, Array<DiagnosticsInterface>>): void {
    for (const [ name, errors ] of Object.entries(diagnostics)) {
        logTypeDiagnostic(name, errors);
    }
}

/**
 * Logs the start of a build operation for a variant.
 *
 * @remarks
 * Outputs a formatted message indicating that a build has started for the
 * specified variant. Used by the build lifecycle to provide feedback at
 * the beginning of build operations.
 *
 * @param context - Build context containing the variant name
 *
 * @example
 * ```ts
 * const context: BuildContextInterface = {
 *   variantName: 'production',
 *   // ... other properties
 * };
 *
 * logBuildStart(context);
 * // Output: [xBuild] → build production
 * ```
 *
 * @see {@link createActionPrefix}
 * @see {@link BuildContextInterface}
 *
 * @since 2.0.0
 */

export function logBuildStart({ variantName }: BuildContextInterface): void {
    console.log(`${ createActionPrefix('build') } ${ keywordColor(variantName) }`);
}

/**
 * Logs the completion of a build operation with results summary.
 *
 * @remarks
 * Outputs a comprehensive build summary including
 * - Completion status with build duration
 * - All errors encountered during the build
 * - All warnings encountered during the build
 * - Output files with their sizes (if build succeeded)
 *
 * The completion status shows an error symbol if the build failed (no metafile),
 * or an arrow symbol for successful builds. Build duration is displayed in
 * milliseconds.
 *
 * This is the primary function for providing build feedback to users and is
 * called by the build lifecycle at the end of each build operation.
 *
 * @param context - Result context containing variant name, duration, and build result
 *
 * @example
 * ```ts
 * const context: ResultContextInterface = {
 *   variantName: 'production',
 *   duration: 1523,
 *   buildResult: {
 *     errors: [],
 *     warnings: [warning1],
 *     metafile: { outputs: { ... } }
 *   }
 * };
 *
 * logBuildEnd(context);
 * // Output:
 * // [xBuild] → completed production in 1523 ms
 * //
 * // Warnings (1)
 * //    • Unused variable warning
 * //
 * // Outputs (2)
 * //    → dist/index.js: 45.23 KB
 * //    → dist/utils.js: 12.45 KB
 * ```
 *
 * @see {@link logBuildIssues}
 * @see {@link logBuildOutputs}
 * @see {@link ResultContextInterface}
 *
 * @since 2.0.0
 */

export function logBuildEnd({ variantName, duration, buildResult, stage }: ResultContextInterface): void {
    const { errors, warnings, metafile } = enhancedBuildResult(buildResult);
    const isSuccess = !!metafile;

    const nameColor = isSuccess ? keywordColor(variantName) : warnColor(variantName);
    const statusSymbol = isSuccess ? infoColor.dim(ARROW_SYMBOL) : errorColor(ERROR_SYMBOL);
    const status = createActionPrefix('completed', statusSymbol);
    const durationText = xterm.dim(`in ${ duration } ms`);

    console.log(`${ status } ${ nameColor } ${ durationText }`);

    logBuildIssues(errors, 'Errors');
    logBuildIssues(warnings, 'Warnings');

    console.log(stage)

    if (isSuccess) {
        logBuildOutputs(metafile);
    }
}
