/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BuildOptions } from 'esbuild';

/**
 * Imports
 */

import { cwd } from 'process';
import { relative } from '@remotex-labs/xmap';
import { collectFiles } from '@components/glob.component';
import { FrameworkService } from '@services/framework.service';

/**
 * Normalizes entry points of any esbuild form into an output name to input path record.
 *
 * @param entryPoints - Entry points in any form esbuild accepts, or `undefined`
 * @param root - Directory the output names are shortened against, defaulting to the working directory
 * @returns The entry points keyed by the output each one produces, or `undefined` when none were given
 *
 * @throws Error - When the entry points are neither an array, an object, nor `undefined`
 *
 * @remarks
 * The three forms differ only in where the output name comes from:
 * - A list of globs is matched from the working directory, and each file is keyed by its path with `root` stripped
 *   off the front and the extension dropped, so `src` as the root turns `src/components/interactive.component.ts`
 *   into `components/interactive.component`.
 * - A list of `in` and `out` pairs is keyed by `out`, both paths passing through untouched.
 * - A record is already in the target shape and is returned as it stands, without a copy.
 *
 * Globs are always matched from the working directory, whatever `root` says: `root` shortens the output names and
 * does nothing else, matching no files itself and excluding none.
 * A file the globs reach from outside `root` is therefore kept rather than dropped,
 * and is named by its whole path from the working directory instead.
 * One call can therefore carry files from either side of `root`:
 * an outside file lands in a directory of its own in the output, while an inside file lands at the top.
 * The values are the paths the walk produced, relative to the working directory,
 * so nothing is resolved a second time, and a key costs one slice.
 * An empty list yields an empty record rather than every file under the working directory, which a pattern set with
 * no includes would otherwise match.
 *
 * @example
 * ```ts
 * extractEntryPoints([ 'src/**' ]);
 * // { 'src/index': 'src/index.ts', 'src/components/glob.component': 'src/components/glob.component.ts' }
 *
 * extractEntryPoints([ 'src/**' ], 'src/components');
 * // {
 * //     'glob.component': 'src/components/glob.component.ts',    // under the root, shortened to its own name
 * //     'src/services/vm.service': 'src/services/vm.service.ts'  // outside it, named by its whole path
 * // }
 *
 * extractEntryPoints([ { in: 'src/index.ts', out: 'bundle' } ]);
 * // { bundle: 'src/index.ts' }
 * ```
 *
 * @see collectFiles
 * @see {@link https://esbuild.github.io/api/#entry-points | esbuild entry points}
 *
 * @since 3.0.0
 */

export function extractEntryPoints(entryPoints: BuildOptions['entryPoints'], root: string = cwd()): Record<string, string> | undefined {
    if (entryPoints === undefined) return undefined;
    if (!Array.isArray(entryPoints)) {
        if (typeof entryPoints !== 'object' || entryPoints === null) throw new Error('Unsupported entry points format');

        return entryPoints;
    }

    const result: Record<string, string> = {};
    if (entryPoints.length < 1) return result;

    if (typeof entryPoints[0] === 'object') {
        for (const entry of <Array<{ in: string, out: string }>> entryPoints) result[entry.out] = entry.in;

        return result;
    }

    const prefix = relative(cwd(), FrameworkService.resolve(root));
    const scope = prefix && prefix !== '.' ? `${ prefix }/` : '';

    for (const file of collectFiles(cwd(), <Array<string>> entryPoints)) {
        const name = scope && file.startsWith(scope) ? file.slice(scope.length) : file;
        const dot = name.lastIndexOf('.');
        result[dot > name.lastIndexOf('/') + 1 ? name.slice(0, dot) : name] = file;
    }

    return result;
}
