/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { LogLevelType } from '@providers/interfaces/log-provider.interface';

/**
 * The three spaces that indent one level of reported detail.
 *
 * @remarks
 * Wide enough to clear the symbol marking the line above,
 * so a message sits under the heading it belongs to rather than against the margin.
 * A code window and a trace are indented twice over, which sets them under the message they explain.
 *
 * @example
 * ```ts
 * `${ Indent }dist/index.js`; // '   dist/index.js'
 * ```
 *
 * @since 3.0.0
 */

export const Indent = '   ';

/**
 * The width a report is laid out in where the terminal reports none.
 *
 * @remarks
 * A pipe and a log file have no column count to answer with,
 * so the sizes a report sets against the right margin would have nothing to measure from.
 *
 * @example
 * ```ts
 * width(); // 100 - piped, so the terminal reported nothing
 * ```
 *
 * @see width
 * @since 3.0.0
 */

export const DefaultWidth = 100;

/**
 * How many outputs a build names before the rest are counted rather than listed.
 *
 * @remarks
 * A build of many entry points writes more than a reader wants to scroll,
 * so the largest few are named and what is left becomes one line carrying its count and its size.
 * Reporting at `verbose` lifts the limit rather than raising it.
 *
 * @example
 * ```ts
 * printOutputs(metafile);            // the six largest, then '· 12 more'
 * printOutputs(metafile, Infinity);  // all of them
 * ```
 *
 * @since 3.0.0
 */

export const OutputLimit = 6;

/**
 * The fewest rows a terminal can have and still give one up to the status line.
 *
 * @remarks
 * Below this the scrolling region would be shorter than the report it carries,
 * so the line is given up and the terminal keeps all of itself until it is resized larger.
 *
 * @since 3.0.0
 */

export const MinimumRows = 4;

/**
 * How long the status line waits between repaints, in milliseconds.
 *
 * @remarks
 * The beat is what brings the line back after a terminal is cleared from outside the run,
 * since the row remembers what it drew and would otherwise find nothing to redraw.
 * Short enough to read as immediate, long enough that a resting watch costs a repaint three times a second.
 *
 * @since 3.0.0
 */

export const RepaintInterval = 300;

/**
 * How long the terminal is given to say where the cursor is, in milliseconds.
 *
 * @remarks
 * A terminal that answers does so at once, so the wait is only ever spent on one that never will,
 * and a run under a terminal like that is taken to have filled the screen.
 *
 * @since 3.0.0
 */

export const ReportTimeout = 100;

/**
 * The number of bytes in one kilobyte.
 *
 * @remarks
 * Binary rather than decimal, `1024` rather than `1000`,
 * which is what makes a reported size agree with the one a file manager shows.
 *
 * @example
 * ```ts
 * 2048 / Kilobyte; // 2
 * ```
 *
 * @since 3.0.0
 */

export const Kilobyte = 1024;

/**
 * The number of bytes in one megabyte.
 *
 * @remarks
 * Derived from {@link Kilobyte} rather than written out, so the two cannot drift apart,
 * and binary for the same reason it is.
 *
 * @example
 * ```ts
 * Megabyte / Kilobyte; // 1024
 * ```
 *
 * @see Kilobyte
 * @since 3.0.0
 */

export const Megabyte = Kilobyte * 1024;

/**
 * The middle dot that separates one part of a line from the next.
 *
 * @remarks
 * A separator rather than a mark, so it stands between two values instead of opening a line,
 * which is what keeps it apart from {@link WarningSymbol}.
 * It also marks the quietest group of messages, where a bare dot is as much as a note deserves.
 *
 * @example
 * ```ts
 * `esm ${ DotSymbol } 12 ms`; // 'esm · 12 ms'
 * ```
 *
 * @since 3.0.0
 */

export const DotSymbol = '·';

/**
 * The arrow that marks work under way.
 *
 * @remarks
 * Opens the line of a variant while it builds and the line of every output a build wrote,
 * so a reader follows what is happening down the same column.
 * One of {@link SuccessSymbol} or {@link ErrorSymbol} takes its place once the build ends.
 *
 * @example
 * ```ts
 * `${ ArrowSymbol } building esm`; // '→ building esm'
 * ```
 *
 * @since 3.0.0
 */

export const ArrowSymbol = '→';

/**
 * The cross that marks a failure.
 *
 * @remarks
 * Closes the line of a variant that produced no output, and opens each of its errors,
 * so a run scanned from the left reads its failures without their text.
 *
 * @example
 * ```ts
 * `${ ErrorSymbol } esm`; // '× esm'
 * ```
 *
 * @see SuccessSymbol
 * @since 3.0.0
 */

export const ErrorSymbol = '×';

/**
 * The circular arrow that marks a rebuild.
 *
 * @remarks
 * Written when a watch starts the build again, beside the reason it restarted,
 * and again on the status line while the watch rests between builds.
 *
 * @example
 * ```ts
 * `${ ReloadSymbol } 2 files changed`; // '↻ 2 files changed'
 * ```
 *
 * @since 3.0.0
 */

export const ReloadSymbol = '↻';

/**
 * The bullet that marks a warning.
 *
 * @remarks
 * A filled dot rather than a cross, so a warning reads as quieter than a failure
 * and still stands out from a line carrying no mark at all.
 *
 * @example
 * ```ts
 * `${ WarningSymbol } unsupported require call`; // '• unsupported require call'
 * ```
 *
 * @see ErrorSymbol
 * @since 3.0.0
 */

export const WarningSymbol = '•';

/**
 * The check mark that marks a build that finished clean.
 *
 * @remarks
 * Closes the line of a variant that wrote its output, opposite {@link ErrorSymbol},
 * so the two read as one column of outcomes down the left of a run.
 *
 * @example
 * ```ts
 * `${ SuccessSymbol } esm in 128 ms`; // '✓ esm in 128 ms'
 * ```
 *
 * @see ErrorSymbol
 * @since 3.0.0
 */

export const SuccessSymbol = '✓';

/**
 * How loud each level is, as a number the levels can be compared by.
 *
 * @remarks
 * A report prints the groups that rank at or above the level the run is set to,
 * which needs an order that the level names do not carry on their own.
 * `silent` ranks above every group, so nothing reaches a run set to it.
 *
 * @example
 * ```ts
 * Levels.warning >= Levels.info; // true - warnings print at the info level
 * Levels.info >= Levels.error;   // false - info is quiet at the error level
 * ```
 *
 * @see LogLevelType
 * @since 3.0.0
 */

export const Levels: Record<LogLevelType, number> = { verbose: 0, info: 1, warning: 2, error: 3, silent: 4 };
