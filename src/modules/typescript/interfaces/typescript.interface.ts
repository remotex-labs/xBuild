/**
 * Import will remove at compile time
 */

import type { OutputFile } from 'typescript';

/**
 * Represents the result of a TypeScript compilation emit operation.
 *
 * @property outputFile - The emitted output file information,
 *   or undefined if no file was emitted. Contains details such as file name, content,
 *   and any related metadata.
 *
 * @property emitSkipped - Indicates whether the emit operation was skipped.
 *   When true, typically indicates compilation errors prevented emission or the operation
 *   was explicitly configured to skip emission.
 *
 * @remarks
 * This interface is used to represent the result of TypeScript declaration emit operations.
 *
 * @since 1.5.9
 */

export interface EmitOutputInterface {
    outputFile: OutputFile | undefined;
    emitSkipped: boolean;
}
