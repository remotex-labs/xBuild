/**
 * Import will remove at compile time
 */

import type { BuildOptions } from 'esbuild';

/**
 * Imports
 */

import { xBuildError } from '@errors/xbuild.error';
import { collectFilesFromGlob } from '@components/glob.component';

/**
 * Extracts and normalizes entry points from various esbuild entry point formats.
 *
 * @param baseDir - Base directory to resolve glob patterns from
 * @param entryPoints - Entry points in any esbuild-supported format
 * @returns Normalized object mapping output names to input file paths
 *
 * @remarks
 * Supports three esbuild entry point formats:
 *
 * **Array of strings (glob patterns):**
 * - Treats entries as glob patterns to match files
 * - Keys are filenames without extensions
 *
 * **Array of objects with `in` and `out` properties:**
 * - `in`: Input file path
 * - `out`: Output file path
 * - Keys are the `out` values
 *
 * **Record object:**
 * - Keys are output names
 * - Values are input file paths
 * - Returned as-is without modification
 *
 * @throws {@link xBuildError}
 * Thrown when entry points format is unsupported or invalid
 *
 * @example
 * Array of glob patterns:
 * ```ts
 * const entries = extractEntryPoints('./src', ['**\/*.ts', '!**\/*.test.ts']);
 * // Returns: { 'index': 'index.ts', 'utils/helper': 'utils/helper.ts' }
 * ```
 *
 * @example
 * Array of in/out objects:
 * ```ts
 * const entries = extractEntryPoints('./src', [
 *   { in: 'src/index.ts', out: 'bundle' },
 *   { in: 'src/worker.ts', out: 'worker' }
 * ]);
 * // Returns: { 'bundle': 'src/index.ts', 'worker': 'src/worker.ts' }
 * ```
 *
 * @example
 * Record object:
 * ```ts
 * const entries = extractEntryPoints('./src', {
 *   main: 'src/index.ts',
 *   worker: 'src/worker.ts'
 * });
 * // Returns: { 'main': 'src/index.ts', 'worker': 'src/worker.ts' }
 * ```
 *
 * @see {@link https://esbuild.github.io/api/#entry-points|esbuild Entry Points}
 *
 * @since 2.0.0
 */

export function extractEntryPoints(baseDir: string, entryPoints: BuildOptions['entryPoints']): Record<string, string> {
    if (Array.isArray(entryPoints)) {
        let result: Record<string, string> = {};

        if (entryPoints.length > 0 && typeof entryPoints[0] === 'object') {
            (entryPoints as { in: string, out: string }[]).forEach(entry => {
                result[entry.out] = entry.in;
            });
        } else if (typeof entryPoints[0] === 'string') {
            result =  collectFilesFromGlob(baseDir, <Array<string>> entryPoints);
        }

        return result;
    } else if (entryPoints && typeof entryPoints === 'object') {
        return entryPoints;
    }

    throw new xBuildError('Unsupported entry points format');
}
