/**
 * An enumeration of ANSI color codes used for text formatting in the terminal.
 *
 * These colors can be used to format terminal output with various text colors,
 * including different shades of gray, yellow, and orange, among others.
 *
 * Each color code starts with an ANSI escape sequence (`\u001B`), followed by the color code.
 * The `Reset` option can be used to reset the terminal's text formatting back to the default.
 *
 * @example
 * ```ts
 * console.log(Color.BrightPink, 'This is bright pink text', Color.Reset);
 * ```
 */

export const enum Colors {
    Reset = '\u001B[0m',
    Red = '\u001B[38;5;9m',
    Gray = '\u001B[38;5;243m',
    Cyan = '\u001B[38;5;81m',
    DarkGray = '\u001B[38;5;238m',
    LightCoral = '\u001B[38;5;203m',
    LightOrange = '\u001B[38;5;215m',
    OliveGreen = '\u001B[38;5;149m',
    BurntOrange = '\u001B[38;5;208m',
    LightGoldenrodYellow = '\u001B[38;5;221m',
    LightYellow = '\u001B[38;5;230m',
    CanaryYellow = '\u001B[38;5;227m',
    DeepOrange = '\u001B[38;5;166m',
    LightGray = '\u001B[38;5;252m',
    BrightPink = '\u001B[38;5;197m'
}

/**
 * Formats a message string with the specified ANSI color and optionally resets it after the message.
 *
 * This function applies an ANSI color code to the provided message,
 * and then appends the reset code to ensure that the color formatting doesn't extend beyond the message.
 * It's useful for outputting colored text in a terminal. If color formatting is not desired,
 * the function can return the message unformatted.
 *
 * @param color - The ANSI color code to apply. This is used only if `activeColor` is true.
 * @param msg - The message to be formatted with the specified color.
 * @param activeColor - A boolean flag indicating whether color formatting should be applied. Default is `__ACTIVE_COLOR`.
 *
 * @returns A string with the specified color applied to the message,
 * followed by a reset sequence if `activeColor` is true.
 *
 * @example
 * ```ts
 * const coloredMessage = setColor(Colors.LightOrange, 'This is a light orange message');
 * console.log(coloredMessage);
 * ```
 *
 * @example
 * ```ts
 * const plainMessage = setColor(Colors.LightOrange, 'This is a light orange message', false);
 * console.log(plainMessage); // Output will be without color formatting
 * ```
 */


export function setColor(color: Colors, msg: string, activeColor: boolean = __ACTIVE_COLOR): string {
    if (!activeColor)
        return msg;

    return `${ color }${ msg }${ Colors.Reset }`;
}

