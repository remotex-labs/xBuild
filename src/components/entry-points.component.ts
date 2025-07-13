/**
 * Import will remove at compile time
 */

import type { EntryPointsType } from '@configuration/interfaces/configuration.interface';

/**
 * Imports
 */

import { xBuildError } from '@errors/xbuild.error';

/**
 * Maps an array of file paths to an object where the keys are filenames (without extensions)
 * and the values are the corresponding file paths.
 *
 * Each key in the resulting object is derived from the filename by removing the file extension.
 * For example, given a file path `src/index.ts`, the key in the resulting object will be `src/index`.
 *
 * @param filePaths - An array of file paths to map. Each file path should be a string.
 * @returns An object where the keys are filenames (without extensions) and the values are the corresponding file paths.
 *
 * @example
 * ```ts
 * const filePaths = ['src/index.ts', 'src/utils.ts'];
 * const result = mapFilePathsToNames(filePaths);
 * console.log(result);
 * // Output: {
 * //   'src/index': 'src/index.ts',
 * //   'src/utils': 'src/utils.ts'
 * // }
 * ```
 */

export function mapFilePathsToNames(filePaths: Array<string>): Record<string, string> {
    const result: Record<string, string> = {};

    filePaths.forEach(filePath => {
        // Extract the filename without extension
        const fileName = filePath.substring(0, filePath.lastIndexOf('.'));
        // Map the filename to the file path
        result[fileName] = filePath;
    });

    return result;
}

/**
 * Extracts and returns an object mapping output file paths to input file paths from the provided `EntryPointsType` object.
 *
 * This function handles multiple formats of entry points, including:
 * - An array of strings representing file paths.
 * - An array of objects containing `in` and `out` properties, where `in` is the input file path and `out` is the output file path.
 * - A `Record<string, string>` where the keys represent input file paths and the values represent output file paths.
 *
 * Depending on the format, the function constructs an object with the output file paths as keys and the input file paths as values.
 * If the output path is not available, the filename (without extension) is used as the key.
 *
 * If a regular object with string keys and values (not in the supported formats) is provided, it will be returned as is.
 *
 * @param entryPoints - The entry points to extract from, which can be in different formats: an array of strings,
 * an array of objects with `in` and `out` properties, or a `Record<string, string>`.
 *
 * @returns An object mapping output file paths to input file paths, or filename (without extension) to file path.
 *
 * @throws Will throw an `Error` if the entry points format is unsupported.
 *
 * @example
 * ```ts
 * const entryPoints = extractEntryPoints(['src/index.ts', 'src/utils.ts']);
 * console.log(entryPoints); // { 'index': 'src/index.ts', 'utils': 'src/utils.ts' }
 * ```
 *
 * @example
 * ```ts
 * const entryPoints = extractEntryPoints([{ in: 'src/index.ts', out: 'dist/index.js' }]);
 * console.log(entryPoints); // { 'dist/index.js': 'src/index.ts' }
 * ```
 *
 * @example
 * ```ts
 * const entryPoints = extractEntryPoints({ index: 'src/index.ts', index2: 'dist/index2.js' });
 * console.log(entryPoints); // { index: 'src/index.ts', index2: 'dist/index2.js' }
 * ```
 */

export function extractEntryPoints(entryPoints: EntryPointsType): Record<string, string> {
    if (Array.isArray(entryPoints)) {
        let result: Record<string, string> = {};

        if (entryPoints.length > 0 && typeof entryPoints[0] === 'object') {
            (entryPoints as { in: string, out: string }[]).forEach(entry => {
                result[entry.out] = entry.in;
            });
        } else if (typeof entryPoints[0] === 'string') {
            result = mapFilePathsToNames(<Array<string>> entryPoints);
        }

        return result;
    } else if (entryPoints && typeof entryPoints === 'object') {
        return entryPoints;
    }

    throw new xBuildError('Unsupported entry points format');
}
