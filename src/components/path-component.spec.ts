/**
 * Tests
 */

import path from 'path';
import * as posix from 'path/posix';
import * as win32 from 'path/win32';
import { join, normalize, resolve, toPosix, dirname, relative, basename } from './path.component';

beforeEach(() => {
    xJet.restoreAllMocks();
});

describe('path utilities (POSIX normalized)', () => {
    describe('toPosix', () => {
        test('converts backslashes to forward slashes', () => {
            expect(toPosix('C:\\Users\\john\\docs\\file.txt')).toBe('C:/Users/john/docs/file.txt');
            expect(toPosix('src\\components\\Button.tsx')).toBe('src/components/Button.tsx');
        });

        test('collapses multiple consecutive slashes', () => {
            expect(toPosix('src//components///Button//')).toBe('src/components/Button/');
            expect(toPosix('////absolute////path//')).toBe('/absolute/path/');
        });

        test('handles mixed slashes', () => {
            expect(toPosix('C:/Windows\\System32\\\\drivers')).toBe('C:/Windows/System32/drivers');
        });

        test('returns empty string for falsy values', () => {
            expect(toPosix('')).toBe('');
            expect(toPosix(null as any)).toBe('');
            expect(toPosix(undefined as any)).toBe('');
        });

        test('preserves leading drive letter', () => {
            expect(toPosix('C:\\')).toBe('C:/');
            expect(toPosix('c:\\project')).toBe('c:/project');
        });
    });

    describe('normalize', () => {
        test('resolves dot and dot-dot segments', () => {
            expect(normalize('src/components/../utils/./helper.ts')).toBe('src/utils/helper.ts');
            expect(normalize('./src/../dist')).toBe('dist');
            expect(normalize('../outside')).toBe('../outside');
        });

        test('handles windows paths + relative segments', () => {
            expect(normalize('C:\\Users\\john\\..\\mary\\docs\\..\\file.txt')).toBe('C:/Users/mary/file.txt');
        });

        test('removes trailing slash (except root)', () => {
            expect(normalize('/var/www/')).toBe('/var/www/');
            expect(normalize('/')).toBe('/');
            expect(normalize('C:/')).toBe('C:/');
        });

        test('normalizes messy input', () => {
            expect(normalize('src\\\\\\components//..//Button//')).toBe('src/Button/');
        });
    });

    describe('join', () => {
        test('joins simple segments', () => {
            expect(join('src', 'components', 'Button.tsx')).toBe('src/components/Button.tsx');
        });

        test('handles windows-style input segments', () => {
            expect(join('C:\\', 'Users', 'docs\\file.txt')).toBe('C:/Users/docs/file.txt');
        });

        test('ignores empty segments', () => {
            expect(join('src', '', 'utils', '', 'helper')).toBe('src/utils/helper');
            expect(join('', 'root')).toBe('root');
        });

        test('preserves leading / when first non-empty segment is absolute', () => {
            expect(join('/var', 'www', 'html')).toBe('/var/www/html');
        });

        test('normalizes result', () => {
            expect(join('src', '../dist', './build')).toBe('dist/build');
        });
    });

    describe('resolve', () => {
        test('resolves relative paths against cwd', () => {
            expect(resolve('src', 'components')).toBe(expect.stringContaining('src/components'));
        });

        test('stops at first absolute path (unix style)', () => {
            expect(resolve('src', '/etc', 'nginx')).toBe(expect.stringContaining('/etc/nginx'));
        });

        test('stops at first absolute path (windows style)', () => {
            xJet.spyOn(path, 'resolve').mockImplementationOnce(win32.resolve);
            expect(resolve('src', 'C:\\Windows', 'System32')).toBe('C:/Windows/System32');
        });

        test('normalizes windows input to posix output', () => {
            xJet.spyOn(path, 'resolve').mockImplementationOnce(win32.resolve);
            expect(resolve('C:\\Users\\..\\Public', 'docs')).toBe('C:/Public/docs');
        });

        test('handles only relative segments', () => {
            expect(resolve('../sibling', './child')).toBe(expect.stringContaining('sibling/child'));
        });
    });

    describe('dirname', () => {
        test('returns parent directory', () => {
            xJet.spyOn(path, 'dirname').mockImplementationOnce(posix.dirname);
            expect(dirname('/home/user/docs/file.txt')).toBe('/home/user/docs');

            xJet.spyOn(path, 'dirname').mockImplementationOnce(win32.dirname);
            expect(dirname('C:\\Users\\Public\\image.png')).toBe('C:/Users/Public');
        });

        test('returns . for files in cwd', () => {
            expect(dirname('readme.md')).toBe('.');
        });

        test('returns root for top-level files', () => {
            xJet.spyOn(path, 'dirname').mockImplementationOnce(posix.dirname);
            expect(dirname('/index.html')).toBe('/');

            xJet.spyOn(path, 'dirname').mockImplementationOnce(win32.dirname);
            expect(dirname('C:\\boot.ini')).toBe('C:/');
        });

        test('handles trailing slash', () => {
            expect(dirname('/var/www/')).toBe('/var');
            expect(dirname('src/components/')).toBe('src');
        });
    });

    describe('relative', () => {
        test('computes correct relative path', () => {
            xJet.spyOn(path, 'basename').mockImplementationOnce(posix.basename);
            expect(relative('/home/user/project', '/home/user/project/src/utils/helper.ts'))
                .toBe('src/utils/helper.ts');

            xJet.spyOn(path, 'basename').mockImplementationOnce(win32.basename);
            expect(relative('/home/user/project/src', '/home/user/docs/report.pdf'))
                .toBe('../../docs/report.pdf');
        });

        test('returns . when paths are equal', () => {
            expect(relative('/a/b/c', '/a/b/c')).toBe('.');
            expect(relative('', '')).toBe('.');
        });

        test('handles windows paths', () => {
            expect(relative('C:\\project\\src', 'C:\\project\\dist\\bundle.js'))
                .toBe('../dist/bundle.js');
        });

        test('normalizes input before comparison', () => {
            expect(relative('src\\\\components', 'src/components//Button.tsx'))
                .toBe('Button.tsx');
        });
    });

    describe('basename', () => {
        test('returns last component', () => {
            xJet.spyOn(path, 'basename').mockImplementationOnce(posix.basename);
            expect(basename('/home/user/report.pdf')).toBe('report.pdf');

            xJet.spyOn(path, 'basename').mockImplementationOnce(win32.basename);
            expect(basename('C:\\Windows\\system.ini')).toBe('system.ini');
        });

        test('removes suffix when provided and matches', () => {
            expect(basename('/src/Button.tsx', '.tsx')).toBe('Button');
            expect(basename('archive.tar.gz', '.tar.gz')).toBe('archive');
        });

        test('keeps name when suffix does not match', () => {
            expect(basename('photo.jpg', '.png')).toBe('photo.jpg');
        });

        test('handles trailing slash', () => {
            expect(basename('/var/www/')).toBe('www');
            expect(basename('src/components/')).toBe('components');
        });

        test('handles root', () => {
            xJet.spyOn(path, 'basename').mockImplementationOnce(posix.basename);
            expect(basename('/')).toBe('');

            xJet.spyOn(path, 'basename').mockImplementationOnce(win32.basename);
            expect(basename('C:/')).toBe('');
        });
    });
});
