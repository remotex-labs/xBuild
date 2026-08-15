/**
 * Imports
 */

import { asciiLogo, bannerUi, prefix } from './banner.ui';

/**
 * Mock global variables
 */

(<any> globalThis).__VERSION = '1.0.0';

/**
 * Tests
 */

describe('asciiLogo', () => {
    test('should stand on its own lines', () => {
        expect(asciiLogo.startsWith('\n')).toBe(true);
        expect(asciiLogo.endsWith('\n')).toBe(true);
    });

    test('should hold one backslash everywhere the source shows two', () => {
        expect(asciiLogo).toContain('__  _| |_/ /_   _ _| | __| |');
        expect(asciiLogo).toContain('/_/\\_\\____/ \\__,_|_|_|\\__,_|');
    });
});

describe('bannerComponent', () => {
    test('should draw the logo in burnt orange and the version in bright pink', () => {
        const banner = bannerUi();

        expect(banner).toContain(`\x1B[38;5;208m${ asciiLogo }\x1B[39m`);
        expect(banner).toContain('Version: \x1B[38;5;197m1.0.0\x1B[39m');
    });

    test('should discard its own indentation with a carriage return', () => {
        const banner = bannerUi();

        expect(banner).toContain('\r\x1B[38;5;208m');
        expect(banner).toContain('\rVersion: ');
        expect(banner.endsWith('\r')).toBe(true);
    });
});

describe('prefix', () => {
    test('should tag a line as coming from the build in light coral', () => {
        expect(prefix()).toBe('\x1B[38;5;203m[xBuild]\x1B[39m');
    });
});
