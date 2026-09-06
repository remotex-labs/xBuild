/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { PartialConfigurationType } from '@interfaces/configuration.interface';

/**
 * The configuration that a build starts from, before a file or a flag says otherwise.
 *
 * @remarks
 * The object, its `common` block, and its `esbuild` block are each frozen,
 * so nothing can rewrite the defaults for every other consumer that reads them.
 * {@link ConfigurationService} copies it on the way in rather than holding it directly,
 * which is what keeps the freeze from turning an ordinary patch into a failure.
 * `absWorkingDir` is read when this module is first imported, so it records the directory the process started in
 * rather than wherever a later build happens to look.
 *
 * @example
 * ```ts
 * DefaultsCommonConfig.common?.esbuild?.format; // 'cjs'
 * DefaultsCommonConfig.common?.esbuild?.outdir; // 'dist'
 * ```
 *
 * @see ConfigurationService
 * @since 3.0.0
 */

export const DefaultsCommonConfig: PartialConfigurationType = Object.freeze({
    common: Object.freeze({
        types: true,
        logOverride: {},
        declaration: true,
        esbuild: Object.freeze({
            write: true,
            bundle: true,
            minify: true,
            format: 'cjs',
            outdir: 'dist',
            platform: 'browser',
            absWorkingDir: process.cwd(),
            legalComments: 'none'
        })
    })
});
