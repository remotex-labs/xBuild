/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BuildOptions, BuildResult, Metafile } from 'esbuild';
import type { BuildResultType } from '@services/interfaces/transpiler-service.interface';

/**
 * Imports
 */

import { cwd } from 'process';
import { build } from 'esbuild';
import { dirname, basename } from '@remotex-labs/xmap';
import { DefaultBuildOptions } from '@constants/transpiler.constant';

/**
 * Builds whatever the options describe and returns the result in memory.
 *
 * @typeParam T - Extra fields to widen the result with, for a caller that attaches its own
 *
 * @param buildOptions - esbuild options, the entry points among them, overriding {@link DefaultBuildOptions}
 * @returns The build result, carrying a metafile the type still marks optional
 *
 * @throws BuildFailure - Rejected by esbuild when the build fails, carrying its errors and warnings
 *
 * @remarks
 * Options are layered in four steps: the working directory, then {@link DefaultBuildOptions},
 * then the caller's own, and last the metafile.
 * Only the metafile is applied after the caller's, so it is the single option that cannot be turned off.
 * Everything else is the caller's to change, including the working directory and whether output is written at all.
 * Entry points travel in the options like any other setting,
 * so a build is described by a single object rather than by an argument and an object that have to agree.
 *
 * @example
 * ```ts
 * const result = await buildFiles({ entryPoints: [ 'src/index.ts' ] });
 *
 * result.outputFiles?.length;           // 2 - the source map and the code
 * Object.keys(result.metafile!.inputs); // [ 'src/index.ts', 'src/builder.ts' ]
 * ```
 *
 * @see DefaultBuildOptions
 * @since 3.0.0
 */

export async function buildFiles<T = object>(buildOptions: BuildOptions = {}): Promise<BuildResultType & T> {
    return await build({
        absWorkingDir: cwd(),
        ...DefaultBuildOptions,
        ...buildOptions,
        metafile: true
    }) as BuildResultType & T;
}

/**
 * Builds source text that has no file behind it.
 *
 * @typeParam T - Extra fields to widen the result with, for a caller that attaches its own
 *
 * @param source - TypeScript source to build
 * @param path - Name the source is reported under in its map and in errors, which need not exist on the disk
 * @param buildOptions - Options overriding {@link DefaultBuildOptions}
 * @returns The build result, carrying the code and its map in `outputFiles`
 *
 * @throws BuildFailure - Rejected by esbuild when the build fails, carrying its errors and warnings
 *
 * @remarks
 * The text is fed in through esbuild's `stdin` rather than read from a file,
 * which is what lets a macro body or a generated snippet be built before any file exists.
 * It is loaded as TypeScript, and its relative imports resolve against the working directory rather than against
 * `path`, which names the source in the map and in errors without pointing at a real location.
 * Four options are fixed after the caller's and cannot be overridden: the stdin input, in-memory output, the metafile,
 * and an external source map.
 * Logging is not among them: it arrives silent from {@link DefaultBuildOptions} and stays the caller's to raise.
 *
 * @example
 * ```ts
 * const result = await buildFromString('export const x: number = 42;', 'virtual.ts');
 *
 * result.outputFiles?.length;           // 2 - the source map and the code
 * Object.keys(result.metafile!.inputs); // [ 'virtual.ts' ] - keyed by the name that was passed
 * ```
 *
 * @see DefaultBuildOptions
 * @since 3.0.0
 */

export async function buildFromString<T = object>(source: string, path: string, buildOptions: BuildOptions = {}): Promise<BuildResultType & T> {
    return await build({
        absWorkingDir: cwd(),
        ...DefaultBuildOptions,
        ...buildOptions,
        stdin: {
            loader: 'ts',
            contents: source,
            resolveDir: dirname(path),
            sourcefile: basename(path)
        },
        write: false,
        metafile: true,
        sourcemap: 'external'
    }) as BuildResultType & T;
}

/**
 * Walks the imports of the entry points named in the options and returns the dependency graph, building no output.
 *
 * @param buildOptions - esbuild options, the entry points to walk among them, applied under the ones it fixes
 * @returns The result, its `metafile` describing every input reached and the imports between them
 *
 * @throws BuildFailure - Rejected by esbuild when a specifier does not resolve
 *
 * @remarks
 * Bundling is what does the walking,
 * so the graph matches what a bundler would resolve rather than a reading of the import statements.
 * An unresolvable specifier therefore fails the call instead of being reported as a missing edge.
 * Packages are marked external, so the walk stops at the project's edge rather than descending into `node_modules`.
 * Nothing reaches the disk: output is kept in memory,
 * and the output directory is nominal, named only because esbuild insists on one.
 * {@link DefaultBuildOptions} is not applied here, unlike {@link buildFiles}, so the caller's options and the seven
 * fixed after them are the whole of the configuration.
 *
 * @example
 * ```ts
 * const result = await analyzeDependencies({ entryPoints: [ 'src/index.ts' ] });
 *
 * Object.keys(result.metafile.inputs);            // [ 'src/index.ts', 'src/builder.ts' ]
 * result.metafile.inputs['src/index.ts'].imports; // [ { path: 'src/builder.ts', kind: 'import-statement' } ]
 * ```
 *
 * @see Metafile
 * @since 3.0.0
 */

export async function analyzeDependencies(buildOptions: BuildOptions = {}): Promise<
    BuildResult & { metafile: Metafile }
> {
    return await build({
        ...buildOptions,
        write: false,
        bundle: true,
        outdir: 'tmp',
        outfile: undefined,
        metafile: true,
        packages: 'external',
        logLevel: 'silent'
    });
}
