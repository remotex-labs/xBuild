/**
 * Imports
 */

import { xterm } from '@remotex-labs/xansi/xterm.component';

/**
 * Style token for a step that finished as it should.
 *
 * @remarks
 * Green.
 * Reserved for an outcome the reader can stop reading at, so a step that merely progressed stays unstyled.
 *
 * @example
 * ```ts
 * console.log(okColor('build finished'));
 * ```
 *
 * @since 2.0.0
 */

export const okColor = xterm.hex('#80a36b');

/**
 * Style token for ordinary body text.
 *
 * @remarks
 * Neutral light.
 * The default weight everything else is read against, so it carries no meaning of its own.
 *
 * @example
 * ```ts
 * console.log(textColor('4 entry points'));
 * ```
 *
 * @since 2.0.0
 */

export const textColor = xterm.hex('#dcdfe4');

/**
 * Style token for a notice the reader may act on but need not.
 *
 * @remarks
 * Blue.
 * Distinguished from {@link warnColor} by carrying no fault - it reports what happened rather than what went wrong.
 *
 * @example
 * ```ts
 * console.log(infoColor('watching for changes'));
 * ```
 *
 * @since 2.0.0
 */

export const infoColor = xterm.hex('#5798cd');

/**
 * Style token for something suspect that did not stop the build.
 *
 * @remarks
 * Yellow.
 * The middle ground between {@link infoColor} and {@link errorColor}, for output worth reading after the run.
 *
 * @example
 * ```ts
 * console.log(warnColor('3 files matched no entry point'));
 * ```
 *
 * @since 2.0.0
 */

export const warnColor = xterm.hex('#e5c07b');

/**
 * Style token for a file path, a URL, or a location.
 *
 * @remarks
 * Cyan.
 * Marks the part of a line the reader is most likely to copy, so it stays distinct inside an otherwise styled message.
 *
 * @example
 * ```ts
 * console.log(pathColor('src/index.ts'));
 * ```
 *
 * @since 2.0.0
 */

export const pathColor = xterm.hex('#56b6c2');

/**
 * Style token for a failure.
 *
 * @remarks
 * Red.
 * For an outcome that stopped the work, which keeps it rare enough to still register when it appears.
 *
 * @example
 * ```ts
 * console.log(errorColor('Cannot resolve module'));
 * ```
 *
 * @since 2.0.0
 */

export const errorColor = xterm.hex('#e06c75');

/**
 * Style token for a keyword or an identifier quoted inside a message.
 *
 * @remarks
 * Purple.
 * Picks a name out of surrounding prose the way {@link pathColor} picks out a location.
 *
 * @example
 * ```ts
 * console.log(keywordColor('bundleDeclaration'));
 * ```
 *
 * @since 2.0.0
 */

export const keywordColor = xterm.hex('#c678dd');

/**
 * Style token for text that belongs on the line but not at the front of the reader's attention.
 *
 * @remarks
 * Muted gray.
 * For figures that qualify a message rather than carry it, such as a timing or a count.
 *
 * @example
 * ```ts
 * console.log(mutedColor('in 412ms'));
 * ```
 *
 * @since 2.0.0
 */

export const mutedColor = xterm.hex('#a5a7ab');
