/**
 * Import will remove at compile time
 */

import type { BaseError } from '@errors/base.error';
import type { PositionWithCodeInterface } from '@remotex-labs/xmap';
import type { ErrorType, FrameDetailsInterface, StackTraceStateInterface } from '@errors/interfaces/stack.interface';

/**
 * Imports
 */

import { cwd } from 'process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { SourceService } from '@remotex-labs/xmap';
import { Colors, setColor } from '@components/colors.component';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Defines
 */

const cliPath = cwd();
const distPath = dirname(fileURLToPath(import.meta.url));
const rootPath = dirname(distPath);
export const xBuildLazy = ((): { service: SourceService } => {
    let cachedSourceService: SourceService;

    return {
        get service(): SourceService {
            if (!cachedSourceService) {
                // Lazy loading the sourceMap
                const sourceMapData = readFileSync(join(distPath, 'index.js.map'));
                cachedSourceService = new SourceService(sourceMapData.toString(), import.meta.url);
            }

            return cachedSourceService;
        }
    };
})();

if (!global.__ACTIVE_COLOR) {
    global.__ACTIVE_COLOR = true;
}

/**
 * Modifies the file path by applying the source root and appending the line number.
 *
 * @param source - The original full file path.
 * @param sourceRoot - The source root to be applied to the file path.
 * @param line - The line number point ot in the file.
 * @param rootPath - The project root directory to remove from the path.
 * @returns The modified file path with the source root applied and line number appended.
 */

function modifyFilePathWithSourceRoot(source: string, sourceRoot: string, line: number, rootPath: string): string {
    return `${ source.replace(`${ rootPath }\\`, sourceRoot).replace(/\\/g, '/') }#L${ line }`;
}

/**
 * Formats a single error line for the stack trace.
 *
 * @param name - The name of the function.
 * @param file - The file name.
 * @param line - The line number.
 * @param column - The column number.
 * @param frame - The frame call stack
 * @returns The formatted error line as a string.
 */

function formatErrorLine(name: string, file: string, line: number, column: number, frame: NodeJS.CallSite): string {
    if (frame.isPromiseAll())
        return `at async Promise.all (index: ${ frame.getPromiseIndex() })`;

    const asyncPrefix = frame.isAsync() ? 'async' : '';
    const formattedName = name ? `${ asyncPrefix } ${ name }` : asyncPrefix;
    const position = (line >= 0 && column >= 0) ? setColor(Colors.Gray, `[${ line }:${ column }]`) : '';

    return `at ${ formattedName } ${ setColor(Colors.DarkGray, file) } ${ position }`
        .replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extracts details such as function name, file name, line, and column from a stack frame.
 *
 * @param frame - The call site from the stack trace.
 * @returns An object containing function name, file name, line number, and column number.
 */

function extractFrameDetails(frame: NodeJS.CallSite): FrameDetailsInterface {
    const line = frame.getLineNumber() || -1;
    const column = frame.getColumnNumber() || -1;
    const source = frame.getFileName() || '<anonymous>';
    const typeName = frame.getTypeName() || '';
    const functionName = frame.getFunctionName() || '';

    let name = frame.isNative() ? '<native>' : functionName;
    if (typeName)
        name = `${ typeName }.${ name }`;

    return { functionName: name, source, line, column };
}

/**
 * Highlights the code at a given position and formats it for display.
 *
 * @param position - The position containing the code to be highlighted. It must implement the `PositionWithCodeInterface`.
 * @param error - The error object that may be modified if a TypeError is detected. It should be of type `ErrorType`.
 * @returns The formatted highlighted code as a string, incorporating any modifications based on the error type.
 */

function highlightPositionCode(position: PositionWithCodeInterface, error: ErrorType): string {
    const highlightedCode = __ACTIVE_COLOR ? highlightCode(position.code) : position.code;
    if (position.name && error.name == 'TypeError') {
        error.message = error.message.replace(/^\S+/, position.name);
    }

    return formatErrorCode({ ...position, code: highlightedCode }, {
        color: __ACTIVE_COLOR ? Colors.BrightPink : '',
        reset: __ACTIVE_COLOR ? Colors.Reset : ''
    });
}

/**
 * Formats a single stack entry from the call stack.
 *
 * @param frame - The call site from the stack trace.
 * @param state - The current state containing error and formatting information.
 * @returns The formatted stack entry as a string.
 */

function formatStackEntry(frame: NodeJS.CallSite, state: StackTraceStateInterface): string {
    const { functionName, source, line, column } = extractFrameDetails(frame);

    if (frame.isPromiseAll() || frame.isEval() || frame.isNative())
        return formatErrorLine(functionName, source, line, column, frame);

    let position: PositionWithCodeInterface | null = null;
    const isXBuildService = source === xBuildLazy.service.file;

    if (isXBuildService)
        position = xBuildLazy.service.getPositionWithCode(line, column);
    else if (state.error.sourceMap)
        position = state.error.sourceMap.getPositionWithCode(line, column);

    if (position) {
        const dirPath = isXBuildService ? distPath : cliPath;
        const { line: posLine, column: posColumn, name } = position;
        let source = resolve(dirPath, position.source);

        if (!state.blockCode)
            state.blockCode = highlightPositionCode(position, state.error);

        if (position.sourceRoot)
            source = modifyFilePathWithSourceRoot(
                resolve(dirPath, position.source),
                position.sourceRoot,
                position.line,
                isXBuildService ? rootPath : cliPath
            );

        return formatErrorLine(name || functionName, source, posLine, posColumn, frame);
    }

    if (source === 'evalmachine.<anonymous>')
        return '';

    return formatErrorLine(functionName, source, line, column, frame);
}

/**
 * Formats all stack entries into an array of strings for display.
 *
 * @param state - The current state containing error and formatting information.
 * @param stackEntries - The array of stack entries from the call stack.
 * @returns An array of formatted stack entry strings.
 */

function formattedStackEntries(state: StackTraceStateInterface, stackEntries: Array<NodeJS.CallSite>): Array<string> {
    return stackEntries.map((frame) => formatStackEntry(frame, state)).filter(Boolean);
}

/**
 * Prepares the error stack trace for display.
 *
 * This function overrides the default stack trace preparation to provide a custom format,
 * including enhanced stack trace information and error details.
 *
 * @param error - The error object (Error or BaseError).
 * @param stackEntries - The array of stack entries from the call stack.
 * @returns The formatted stack trace as a string.
 */

export function formatStackTrace(error: ErrorType & BaseError, stackEntries: Array<NodeJS.CallSite>): string {
    const state: StackTraceStateInterface = {
        error: error,
        blockCode: null,
        formattedError: global.__ACTIVE_COLOR ? Colors.Reset : ''
    };

    const stackTrace = formattedStackEntries(state, stackEntries);
    state.formattedError += `\n${ error.name }: \n${ setColor(Colors.LightCoral, error.message) }\n\n`;

    if (state.blockCode)
        state.formattedError += `${ state.blockCode }\n\n`;

    if (stackTrace.length > 0)
        state.formattedError += `Enhanced Stack Trace:\n${ stackTrace.join('\n') }\n`;

    return state.formattedError;
}

// Preserve the original Error.prepareStackTrace function
const originalPrepareStackTrace = Error.prepareStackTrace;

/**
 * Custom Error.prepareStackTrace to capture CallSite objects in the error.
 *
 * @param error - The error object being processed.
 * @param stackEntries - An array of CallSite objects representing the stack trace.
 * @returns A string stack trace generated by the original prepareStackTrace function.
 */

Error.prepareStackTrace = (error: ErrorType, stackEntries: Array<NodeJS.CallSite>): string => {
    // Attach the stack entries (CallSite objects) to the error object
    error.callStacks = stackEntries;

    // Call the original prepareStackTrace to return the standard string representation of the stack
    return originalPrepareStackTrace ? originalPrepareStackTrace(error, stackEntries) : '';
};
