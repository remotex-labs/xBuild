/**
 * Maps terminal control codes to exit signal identifiers.
 *
 * @remarks
 * This constant object defines the ANSI escape sequences for common
 * terminal interrupt signals. These are used to detect when users
 * attempt to terminate the application via keyboard shortcuts.
 *
 * The signals are:
 * - `\x03` (Ctrl+C) - SIGINT signal for interrupting the process
 * - `\x04` (Ctrl+D) - SIGQUIT signal for quitting the process
 *
 * @example
 * ```ts
 * if (code === EXIT_SIGNALS.SIGINT) {
 *   console.log('Caught Ctrl+C, exiting...');
 *   process.exit(1);
 * }
 * ```
 *
 * @see WatchModule
 * @since 2.0.0
 */


export const EXIT_SIGNALS = {
    SIGINT: '\x03',  // Ctrl+C
    SIGQUIT: '\x04'  // Ctrl+D
} as const;

/**
 * Maps keyboard shortcuts to their corresponding action identifiers.
 *
 * @remarks
 * This constant object defines the single-character keys used for interactive terminal commands.
 * Each key triggers a specific development action such as restarting the server or clearing the console.
 *
 * The mappings are:
 * - `h` - Display help/shortcuts
 * - `q` - Quit the application
 * - `c` - Clear console
 * - `r` - Restart the server
 * - `u` - Show server URL
 * - `o` - Open in browser
 *
 * @example
 * ```ts
 * if (key.name === KEY_MAPPINGS.RELOAD) {
 *   console.log('Restarting server...');
 * }
 * ```
 *
 * @see WatchModule
 * @since 2.0.0
 */

export const KEY_MAPPINGS = {
    HELP: 'h',
    QUIT: 'q',
    CLEAR: 'c',
    RELOAD: 'r',
    VERBOSE: 'v',
    SHOW_URL: 'u',
    OPEN_BROWSER: 'o'
} as const;

/**
 * Maps operating system platform identifiers to their browser-opening commands.
 *
 * @remarks
 * This constant object provides the appropriate shell command for opening
 * URLs in the default browser on different operating systems. It is used
 * by {@link openInBrowser} to ensure cross-platform compatibility.
 *
 * The platform commands are:
 * - `win32` - Windows: `start`
 * - `darwin` - macOS: `open`
 * - `linux` - Linux: `xdg-open`
 *
 * For unsupported platforms, `xdg-open` is used as a fallback.
 *
 * @example
 * ```ts
 * const platform = process.platform as keyof typeof COMMAND_MAP;
 * const command = COMMAND_MAP[platform] ?? 'xdg-open';
 * exec(`${command} http://localhost:3000`);
 * ```
 *
 * @see WatchModule
 * @since 2.0.0
 */

export const COMMAND_MAP = {
    win32: 'start',
    darwin: 'open',
    linux: 'xdg-open'
} as const;
