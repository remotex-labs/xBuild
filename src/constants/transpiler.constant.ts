/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { BuildOptions } from 'esbuild';

/**
 * Base esbuild options every build in this package starts from.
 *
 * @remarks
 * Output is kept in memory rather than written,
 * so a caller reads `outputFiles` and decides for itself what reaches the disk.
 * The source map is emitted as its own output file rather than inlined,
 * which keeps the code readable and lets a consumer attach the map only when it wants it.
 * An output directory is set even though nothing is written,
 * since esbuild insists on one as soon as a build has more than a single entry point.
 * Spread before the caller's options wherever it is used,
 * so any of these can be overridden - unlike the options each build helper fixes after them.
 *
 * @example
 * ```ts
 * defaultBuildOptions.write;                                            // false - the result is returned, not written
 * await buildFiles({ entryPoints: [ 'src/index.ts' ], minify: false }); // overrides one, keeps the rest
 * ```
 *
 * @see BuildOptions
 * @since 2.0.0
 */

export const DefaultBuildOptions: BuildOptions = {
    write: false,
    bundle: true,
    minify: true,
    outdir: 'dist',
    format: 'cjs',
    target: 'esnext',
    logLimit: 0,
    logLevel: 'silent',
    platform: 'browser',
    sourcemap: 'external'
};
