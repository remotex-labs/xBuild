/**
 * Imports
 */

import { xterm } from '@remotex-labs/xansi/xterm.component';

/**
 * The xBuild wordmark drawn in ASCII art.
 *
 * @remarks
 * Opens and closes with a newline, so it stands on its own lines wherever it is printed.
 * The backslashes are escaped for the template literal,
 * so the string holds one backslash everywhere the source shows two.
 *
 * @example
 * ```ts
 * console.log(asciiLogo);
 * ```
 *
 * @see bannerUi
 * @since 1.0.0
 */

export const asciiLogo = `
     ______       _ _     _
     | ___ \\     (_) |   | |
__  _| |_/ /_   _ _| | __| |
\\ \\/ / ___ \\ | | | | |/ _\` |
 >  <| |_/ / |_| | | | (_| |
/_/\\_\\____/ \\__,_|_|_|\\__,_|
`;

/**
 * Renders the startup banner, the logo above the version.
 *
 * @returns The banner as one string, colored and ready to print
 *
 * @remarks
 * The logo is drawn in burnt orange and the version in bright pink.
 * Every line opens with a carriage return, so the text starts at column zero
 * whatever indentation the template literal carries.
 * The version reads `__VERSION`, which the build replaces with the `package.json` version at compile time.
 *
 * @example
 * ```ts
 * console.log(bannerComponent());
 * ```
 *
 * @see asciiLogo
 * @since 1.0.0
 */

export function bannerUi(): string {
    return `
        \r${ xterm.burntOrange(asciiLogo) }
        \rVersion: ${ xterm.brightPink(__VERSION) }
    \r`;
}

/**
 * The `[xBuild]` tag that marks a line as coming from the build.
 *
 * @returns The tag in light coral
 *
 * @remarks
 * Prepended to log lines so xBuild output stays recognizable when several tools write to the same console.
 *
 * @example
 * ```ts
 * console.log(`${ prefix() } Starting build`); // [xBuild] Starting build
 * ```
 *
 * @since 1.0.0
 */

export function prefix(): string {
    return xterm.lightCoral('[xBuild]');
}
