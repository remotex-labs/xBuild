/**
 * Imports
 */

import { readdirSync } from 'fs';
import { resolve } from '@remotex-labs/xmap';
import { Char } from '@constants/char.constant';
import { findClose, segmentEnd, braceClose } from '@components/glob.component';
import { at, lit, group, isGlobstar, classEnd, createMatcher } from '@components/glob.component';
import { compileClass, collectFiles, globToRegExp, compileFragment } from '@components/glob.component';

/**
 * Tests
 */

describe('lit', () => {
    test.each`
        char                    | expected
        ${ '.' }    | ${ '\\.' }
        ${ '+' }    | ${ '\\+' }
        ${ '^' }    | ${ '\\^' }
        ${ '$' }    | ${ '\\$' }
        ${ '(' }    | ${ '\\(' }
        ${ ')' }    | ${ '\\)' }
        ${ '|' }    | ${ '\\|' }
        ${ '\\' }   | ${ '\\\\' }
        ${ '{' }    | ${ '\\{' }
        ${ '}' }    | ${ '\\}' }
        ${ '[' }    | ${ '\\[' }
        ${ ']' }    | ${ '\\]' }
        ${ '*' }    | ${ '\\*' }
        ${ '?' }    | ${ '\\?' }
    `('should escape regex metacharacter $char', ({ char, expected }) => {
        expect(lit(char)).toBe(expected);
    });

    test('should pass through ordinary characters unescaped', () => {
        expect(lit('a')).toBe('a');
        expect(lit('Z')).toBe('Z');
        expect(lit('9')).toBe('9');
        expect(lit('/')).toBe('/');
    });
});

describe('at', () => {
    test.each`
        glob            | index      | expected
        ${ 'a*b' }  | ${ 0 }    | ${ 97 }
        ${ 'a*b' }  | ${ 1 }    | ${ Char.Star }
        ${ 'a/b' }  | ${ 1 }    | ${ Char.Slash }
    `('should read the code unit of $glob at $index', ({ glob, index, expected }: any) => {
        expect(at(glob, index)).toBe(expected);
    });

    test('should return NaN past the end of the string', () => {
        expect(at('a*b', 9)).toBeNaN();
    });
});

describe('isGlobstar', () => {
    test.each`
        glob                | index      | expected
        ${ '**' }       | ${ 0 }    | ${ true }
        ${ '**/a' }     | ${ 0 }    | ${ true }
        ${ 'a/**' }     | ${ 2 }    | ${ true }
        ${ 'a/**/b' }   | ${ 2 }    | ${ true }
        ${ 'a**' }      | ${ 1 }    | ${ false }
        ${ 'a**b' }     | ${ 1 }    | ${ false }
        ${ '**b' }      | ${ 0 }    | ${ false }
    `('should judge the ** of $glob at $index as $expected', ({ glob, index, expected }: any) => {
        expect(isGlobstar(glob, index)).toBe(expected);
    });
});

describe('group', () => {
    test('should wrap a fragment in a non-capturing group', () => {
        expect(group('a|b')).toBe('(?:a|b)');
    });
});

describe('classEnd', () => {
    test.each`
        glob                    | expected
        ${ '[abc]def' }     | ${ 4 }
        ${ '[]abc]' }       | ${ 5 }
        ${ '[!]a]' }        | ${ 4 }
        ${ '[^]a]' }        | ${ 4 }
        ${ '[a\\]b]' }      | ${ 5 }
        ${ '[abc' }         | ${ 4 }
    `('should end the class of $glob at $expected', ({ glob, expected }: any) => {
        expect(classEnd(glob, 0)).toBe(expected);
    });
});

describe('findClose', () => {
    test.each`
        glob                    | expected
        ${ '@(a|b)c' }      | ${ 5 }
        ${ '@(a|(b))' }     | ${ 7 }
        ${ '@([)])x' }      | ${ 5 }
        ${ '@(a\\)b)' }     | ${ 6 }
        ${ '@(a' }          | ${ -1 }
    `('should close the group of $glob at $expected', ({ glob, expected }: any) => {
        expect(findClose(glob, 1)).toBe(expected);
    });
});

describe('braceClose', () => {
    test.each`
        glob                    | expected
        ${ '{a,b}c' }       | ${ 4 }
        ${ '{a,{b,c}}' }    | ${ 8 }
        ${ '{a,[}]b}' }     | ${ 7 }
        ${ '{a\\},b}' }     | ${ 6 }
        ${ '{abc}' }        | ${ -1 }
        ${ '{a,b' }         | ${ -1 }
    `('should close the brace group of $glob at $expected', ({ glob, expected }: any) => {
        expect(braceClose(glob, 0)).toBe(expected);
    });
});

describe('compileClass', () => {
    test.each`
        glob                | source                | next
        ${ '[a-z]x' }   | ${ '[a-z]' }      | ${ 5 }
        ${ '[!a]' }     | ${ '[^/a]' }      | ${ 4 }
        ${ '[^a]' }     | ${ '[^/a]' }      | ${ 4 }
        ${ '[]^]' }     | ${ '[\\]\\^]' }   | ${ 4 }
        ${ '[\\]]' }    | ${ '[\\]]' }      | ${ 4 }
        ${ '[abc' }     | ${ '\\[' }        | ${ 1 }
    `('should compile the class of $glob to $source', ({ glob, source, next }: any) => {
        expect(compileClass(glob, 0)).toEqual([ source, next ]);
    });
});

describe('segmentEnd', () => {
    test.each`
        glob                        | expected
        ${ 'src/index.ts' }     | ${ 3 }
        ${ 'index.ts' }         | ${ 8 }
        ${ 'a\\/b/c' }          | ${ 4 }
    `('should end the segment of $glob at $expected', ({ glob, expected }: any) => {
        expect(segmentEnd(glob, 0)).toBe(expected);
    });
});

describe('compileFragment', () => {
    test.each`
        glob            | start         | alt               | expected
        ${ '*.ts' } | ${ true }     | ${ 0 }            | ${ '(?!\\.)[^/]*\\.ts' }
        ${ '*.ts' } | ${ false }    | ${ 0 }            | ${ '[^/]*\\.ts' }
        ${ 'a,b' }  | ${ false }    | ${ Char.Comma }   | ${ 'a|b' }
        ${ 'a|b' }  | ${ false }    | ${ Char.Pipe }    | ${ 'a|b' }
        ${ 'a,b' }  | ${ false }    | ${ 0 }            | ${ 'a,b' }
        ${ 'a|b' }  | ${ false }    | ${ 0 }            | ${ 'a\\|b' }
        ${ '**' }   | ${ false }    | ${ 0 }            | ${ '[^/]*[^/]*' }
        ${ '**' }   | ${ true }     | ${ Char.Pipe }    | ${ '(?!\\.)[^/]*(?!\\.)[^/]*' }
    `('should compile $glob to $expected', ({ glob, start, alt, expected }: any) => {
        expect(compileFragment(glob, start, alt)).toBe(expected);
    });

    test('should suppress the leading-dot guard when dot is set', () => {
        expect(compileFragment('*.ts', true, 0, { dot: true })).toBe('[^/]*\\.ts');
    });
});

describe('globToRegExp', () => {
    test.each`
        glob                | path                      | expected
        ${ '*.ts' }     | ${ 'a.ts' }           | ${ true }
        ${ '*.ts' }     | ${ 'src/a.ts' }       | ${ false }
        ${ 'a?b' }      | ${ 'axb' }            | ${ true }
        ${ 'a?b' }      | ${ 'ab' }             | ${ false }
        ${ 'a?b' }      | ${ 'a/b' }            | ${ false }
        ${ '**/*.ts' }  | ${ 'a.ts' }           | ${ true }
        ${ '**/*.ts' }  | ${ 'src/a/b.ts' }     | ${ true }
        ${ '**/*.ts' }  | ${ 'src/a.js' }       | ${ false }
        ${ '**' }       | ${ 'a/b/c.ts' }       | ${ true }
        ${ '**/*.ts' }  | ${ '/x/a.ts' }        | ${ true }
        ${ '**/*.ts' }  | ${ 'C:/x/a.ts' }      | ${ true }
        ${ 'a**b' }     | ${ 'axxb' }           | ${ true }
        ${ 'a**b' }     | ${ 'a/b' }            | ${ false }
    `('should match $path against the wildcards of $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test.each`
        glob                | path                  | expected
        ${ '*.ts' }     | ${ '.a.ts' }      | ${ false }
        ${ 'src/*' }    | ${ 'src/.env' }   | ${ false }
        ${ '?b' }       | ${ '.b' }         | ${ false }
        ${ '[ab]c' }    | ${ '.c' }         | ${ false }
        ${ '**/*.ts' }  | ${ '.git/a.ts' }  | ${ false }
        ${ '.*' }       | ${ '.env' }       | ${ true }
        ${ '{.,}*' }    | ${ '.env' }       | ${ true }
        ${ '{.,}*' }    | ${ 'env' }        | ${ true }
    `('should guard the leading dot of $path against $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test.each`
        glob                | path                  | expected
        ${ 'src/*' }    | ${ 'src/.env' }    | ${ true }
        ${ '**/*' }     | ${ '.git/config' } | ${ true }
    `('should match $path against $glob as $expected when dot is set', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob, { dot: true }).test(path)).toBe(expected);
    });

    test.each`
        glob                | path              | expected
        ${ '[ab].ts' }  | ${ 'a.ts' }       | ${ true }
        ${ '[a-z].ts' } | ${ 'z.ts' }       | ${ true }
        ${ '[ab].ts' }  | ${ 'c.ts' }       | ${ false }
        ${ '[ab].ts' }  | ${ 'ab.ts' }      | ${ false }
        ${ '[!a].ts' }  | ${ 'b.ts' }       | ${ true }
        ${ '[!a].ts' }  | ${ 'a.ts' }       | ${ false }
        ${ '[abc.ts' }  | ${ '[abc.ts' }    | ${ true }
    `('should match $path against the class of $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test.each`
        glob                | path              | expected
        ${ '*.{ts,js}' } | ${ 'x.ts' }      | ${ true }
        ${ '*.{ts,js}' } | ${ 'x.js' }      | ${ true }
        ${ '*.{ts,js}' } | ${ 'x.css' }     | ${ false }
        ${ '{a,{b,c}}' } | ${ 'c' }         | ${ true }
        ${ '{abc}' }     | ${ '{abc}' }     | ${ true }
        ${ '{abc}' }     | ${ 'abc' }       | ${ false }
    `('should match $path against the brace group of $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test.each`
        glob                            | path                  | expected
        ${ '@(a|b)' }               | ${ 'a' }              | ${ true }
        ${ '@(a|b)' }               | ${ 'ab' }             | ${ false }
        ${ '+(ab)' }                | ${ 'abab' }           | ${ true }
        ${ '+(ab)' }                | ${ '' }               | ${ false }
        ${ '*(ab)' }                | ${ '' }               | ${ true }
        ${ '?(a)' }                 | ${ 'a' }              | ${ true }
        ${ '?(a)' }                 | ${ 'aa' }             | ${ false }
        ${ '@(a' }                  | ${ 'a' }              | ${ true }
        ${ '!(a).js' }              | ${ 'ab.js' }          | ${ true }
        ${ '!(a).js' }              | ${ 'a.js' }           | ${ false }
        ${ '!(*.spec).ts' }         | ${ 'app.ts' }         | ${ true }
        ${ '!(*.spec).ts' }         | ${ 'app.spec.ts' }    | ${ false }
        ${ '!(*.spec|*.test).ts' }  | ${ 'app.test.ts' }    | ${ false }
        ${ '!(a)/b' }               | ${ 'x/b' }            | ${ true }
        ${ '!(a)/b' }               | ${ 'a/b' }            | ${ false }
    `('should match $path against the extglob of $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test.each`
        glob                | path              | expected
        ${ '!a.ts' }    | ${ '!a.ts' }      | ${ true }
        ${ '\\*.js' }   | ${ '*.js' }       | ${ true }
        ${ '\\*.js' }   | ${ 'a.js' }       | ${ false }
        ${ 'a\\' }      | ${ 'a\\' }        | ${ true }
        ${ '!(a' }      | ${ '!(a' }        | ${ true }
    `('should match $path against the literals of $glob as $expected', ({ glob, path, expected }: any) => {
        expect(globToRegExp(glob).test(path)).toBe(expected);
    });

    test('should pass the flags through to the expression', () => {
        expect(globToRegExp('src/*.ts', { flags: 'i' }).test('SRC/APP.TS')).toBe(true);
        expect(globToRegExp('src/*.ts').test('SRC/APP.TS')).toBe(false);
    });
});

describe('createMatcher', () => {
    test.each`
        globs                                   | path                      | expected
        ${ [ '**/*.ts', '!**/*.spec.ts' ] } | ${ 'src/app.ts' }      | ${ true }
        ${ [ '**/*.ts', '!**/*.spec.ts' ] } | ${ 'src/app.spec.ts' } | ${ false }
        ${ [ '**/*.ts', '!**/*.spec.ts' ] } | ${ 'src/app.js' }      | ${ false }
        ${ [ '!**/*.spec.ts' ] }            | ${ 'src/app.js' }      | ${ true }
        ${ [ '!**/*.spec.ts' ] }            | ${ 'app.spec.ts' }     | ${ false }
        ${ [ '!!*.ts' ] }                   | ${ 'a.ts' }            | ${ true }
        ${ [ '!(a).ts' ] }                  | ${ 'b.ts' }            | ${ true }
        ${ [ '!(a).ts' ] }                  | ${ 'a.ts' }            | ${ false }
    `('should judge $path against $globs as $expected', ({ globs, path, expected }: any) => {
        expect(createMatcher(globs)(path)).toBe(expected);
    });

    test('should compile every pattern with the given options', () => {
        expect(createMatcher([ 'src/*.ts' ], { flags: 'i' })('SRC/APP.TS')).toBe(true);
    });
});

describe('collectFiles', () => {
    const tree: Record<string, Array<unknown>> = {
        '/root': [
            { name: 'src', isDirectory: (): boolean => true },
            { name: '.git', isDirectory: (): boolean => true },
            { name: 'broken', isDirectory: (): boolean => true },
            { name: 'readme.md', isDirectory: (): boolean => false }
        ],
        '/root/src': [
            { name: 'index.ts', isDirectory: (): boolean => false },
            { name: 'index.spec.ts', isDirectory: (): boolean => false }
        ],
        '/root/.git': [{ name: 'config', isDirectory: (): boolean => false }]
    };

    beforeEach(() => {
        xJet.restoreAllMocks();
        xJet.mock(resolve).mockImplementation(((path: string) => path) as any);
        xJet.mock(readdirSync).mockImplementation(((path: string) => {
            const entries = tree[path];
            if (!entries) throw new Error(`ENOENT: ${ path }`);

            return entries;
        }) as any);
    });

    test('should collect the matched files as paths relative to the base', () => {
        expect(collectFiles('/root', [ '**/*.ts', '!**/*.spec.ts' ])).toEqual([ 'src/index.ts' ]);
    });

    test('should skip a directory it cannot read and keep walking', () => {
        expect(collectFiles('/root', [ '**/*' ])).toEqual([ 'readme.md', 'src/index.ts', 'src/index.spec.ts' ]);
    });

    test('should prune a dot directory unless a pattern spells the dot', () => {
        expect(collectFiles('/root', [ '**/config' ])).toEqual([]);
        expect(collectFiles('/root', [ '.git/*' ])).toEqual([ '.git/config' ]);
    });

    test('should walk a dot directory a pattern names further down', () => {
        expect(collectFiles('/root', [ '**/.git/*' ])).toEqual([ '.git/config' ]);
    });

    test('should descend into a dot directory when dot is set', () => {
        expect(collectFiles('/root', [ '**/config' ], { dot: true })).toEqual([ '.git/config' ]);
    });
});
