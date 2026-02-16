/**
 * Imports
 */

import readline from 'readline';
import { exec } from 'child_process';
import { patchConfig } from '../index';
import { inject } from '@symlinks/symlinks.module';
import { prefix } from '@components/banner.component';
import { platform, exit, stdin, stdout } from 'process';
import { xterm } from '@remotex-labs/xansi/xterm.component';
import { ConfigurationService } from '@services/configuration.service';
import { EXIT_SIGNALS, KEY_MAPPINGS, COMMAND_MAP } from '@components/constants/interactive.constant';

/**
 * Generates a formatted help message displaying available keyboard shortcuts.
 *
 * @param activeUrl - Whether to include URL-related shortcuts (show/open in browser)
 * @returns A formatted multi-line string containing all available shortcuts
 *
 * @remarks
 * Dynamically builds a help menu based on the current context. When a server is active
 * (indicated by `activeUrl`), additional shortcuts for URL display and browser opening are included.
 *
 * The output uses ANSI styling via {@link xterm} for visual hierarchy:
 * - Dimmed prefix text "press"
 * - Bold key name
 * - Dimmed action description
 *
 * **Shortcuts included**:
 * - `u` - Show server URL (when `activeUrl` is true)
 * - `o` - Open in browser (when `activeUrl` is true)
 * - `v` - Toggle verbose mode
 * - `r` - Reload/restart build
 * - `c` - Clear console
 * - `q` - Quit application
 *
 * @example
 * ```ts
 * const helpText = generateHelp(true);
 * console.log(helpText);
 * // Output:
 * // 🚀 Shortcuts
 * //   press u to show server url
 * //   press o to open in browser
 * //   press v to enable / disable verbose mode
 * //   ...
 * ```
 *
 * @see {@link xterm} for ANSI styling
 * @see {@link KEY_MAPPINGS} for key definitions
 *
 * @since 2.0.0
 */

export function generateHelp(activeUrl: boolean = false): string {
    const shortcuts: Array<string> = [ '🚀 Shortcuts' ];
    const prefix = xterm.dim('  press ');

    const addShortcut = (key: string, description: string): void => {
        shortcuts.push(`${ prefix }${ xterm.bold(key) }${ xterm.dim(description) }`);
    };

    if (activeUrl) {
        addShortcut(KEY_MAPPINGS.SHOW_URL, ' to show server url');
        addShortcut(KEY_MAPPINGS.OPEN_BROWSER, ' to open in browser');
    }

    addShortcut(KEY_MAPPINGS.VERBOSE, ' to enable / disable verbose mode');
    addShortcut(KEY_MAPPINGS.RELOAD, ' to reload');
    addShortcut(KEY_MAPPINGS.CLEAR, ' to clear console');
    addShortcut(KEY_MAPPINGS.QUIT, ' to quit\n');

    return shortcuts.join('\n');
}

/**
 * Clears the terminal screen without scrollback, moving the cursor to the top.
 *
 * @remarks
 * Performs a visual clear by:
 * 1. Calculating available terminal rows (minus 2 for buffer)
 * 2. Printing newlines to push content out of view
 * 3. Moving cursor to position (0, 0)
 * 4. Clearing all content from the cursor downward
 *
 * This approach ensures a clean visual reset without modifying scrollback history.
 * The function is safe to call regardless of terminal size; it handles small terminals
 * gracefully by ensuring `repeatCount` is never negative.
 *
 * @example
 * ```ts
 * // User presses 'c' to clear console
 * clearScreen();
 * // Terminal is cleared, cursor at top-left
 * ```
 *
 * @see {@link handleKeypress} for usage in keypress handling
 *
 * @since 2.0.0
 */

export function clearScreen(): void {
    const repeatCount = Math.max(0, stdout.rows - 2);
    if (repeatCount > 0) {
        console.log('\n'.repeat(repeatCount));
    }

    readline.cursorTo(stdout, 0, 0);
    readline.clearScreenDown(stdout);
}

/**
 * Opens the specified URL in the system's default browser.
 *
 * @param url - The URL to open in the browser
 *
 * @remarks
 * Provides cross-platform browser opening by executing the appropriate shell command
 * for the current operating system:
 * - **Windows**: `start <url>`
 * - **macOS**: `open <url>`
 * - **Linux**: `xdg-open <url>` (also used as fallback)
 *
 * The function uses Node.js {@link exec} to spawn the command asynchronously.
 * No error handling is performed; if the command fails, it silently continues.
 *
 * @example
 * ```ts
 * // User presses 'o' to open server URL
 * openInBrowser('http://localhost:3000');
 * // Browser opens with the specified URL
 * ```
 *
 * @see {@link COMMAND_MAP} for platform-to-command mapping
 * @see {@link handleKeypress} for usage in keypress handling
 *
 * @since 2.0.0
 */

export function openInBrowser(url: string): void {
    const command = COMMAND_MAP[<keyof typeof COMMAND_MAP> platform] ?? 'xdg-open';
    exec(`${ command } ${ url }`);
}

/**
 * Handles keyboard input events and executes corresponding actions.
 *
 * @param code - The raw character code from the keypress event
 * @param key - The parsed key information including name, sequence, and modifiers
 * @param reload - Callback function to trigger a build reload/restart
 * @param help - Pre-generated help text to display when help key is pressed
 * @param url - Optional server URL for URL display and browser opening features
 *
 * @remarks
 * Acts as the central dispatcher for interactive terminal commands. Processes both
 * exit signals (Ctrl+C, Ctrl+D) and single-key shortcuts, executing appropriate actions
 * for each recognized input.
 *
 * **Processing flow**:
 * 1. Validates key information exists
 * 2. Checks for exit signals → exits with code 1
 * 3. Matches key name against {@link KEY_MAPPINGS}
 * 4. Executes corresponding action (clear, reload, toggle verbose, etc.)
 *
 * **Available actions**:
 * - **Clear** (`c`): Clears the terminal screen
 * - **Verbose** (`v`): Toggles verbose/debug mode via {@link ConfigurationService}
 * - **Reload** (`r`): Clears screen and invokes the reload callback
 * - **Help** (`h`): Displays the help menu
 * - **Show URL** (`u`): Prints the server URL (if provided)
 * - **Open Browser** (`o`): Opens the server URL in browser (if provided)
 * - **Quit** (`q`): Exits the process with a goodbye message
 *
 * The function safely handles cases where `url` is undefined by checking existence
 * before executing URL-dependent actions.
 *
 * @example Basic usage
 * ```ts
 * handleKeypress('r', { name: 'r' }, async () => rebuild(), helpText);
 * // Clears screen and triggers rebuild
 * ```
 *
 * @example Exit signal
 * ```ts
 * handleKeypress('\x03', { name: 'c', sequence: '\x03' }, reload, help);
 * // Prints "👋 Exiting..." and exits with code 1
 * ```
 *
 * @example Toggle verbose
 * ```ts
 * // Current verbose: false
 * handleKeypress('v', { name: 'v' }, reload, help);
 * // Prints: "🐞 Debug mode: ENABLED"
 * // Updates config: { verbose: true }
 * ```
 *
 * @see {@link init} for event listener setup
 * @see {@link EXIT_SIGNALS} for exit signal codes
 * @see {@link KEY_MAPPINGS} for recognized key names
 *
 * @since 2.0.0
 */

export function handleKeypress(code: string, key: readline.Key, reload: () => void, help: string, url?: string): void {
    if (!key?.name) return;
    if (key.sequence === KEY_MAPPINGS.QUIT || code === EXIT_SIGNALS.SIGINT || code === EXIT_SIGNALS.SIGQUIT) {
        console.log('\n👋 Exiting...');
        exit(1);
    }

    switch (key.name) {
        case KEY_MAPPINGS.CLEAR:
            clearScreen();
            break;
        case KEY_MAPPINGS.VERBOSE:
            const verbose = inject(ConfigurationService).getValue(cfg => cfg.verbose);
            console.log(`🐞 Debug mode: ${ !verbose ? 'ENABLED' : 'DISABLED' }`);
            patchConfig({ verbose: !verbose });
            break;
        case KEY_MAPPINGS.RELOAD:
            clearScreen();
            reload();
            break;
        case KEY_MAPPINGS.HELP:
            clearScreen();
            console.log(help);
            break;
        case KEY_MAPPINGS.SHOW_URL:
            if (url) {
                console.log(`${ prefix() } ${ xterm.canaryYellow(url) }`);
            }
            break;
        case KEY_MAPPINGS.OPEN_BROWSER:
            if (url) {
                openInBrowser(url);
            }
            break;
    }
}

/**
 * Initializes the interactive terminal interface for watch mode.
 *
 * @param reload - Callback function to trigger a build reload/restart when requested
 * @param url - Optional server URL to enable URL-related shortcuts and functionality
 *
 * @remarks
 * Sets up the interactive development environment by configuring the terminal for raw
 * input mode and registering keypress event handlers. This function should be called
 * once during watch mode initialization.
 *
 * **Initialization flow**:
 * 1. **TTY check**: Exits early if stdin is not a TTY (e.g., piped input, CI environment)
 * 2. **Help generation**: Creates context-aware help text based on URL availability
 * 3. **Help display**: Prints the shortcuts menu immediately
 * 4. **Raw mode**: Enables character-by-character input without requiring Enter
 * 5. **Event setup**: Configures keypress event emission and registers handler
 *
 * **TTY requirement**:
 * Interactive mode is disabled when stdin is not a TTY. This prevents issues in:
 * - CI/CD pipelines
 * - Piped/redirected input scenarios
 * - Non-interactive shells
 *
 * **Raw mode implications**:
 * - Characters are processed immediately without buffering
 * - Standard terminal line editing (backspace, etc.) is disabled
 * - Allows single-key shortcuts without an Enter key
 *
 * The function keeps the process alive by registering an event listener, which should
 * persist for the duration of the watch session.
 *
 * @example Basic initialization
 * ```ts
 * // In watch mode without server
 * init(async () => {
 *   await rebuild();
 * });
 * // Displays shortcuts without URL options
 * ```
 *
 * @example With server URL
 * ```ts
 * // In watch mode with dev server
 * init(async () => {
 *   await rebuild();
 * }, 'http://localhost:3000');
 * // Displays all shortcuts including 'u' and 'o'
 * ```
 *
 * @example Non-TTY environment (CI)
 * ```ts
 * // stdin.isTTY === false
 * init(reload, url);
 * // Function returns immediately without setup
 * ```
 *
 * @see {@link generateHelp} for help text generation
 * @see {@link handleKeypress} for keypress handling logic
 *
 * @since 2.0.0
 */

export function init(reload: () => void, url?: string): void {
    if (!stdin.isTTY) return;
    const helpString = generateHelp(!!url);
    console.log(helpString);

    stdin.setRawMode(true);
    readline.emitKeypressEvents(stdin);
    stdin.on('keypress', (code, key) => {
        handleKeypress(code, key, reload, helpString, url);
    });
}

