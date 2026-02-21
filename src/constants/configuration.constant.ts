/**
 * Import will remove at compile time
 */

import type { PartialBuildConfigType } from '@interfaces/configuration.interface';

/**
 * Default build configuration shared across all variants.
 * Provides sensible defaults for common build settings including TypeScript compilation and esbuild options.
 *
 * @remarks
 * This frozen configuration object serves as the foundation for all builds when no custom
 * common configuration is provided. It establishes defaults for:
 * - Type checking enabled
 * - Declaration file generation enabled
 * - Bundle mode with minification
 * - CommonJS output format
 * - Browser platform target
 * - Output to `dist` directory
 *
 * All nested objects are deeply frozen using `Object.freeze()` to prevent accidental mutation
 * and ensure configuration immutability. This makes the defaults safe to reference without
 * defensive copying.
 *
 * These defaults are merged with user-provided configuration, with user values taking precedence.
 * Individual variants can override any of these settings for their specific build targets.
 *
 * @example
 * ```ts
 * // User config merges with defaults
 * const userConfig: BuildConfigInterface = {
 *   ...DEFAULTS_COMMON_CONFIG,
 *   common: {
 *     ...DEFAULTS_COMMON_CONFIG.common,
 *     esbuild: {
 *       ...DEFAULTS_COMMON_CONFIG.common?.esbuild,
 *       format: 'esm', // Override default 'cjs'
 *       minify: false  // Override default true
 *     }
 *   },
 *   variants: { ... }
 * };
 * ```
 *
 * @example
 * ```ts
 * // Accessing default values
 * const defaultFormat = DEFAULTS_COMMON_CONFIG.common?.esbuild?.format;
 * // 'cjs'
 *
 * const defaultOutDir = DEFAULTS_COMMON_CONFIG.common?.esbuild?.outdir;
 * // 'dist'
 * ```
 *
 * @see {@link TSCONFIG_PATH}
 * @see {@link PartialBuildConfigType}
 *
 * @since 2.0.0
 */

export const DEFAULTS_COMMON_CONFIG: PartialBuildConfigType = Object.freeze({
    verbose: false,
    common: Object.freeze({
        types: true,
        declaration: true,
        esbuild: Object.freeze({
            write: true,
            bundle: true,
            minify: true,
            format: 'cjs',
            outdir: 'dist',
            platform: 'browser',
            absWorkingDir: process.cwd()
        })
    })
});
