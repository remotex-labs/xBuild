/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Metafile, BuildOptions, BuildResult } from 'esbuild';

/**
 * The result shape every build helper in this package returns.
 *
 * @remarks
 * Each helper fixes `metafile: true` after the caller's options, so a metafile is always there at runtime.
 * The type does not say so, since esbuild only drops the `undefined` from `metafile` when the options it is given
 * carry the literal `true`, which `BuildOptions & Metafile` does not.
 * A caller reading the field therefore still asserts it.
 *
 * @example
 * ```ts
 * const result: BuildResultType = await buildFiles({ entryPoints: [ 'src/index.ts' ] });
 * Object.keys(result.metafile!.inputs); // [ 'src/index.ts' ]
 * ```
 *
 * @see buildFiles
 * @since 3.0.0
 */

export type BuildResultType = BuildResult<BuildOptions & Metafile>;
