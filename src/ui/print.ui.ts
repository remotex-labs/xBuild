/**
 * Imports
 */

import { stdout } from 'process';
import { prefix } from '@ui/banner.ui';
import { infoColor } from '@ui/color.ui';
import * as readline from 'node:readline';

export const INDENT = '   ';
export const KILOBYTE = 1024;
export const MEGABYTE = KILOBYTE * 1024;
export const DASH_SYMBOL = '—';
export const ARROW_SYMBOL = '→';
export const ERROR_SYMBOL = '×';
export const WARNING_SYMBOL = '•';

export function createActionPrefix(action: string, symbol: string = infoColor.dim(ARROW_SYMBOL)): string {
    return `${ prefix() } ${ symbol } ${ infoColor(action) }`;
}

export function clearScreen(): void {
    const repeatCount = Math.max(0, stdout.rows - 2);
    if (repeatCount > 0) {
        console.log('\n'.repeat(repeatCount));
    }

    readline.cursorTo(stdout, 0, 0);
    readline.clearScreenDown(stdout);
}
