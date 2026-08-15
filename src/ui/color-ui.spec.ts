/**
 * Imports
 */

import { okColor, textColor, infoColor, warnColor } from './color.ui';
import { pathColor, mutedColor, errorColor, keywordColor } from './color.ui';

/**
 * Tests
 */

describe('color.component', () => {
    test.each`
        name              | token              | rgb
        ${ 'okColor' }      | ${ okColor }      | ${ '128;163;107' }
        ${ 'textColor' }    | ${ textColor }    | ${ '220;223;228' }
        ${ 'infoColor' }    | ${ infoColor }    | ${ '87;152;205' }
        ${ 'warnColor' }    | ${ warnColor }    | ${ '229;192;123' }
        ${ 'pathColor' }    | ${ pathColor }    | ${ '86;182;194' }
        ${ 'errorColor' }   | ${ errorColor }   | ${ '224;108;117' }
        ${ 'keywordColor' } | ${ keywordColor } | ${ '198;120;221' }
        ${ 'mutedColor' }   | ${ mutedColor }   | ${ '165;167;171' }
    `('should style text with the $name palette entry', ({ token, rgb }: any) => {
        expect(token('build finished')).toBe(`\x1B[38;2;${ rgb }mbuild finished\x1B[39m`);
    });
});
