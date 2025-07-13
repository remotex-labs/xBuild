/**
 * Import will remove at compile time
 */

import type { Location, Message } from 'esbuild';

/**
 * Imports
 */

import { join } from 'path';
import { cwd } from 'process';
import { existsSync, readFileSync } from 'fs';
import { BaseError } from '@errors/base.error';
import { Colors, setColor } from '@components/colors.component';
import { formatErrorCode } from '@remotex-labs/xmap/formatter.component';
import { highlightCode } from '@remotex-labs/xmap/highlighter.component';

/**
 * Represents an error that occurs during the esbuild process.
 *
 * This class extends the base error class to provide specific error handling for esbuild-related issues.
 * It captures the error message and maintains the proper stack trace, allowing for easier debugging
 * and identification of errors that occur during the build process.
 *
 * @class esBuildError
 * @extends BaseError
 */

export class esBuildError extends BaseError {
    originalErrorStack?: string;

    /**
     * Creates an instance of the EsbuildError class.
     *
     * @param message - An object containing the error message. The `text` property is used to initialize
     * the base error class with a descriptive message about the error encountered during the esbuild process.
     */

    constructor(message: Message) {
        super(message.text);
        this.name = 'esBuildError';

        // Maintain proper stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, esBuildError);
        }

        if (message.location) {
            this.stack = this.generateFormattedError(message);
        } else {
            this.originalErrorStack = this.stack;
            this.stack = this.reformatStack(this);
        }
    }

    /**
     * Generates a formatted error message with highlighted code.
     *
     * @param message - An esbuild Message object containing error information.
     * @returns A formatted string of the error message.
     */

    private generateFormattedError(message: Message): string {
        const { text, location, notes } = message;
        let formattedError = this.applyColor(Colors.Reset, `\n${ this.name }: ${ this.applyColor(Colors.Gray, location?.file ?? '') }\n`);
        formattedError += this.applyColor(Colors.LightCoral, `${ text }\n\n`);

        notes.forEach(note => {
            formattedError += this.applyColor(Colors.Gray, `${ note.text }\n\n`);
        });

        if (location) {
            const code = this.readCode(location.file);
            if (code) {
                formattedError += `${ this.formatCodeSnippet(code, location) }\n`;
            }
        }

        return formattedError;
    }

    /**
     * Reads code from a file if it exists.
     *
     * @param path - The file path to read from.
     * @returns Array of lines if file exists, otherwise null.
     */

    private readCode(path: string): string[] | null {
        try {
            return existsSync(path) ? readFileSync(join(cwd(), path), 'utf-8').split('\n') : null;
        } catch {
            return null;
        }
    }

    /**
     * Formats a code snippet with highlighted errors.
     *
     * @param code - Array of code lines.
     * @param location - The error location within the file.
     * @returns A formatted and highlighted code snippet string.
     */

    private formatCodeSnippet(code: string[], location: Location): string {
        const { line = 1, column = 0, file } = location;
        const startLine = Math.max(line - 3, 0);
        const endLine = Math.min(line + 3, code.length);

        const relevantCode = highlightCode(code.slice(startLine, endLine).join('\n'));

        return formatErrorCode({
            line,
            name: null,
            code: relevantCode,
            source: file,
            endLine,
            startLine,
            column: column + 1,
            sourceRoot: null,
            sourceIndex: -1,
            generatedLine: -1,
            generatedColumn: -1
        }, {
            color: global.__ACTIVE_COLOR ? Colors.BrightPink : '',
            reset: global.__ACTIVE_COLOR ? Colors.Reset : ''
        });
    }

    /**
     * Applies color to a given text if colors are enabled.
     *
     * @param color - The color code.
     * @param text - The text to colorize.
     * @returns The colorized text if colors are active, otherwise plain text.
     */

    private applyColor(color: Colors, text: string): string {
        return global.__ACTIVE_COLOR ? setColor(color, text) : text;
    }
}
