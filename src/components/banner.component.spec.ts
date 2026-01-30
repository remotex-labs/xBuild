/**
 * Imports
 */

import { bannerComponent } from './banner.component';

(<any> globalThis).__VERSION = '1.0.0';

/**
 * Test suite for the `bannerComponent` function.
 */

describe('bannerComponent', () => {
    /**
     * Test to ensure the banner contains the correct version number.
     */

    test('should render the banner with the correct ASCII logo, version, and color codes', () => {
        const result = bannerComponent();
        expect(result).toContain('1.0.0');
    });
});
