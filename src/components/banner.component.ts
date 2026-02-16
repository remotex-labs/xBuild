/**
 * Imports
 */

import { xterm } from '@remotex-labs/xansi/xterm.component';

/**
 * ASCII Logo and Version Information
 *
 * @remarks
 * The `asciiLogo` constant stores an ASCII representation of the project logo
 * that will be displayed in the banner. This banner is rendered in a formatted
 * string in the `bannerComponent` function.
 *
 * The `cleanScreen` constant contains an ANSI escape code to clear the terminal screen.
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
 * Renders the banner with the ASCII logo and version information.
 *
 * @returns A formatted string containing the ASCII logo and version number with color formatting
 *
 * @remarks
 * This function constructs and returns a formatted banner string that includes:
 * - An ASCII logo rendered in burnt orange
 * - The current version number displayed in bright pink
 *
 * The function uses ANSI color codes through the xterm utility to create visually
 * distinct elements in the banner. The version number is retrieved from the global
 * `__VERSION` variable.
 *
 * The banner is designed with appropriate spacing and carriage returns to ensure
 *  a consistent display across different terminal environments.
 *
 * @example
 * ```ts
 * // Display the banner in the console.
 * console.log(bannerComponent());
 * ```
 *
 * @since 1.0.0
 */

export function bannerComponent(): string {
    return `
        \r${ xterm.burntOrange(asciiLogo) }
        \rVersion: ${ xterm.brightPink(__VERSION) }
    \r`;
}

/**
 * Returns a formatted prefix string for xBuild log messages.
 *
 * @returns A string containing the xBuild prefix formatted in light coral color
 *
 * @remarks
 * This function creates a consistent, visually distinct prefix for all xBuild
 * logging output. The prefix is formatted with light coral coloring using the
 * xterm color utility to make xBuild logs easily identifiable in console output.
 *
 * The function is used throughout the build system to maintain consistent
 * log formatting and improve readability when multiple tools or processes
 * are outputting to the same console.
 *
 * @example
 * ```ts
 * // Basic usage in log messages
 * console.log(`${prefix()} Starting build process...`);
 * // Output: "[xBuild] Starting build process..." (with "[xBuild]" in light coral)
 *
 * // In a logger utility
 * function log(message: string): void {
 *   console.log(`${prefix()} ${message}`);
 * }
 * ```
 *
 * @since 1.0.0
 */

export function prefix(): string {
    return xterm.lightCoral('[xBuild]');
}
