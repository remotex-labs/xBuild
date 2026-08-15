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
        ${ 'okColor' }      | ${ okColor }      | ${ '166;218;149' }
        ${ 'textColor' }    | ${ textColor }    | ${ '202;211;245' }
        ${ 'infoColor' }    | ${ infoColor }    | ${ '145;215;227' }
        ${ 'warnColor' }    | ${ warnColor }    | ${ '238;212;159' }
        ${ 'pathColor' }    | ${ pathColor }    | ${ '245;169;127' }
        ${ 'errorColor' }   | ${ errorColor }   | ${ '237;135;150' }
        ${ 'keywordColor' } | ${ keywordColor } | ${ '198;160;246' }
        ${ 'mutedColor' }   | ${ mutedColor }   | ${ '147;154;183' }
    `('should style text with the $name palette entry', ({ token, rgb }: any) => {
        expect(token('build finished')).toBe(`\x1B[38;2;${ rgb }mbuild finished\x1B[39m`);
    });
});
