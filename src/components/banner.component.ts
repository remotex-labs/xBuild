/**
 * Imports
 */

import { Colors, setColor } from '@components/colors.component';

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

// ANSI escape codes for colors
export const cleanScreen = '\x1Bc';

/**
 * Renders the banner with the ASCII logo and version information.
 *
 * This function constructs and returns a formatted banner string that includes an ASCII logo and the version number.
 * The colors used for the ASCII logo and version number can be enabled or disabled based on the `activeColor` parameter.
 * If color formatting is enabled, the ASCII logo will be rendered in burnt orange, and the version number will be in bright pink.
 *
 * @param activeColor - A boolean flag indicating whether ANSI color formatting should be applied. Default is `__ACTIVE_COLOR`.
 *
 * @returns A formatted string containing the ASCII logo, version number, and ANSI color codes if `activeColor` is `true`.
 *
 * @remarks
 * The `bannerComponent` function clears the terminal screen, applies color formatting if enabled, and displays
 * the ASCII logo and version number. The version number is retrieved from the global `__VERSION` variable, and
 * the colors are reset after the text is rendered.
 *
 * @example
 * ```ts
 * console.log(bannerComponent());
 * ```
 *
 * This will output the banner to the console with the ASCII logo, version, and colors.
 *
 * @example
 * ```ts
 * console.log(bannerComponent(false));
 * ```
 *
 * This will output the banner to the console with the ASCII logo and version number without color formatting.
 *
 * @public
 */

// Todo \r${ activeColor ? cleanScreen : '' }

export function bannerComponent(activeColor: boolean = true): string {
    return `
        \r${ setColor(Colors.BurntOrange, asciiLogo, activeColor) }
        \rVersion: ${ setColor(Colors.BrightPink, __VERSION, activeColor) }
    \r`;
}

/**
 * A formatted string prefix used for logging build-related messages.
 * // todo optimize this
 */

export function prefix(): string {
    return setColor(Colors.LightCoral, '[xBuild]');
}
