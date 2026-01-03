/**
 * Globals
 */

declare global {
    /**
     * Package version identifier.
     *
     * @remarks
     * A string constant that holds the current version of the `@remotex-labs/xbuild` package.
     * This global is automatically injected at compile time and is removed during bundling
     * to prevent runtime overhead.
     *
     * The version follows semantic versioning (MAJOR.MINOR.PATCH) format, with optional
     * pre-release identifiers (e.g., "1.0.0-local", "2.0.0-alpha.13").
     *
     * @example
     * ```ts
     * console.log(__VERSION); // "1.0.0-local"
     *
     * // Use in version checks or logging
     * if (__VERSION.includes('alpha')) {
     *   console.warn('Running unstable version');
     * }
     *
     * // Display version in banners or help text
     * console.log(`xBuild v${__VERSION}`);
     * ```
     *
     * @see {@link https://semver.org/} for semantic versioning specification
     *
     * @since 1.0.0
     * @readonly
     */

    const __VERSION: string;
}

export {};
