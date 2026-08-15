/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Dirent } from 'fs';
import type { GlobOptionsInterface } from './interfaces/glob-component.interface';

/**
 * Imports
 */

import { readdirSync } from 'fs';
import { join } from '@remotex-labs/xmap';
import { Char } from '@constants/char.constant';
import { FrameworkService } from '@services/framework.service';
import { RegexElement, RegexCloser } from '@constants/glob.constant';

/**
 * Escapes a single character for literal use inside a regular expression.
 *
 * @param char - The character to escape
 * @returns The character prefixed with a backslash when it carries special meaning in a regular expression,
 * or the character unchanged otherwise
 *
 * @remarks
 * A backslash is prepended when `char` is one of the regex metacharacters `.+^$()|\{}[]*?`.
 * Any other character is returned as-is.
 * Intended for building patterns from user-supplied glob fragments where each source character must match itself.
 *
 * @example
 * ```ts
 * lit('.'); // '\\.'
 * lit('a'); // 'a'
 * ```
 *
 * @since 3.0.0
 */

export function lit(char: string): string {
    return '.+^$()|\\{}[]*?'.includes(char) ? '\\' + char : char;
}

/**
 * Returns the UTF-16 code unit of a glob string at a given index.
 *
 * @param glob - The glob string to read from
 * @param index - The zero-based position of the character to read
 * @returns The code unit at `index`, or `NaN` when `index` is out of range
 *
 * @remarks
 * A thin wrapper over {@link String.charCodeAt} used while scanning a glob pattern character by character.
 * Comparing code units avoids allocating single-character substrings on the hot path.
 *
 * @example
 * ```ts
 * at('a*b', 1); // 42 - Char.Star
 * at('a*b', 9); // NaN - past the end
 * ```
 *
 * @see Char
 * @since 3.0.0
 */

export function at(glob: string, index: number): number {
    return glob.charCodeAt(index);
}

/**
 * Determines whether the `**` at a given index forms a globstar segment.
 *
 * @param glob - The glob string being scanned
 * @param index - The zero-based position of the first `*` of the candidate `**`
 * @returns `true` when the `**` occupies a whole path segment, `false` otherwise
 *
 * @remarks
 * A globstar is a `**` that spans an entire path segment,
 * so it must be bounded on both sides by a slash or by the start or end of the string.
 * The character before `index` must be the start of the string or a slash,
 * and the character after the `**` must be the end of the string or a slash.
 * A `**` embedded within a segment, such as in `a**b`, matches as two consecutive single stars rather than a globstar.
 * The caller is responsible for confirming that both characters at `index` and `index + 1` are `*`.
 *
 * @example
 * ```ts
 * isGlobstar('**', 0);    // true - the whole string
 * isGlobstar('a/**', 2);  // true - preceded by a slash, ends the string
 * isGlobstar('a**b', 1);  // false - embedded in a segment
 * ```
 *
 * @see Char
 * @since 3.0.0
 */

export function isGlobstar(glob: string, index: number): boolean {
    return (index === 0 || at(glob, index - 1) === Char.Slash)
        && (index + 2 === glob.length || at(glob, index + 2) === Char.Slash);
}

/**
 * Wraps a regex fragment in a non-capturing group.
 *
 * @param body - The regex source to enclose
 * @returns The body wrapped as `(?:body)`
 *
 * @remarks
 * Groups a fragment so a following quantifier or alternation applies to the whole fragment rather than its last token.
 *
 * @example
 * ```ts
 * group('a|b');        // '(?:a|b)'
 * group('a|b') + '?';  // '(?:a|b)?' - the quantifier covers both alternatives
 * ```
 *
 * @since 3.0.0
 */

export function group(body: string): string {
    return `(?:${ body })`;
}

/**
 * Finds the index of the `]` that closes a character class.
 *
 * @param glob - The glob string being scanned
 * @param openIndex - The index of the opening `[`
 * @returns The index of the closing `]`, or the length of the string when the class is unterminated
 *
 * @remarks
 * Applies POSIX-style character-class rules while scanning.
 * A leading `!` or `^` negates the class and is skipped, and a `]` immediately after the opening bracket
 * (or after the negation) is treated as a literal member rather than a close.
 * A backslash escapes the next character, so an escaped `]` does not close the class.
 *
 * @example
 * ```ts
 * classEnd('[abc]def', 0); // 4
 * classEnd('[]abc]', 0);   // 5 - the leading ] is a member
 * classEnd('[abc', 0);     // 4 - unterminated, so the length
 * ```
 *
 * @see compileClass
 * @since 3.0.0
 */

export function classEnd(glob: string, openIndex: number): number {
    let scan = openIndex + 1;
    const lead = at(glob, scan);

    if (lead === Char.Bang || lead === Char.Caret) scan++;
    if (at(glob, scan) === Char.RBracket) scan++;               // leading ] is literal

    while (scan < glob.length && at(glob, scan) !== Char.RBracket)
        scan += at(glob, scan) === Char.Backslash ? 2 : 1;

    return scan;
}

/**
 * Finds the index of the `)` that closes an extglob group.
 *
 * @param glob - The glob string being scanned
 * @param openIndex - The index of the opening `(`
 * @returns The index of the matching `)`, or `-1` when the group is unterminated
 *
 * @remarks
 * Tracks nesting depth so an inner `( ... )` does not end the outer group.
 * A backslash escapes the next character, and a `[ ... ]` character class is skipped via {@link classEnd},
 * so parentheses inside it are not counted.
 *
 * @example
 * ```ts
 * findClose('@(a|b)c', 1);   // 5
 * findClose('@(a|(b))', 1);  // 7 - the inner group does not end it
 * findClose('@(a', 1);       // -1 - unterminated
 * ```
 *
 * @see classEnd
 * @since 3.0.0
 */

export function findClose(glob: string, openIndex: number): number {
    for (let cursor = openIndex, depth = 0; cursor < glob.length; cursor++) {
        const char = at(glob, cursor);

        if (char === Char.Backslash) cursor++;
        else if (char === Char.LParen) depth++;
        else if (char === Char.RParen && --depth === 0) return cursor;
        else if (char === Char.LBracket) cursor = classEnd(glob, cursor);
    }

    return -1;
}

/**
 * Finds the index of the `}` that closes an expandable brace group.
 *
 * @param glob - The glob string being scanned
 * @param openIndex - The index of the opening `{`
 * @returns The index of the matching `}` when the group contains a top-level comma, `-1` otherwise
 *
 * @remarks
 * A brace group is expandable only when it holds at least one top-level comma, so `{a,b}` closes but `{a}` does not.
 * Tracks nesting depth so an inner `{ ... }` does not end the outer group,
 * skips a `[ ... ]` character class via {@link classEnd}, and treats a backslash as escaping the next character.
 * Returning `-1` signals the caller to emit the `{` as a literal.
 *
 * @example
 * ```ts
 * braceClose('{a,b}c', 0);    // 4
 * braceClose('{a,{b,c}}', 0); // 8 - the inner group does not end it
 * braceClose('{abc}', 0);     // -1 - no top-level comma, so a literal
 * ```
 *
 * @see classEnd
 * @since 3.0.0
 */

export function braceClose(glob: string, openIndex: number): number {
    let comma = false;

    for (let cursor = openIndex + 1, depth = 0; cursor < glob.length; cursor++) {
        const char = at(glob, cursor);

        if (char === Char.Backslash) cursor++;
        else if (char === Char.LBrace) depth++;
        else if (char === Char.RBrace) {
            if (depth === 0) return comma ? cursor : -1;        // expandable only with a comma
            depth--;
        }
        else if (char === Char.Comma && depth === 0) comma = true;
        else if (char === Char.LBracket) cursor = classEnd(glob, cursor);
    }

    return -1;
}

/**
 * Compiles a glob character class into its regex equivalent.
 *
 * @param glob - The glob string being scanned
 * @param openIndex - The index of the opening `[`
 * @returns A tuple of the compiled regex source and the index just past the class
 *
 * @remarks
 * Translates glob character-class syntax into a regex class.
 * A leading `!` or `^` becomes a negation that also excludes the path separator, emitted as `[^/`.
 * A `]` immediately after the opening (or after the negation) is escaped as a literal member,
 * and a `^` inside the class is escaped so it is not read as a negation.
 * An unterminated class is not a class at all - the function returns the literal `\[` and advances past the `[`.
 *
 * @example
 * ```ts
 * compileClass('[a-z]x', 0); // [ '[a-z]', 5 ]
 * compileClass('[!a]', 0);   // [ '[^/a]', 4 ] - negated, and the separator excluded with it
 * compileClass('[abc', 0);   // [ '\\[', 1 ] - unterminated, so a literal bracket
 * ```
 *
 * @see classEnd
 * @since 3.0.0
 */

export function compileClass(glob: string, openIndex: number): [string, number] {
    const end = classEnd(glob, openIndex);
    if (end >= glob.length) return [ '\\[', openIndex + 1 ];    // unterminated → literal

    let cursor = openIndex + 1, out = '[';
    const lead = at(glob, cursor);

    if (lead === Char.Bang || lead === Char.Caret) { out += '^/'; cursor++; }
    if (at(glob, cursor) === Char.RBracket) { out += '\\]'; cursor++; }

    for (; cursor < end; cursor++) {
        if (at(glob, cursor) === Char.Backslash) out += '\\' + glob[++cursor];
        else if (at(glob, cursor) === Char.Caret) out += '\\^';
        else out += glob[cursor];
    }

    return [ out + ']', end + 1 ];
}

/**
 * Finds the index of the next path separator at or after a position.
 *
 * @param glob - The glob string being scanned
 * @param from - The zero-based position to start scanning from
 * @returns The index of the next unescaped `/`, or the length of the string when none remains
 *
 * @remarks
 * Marks the end of the current path segment.
 * A backslash escapes the next character, so an escaped `/` does not end the segment.
 *
 * @example
 * ```ts
 * segmentEnd('src/index.ts', 0); // 3
 * segmentEnd('index.ts', 0);     // 8 - no separator left, so the length
 * ```
 *
 * @since 3.0.0
 */

export function segmentEnd(glob: string, from: number): number {
    for (let cursor = from; cursor < glob.length; cursor++) {
        if (at(glob, cursor) === Char.Slash) return cursor;
        if (at(glob, cursor) === Char.Backslash) cursor++;
    }

    return glob.length;
}

/**
 * Compiles a glob fragment into a regular-expression source.
 *
 * @param glob - The glob fragment to compile
 * @param isSegmentStart - Whether the fragment begins at the start of a path segment
 * @param alt - The code unit that separates alternatives, or `0` when the fragment is not an alternation body
 * @param options - Compilation options, of which only {@link GlobOptionsInterface.dot} is read, defaulting to `false`
 * @returns The regex source for the fragment, without the anchoring `^` and `$`
 *
 * @remarks
 * The core of the compiler, invoked recursively for the bodies of extglob, brace, and negation groups.
 * It walks the fragment one character at a time and emits the matching regex, handling wildcards (`*`, `**`, `?`),
 * character classes, brace expansion, extglob prefixes (`?( )`, `*( )`, `+( )`, `@( )`, `!( )`), and escapes.
 *
 * Segment-start tracking drives the leading-dot guard: at the start of a segment a wildcard must not match a dotfile,
 * so a {@link RegexElement.NotDot} guard is emitted.
 * `isSegmentStart` seeds this state for the fragment, and it is re-armed after every `/` and at each alternative.
 * When `options.dot` is `true`, the guard is suppressed everywhere, so wildcards match dotfiles as ordinary names,
 * and `**` descends into dot directories.
 *
 * The `alt` parameter marks the fragment as the body of an alternation.
 * When set to {@link Char.Pipe} or {@link Char.Comma}, an unescaped separator of that kind becomes a regex `|`,
 * and `**` is treated as two single stars rather than a globstar.
 * Any other occurrence of `|` or `,` is emitted literally.
 *
 * @example
 * ```ts
 * compileFragment('*.ts', true);                   // (?!\.)[^/]*\.ts
 * compileFragment('a,b', false, Char.Comma);       // a|b
 * compileFragment('*.ts', true, 0, { dot: true }); // [^/]*\.ts
 * ```
 *
 * @see globToRegExp
 * @see GlobOptionsInterface
 *
 * @since 3.0.0
 */

export function compileFragment(glob: string, isSegmentStart: boolean = false, alt: number = 0, options: GlobOptionsInterface = {}): string {
    const { dot = false } = options;

    let out = '';
    let index = 0;
    let wasStart = isSegmentStart;

    const guard = dot ? '' : RegexElement.NotDot;
    const DS = guard + RegexElement.NotSlash + '+';
    const GLOBSTAR = group(DS + '(?:/' + DS + ')*') + '?';

    while (index < glob.length) {
        const char = at(glob, index);
        const nChar = at(glob, index + 1);

        if (nChar === Char.LParen && (char === Char.Bang || RegexCloser[char])) {
            const close = findClose(glob, index + 1);

            if (char !== Char.Bang) {                           // ?*+@( ... )
                const end = close === -1 ? glob.length : close; // unclosed → group runs to the end
                const inner = compileFragment(glob.slice(index + 2, end), wasStart, Char.Pipe, options);

                out += RegexElement.Open + inner + RegexCloser[char];
                index = end + 1;
                continue;
            }

            if (close !== -1) {
                const inner = compileFragment(glob.slice(index + 2, close), wasStart, Char.Pipe, options);
                const tailEnd = segmentEnd(glob, close + 1);
                const tail = compileFragment(glob.slice(close + 1, tailEnd), false, 0, options);

                out += group(
                    (wasStart ? guard : '') +
                    `(?!${ group(inner) + tail + RegexElement.SegBreak })` +
                    RegexElement.NotSlashLazy + tail
                );

                index = tailEnd;
                continue;
            }
        }

        switch (char) {
            case Char.Slash:
                out += RegexElement.Slash;
                index++;
                wasStart = true;
                break;

            case Char.Backslash:
                out += index + 1 < glob.length ? lit(glob[index + 1]) : '\\\\';
                index += 2;
                break;

            case Char.Question:
                out += wasStart && !dot ? RegexElement.NotDotSlash : RegexElement.NotSlash;
                index++;
                break;

            case Char.Star:
                if (nChar === Char.Star && alt !== Char.Pipe && (index > 0 || isSegmentStart) && isGlobstar(glob, index)) {
                    const root = index === 0 && alt === 0 ? RegexElement.AbsRoot : '';
                    if (at(glob, index + 2) === Char.Slash) {
                        out += root + group(DS + RegexElement.Slash) + '*'; index += 3; wasStart = true;
                    } else {
                        out += root + GLOBSTAR; index += 2;
                    }
                } else {
                    out += (wasStart ? guard : '') + RegexElement.NotSlashRun;
                    index++;
                }
                break;

            case Char.LBrace: {
                const close = braceClose(glob, index);

                if (close === -1) {
                    out += '\\{'; index++;
                } else {
                    out += group(compileFragment(glob.slice(index + 1, close), wasStart, Char.Comma, options));
                    index = close + 1;
                }
                break;
            }

            case Char.LBracket: {
                const [ src, next ] = compileClass(glob, index);
                out += (wasStart && !dot && src !== '\\[' ? RegexElement.NotDot : '') + src;
                index = next;
                break;
            }

            case Char.Pipe:
            case Char.Comma:
                if (alt === char) { out += RegexElement.Alt; wasStart = isSegmentStart; }
                else out += lit(glob[index]);
                index++;
                break;

            default:
                out += lit(glob[index]); index++;
        }
    }

    return out;
}

/**
 * Compiles a glob pattern into an anchored regular expression.
 *
 * @param glob - The glob pattern to compile
 * @param options - Compilation options carrying the regex flags and the dotfile setting
 * @returns A {@link RegExp} anchored with `^` and `$` that matches exactly the paths described by the glob
 *
 * @remarks
 * The entry point of the compiler.
 * It compiles the pattern with {@link compileFragment} starting at a segment boundary, then wraps the result
 * in `^ ... $` so the expression matches a whole path rather than a substring.
 *
 * Supported glob syntax:
 * - `*` - matches any run of characters within a single path segment, never crossing a `/`.
 * - `?` - matches exactly one character within a segment.
 * - `**` - globstar, matching across segment boundaries, spanning any number of intermediate segments.
 * - `[abc]`, `[a-z]`, `[a-zA-Z0-9]` - a character class matching exactly one listed character or range.
 *   Multiple ranges combine, and it never matches more than one character.
 * - `[!abc]`, `[^abc]` - a negated character class matching exactly one character not listed.
 * - `{a,b}`, `{a,{b,c}}` - brace alternation, matching any one of the comma-separated alternatives.
 *   A brace group with no top-level comma, such as `{abc}`, is treated as the literal text `{abc}`.
 * - `@( ... )` - extglob group matching its `|`-separated alternatives exactly once.
 * - `?( ... )` - extglob group matching zero or one of its alternatives.
 * - `*( ... )` - extglob group matching zero or more of its alternatives.
 * - `+( ... )` - extglob group matching one or more of its alternatives.
 * - `!( ... )` - extglob negation matching anything the alternatives do not.
 * - `\` - escapes the next character so it is matched literally, so `\*.js` matches the literal name `*.js`.
 * - `/` - the literal path separator, which segment-relative wildcards never cross.
 *
 * Character classes and `?` always consume exactly one character.
 * To constrain a run of characters, follow the class with `*` (`[ab]*c` allows any run before `c`)
 * or repeat it with an extglob (`+([ab])c` requires every character before `c` to be `a` or `b`).
 *
 * The `!( ... )` negation is single-segment: its body never crosses a `/`, and the guarantee holds when
 * the negation is the last thing in its segment or is followed by a literal tail such as `.ts`.
 * It is not whole-pattern negation - a leading `!` not followed by `(` is matched as a literal `!`.
 *
 * Leading dots are guarded: at the start of a segment,
 * `*`, `?`, `[ ... ]`, and `**` do not match a name that begins with `.` unless the pattern spells the dot out.
 * So `*` matches `env` but not `.env`.
 * To include dotfiles, name the dot explicitly:
 * - `.*` - matches only dotfiles, such as `.env`.
 * - `{.,}*` - matches every name, dotfiles included.
 *
 * Passing {@link GlobOptionsInterface.dot} as `true` lifts the guard for the whole pattern,
 * so plain wildcards match dotfiles, and `**` descends into dot directories - `**\/*` then matches `.git/config`.
 *
 * @example
 * <caption>Common patterns and what they match</caption>
 * ```text
 * *.{ts,js}            x.ts, x.js
 * @(a|b)               a, b
 * +(ab)                ab, abab            (not: '')
 * !(a).js              ab.js, x.js         (not: a.js)
 * !(*.spec).ts         app.ts, index.ts    (not: app.spec.ts)
 * !(*.spec|*.test).ts  app.ts              (not: app.spec.ts, app.test.ts)
 * ```
 *
 * @example
 * <caption>Every file except a spec, recursively - the two most useful forms</caption>
 * ```ts
 * globToRegExp('**\/!(*.spec).{ts,js}'); // any .ts or .js file whose name does not end in .spec
 * globToRegExp('**\/!(*.spec.ts)');      // any file at all except those ending in .spec.ts
 * ```
 *
 * @see compileFragment
 * @see GlobOptionsInterface
 *
 * @since 3.0.0
 */

export function globToRegExp(glob: string, options: GlobOptionsInterface = {}): RegExp {
    return new RegExp('^' + compileFragment(glob, true, 0, options) + '$', options.flags);
}

/**
 * Builds a predicate that tests a path against a set of include and exclude globs.
 *
 * @param globs - The glob patterns to match against, where a leading `!` marks an exclusion
 * @param options - Compilation options applied to every compiled pattern
 * @returns A predicate returning `true` when `path` is included by the set and excluded by none of it
 *
 * @remarks
 * Each glob is compiled once with {@link globToRegExp} and sorted into an include or exclude list.
 * A leading `!` marks the pattern as an exclusion and is stripped before compilation.
 * A repeated `!` toggles, so `!!pattern` is an inclusion again.
 * A `!` immediately followed by `(` is left in place - it is the extglob negation {@link globToRegExp} handles,
 * not a whole-pattern exclusion.
 *
 * The predicate accepts a path when it is matched by at least one include pattern and by no exclude pattern.
 * When the set contains no include patterns, every path is considered included,
 * so a set of only exclusions matches everything except what it excludes.
 *
 * @example
 * ```ts
 * const isSource = createMatcher([ '**\/*.ts', '!**\/*.spec.ts' ]);
 * isSource('src/app.ts');       // true
 * isSource('src/app.spec.ts');  // false - excluded
 * isSource('src/app.js');       // false - not included
 * ```
 *
 * @see globToRegExp
 * @see GlobOptionsInterface
 *
 * @since 3.0.0
 */

export function createMatcher(globs: Array<string>, options: GlobOptionsInterface = {}): (path: string) => boolean {
    const include: Array<RegExp> = [];
    const exclude: Array<RegExp> = [];

    for (let glob of globs) {
        let neg = false;
        while (at(glob, 0) === Char.Bang && at(glob, 1) !== Char.LParen) {
            neg = !neg;
            glob = glob.slice(1);
        }

        (neg ? exclude : include).push(globToRegExp(glob, options));
    }

    return (path) =>
        (include.length === 0 || include.some(r => r.test(path))) &&
        !exclude.some(r => r.test(path));
}

/**
 * Walks a directory tree and collects every file the globs match.
 *
 * @param base - The directory the walk starts from and the patterns are matched against
 * @param globs - The glob patterns to match, where a leading `!` marks an exclusion
 * @param options - Compilation options applied to every compiled pattern
 * @returns The matched files as paths relative to `base`, with forward slashes, in the order the walk reaches them
 *
 * @remarks
 * The base is resolved through the shared path cache,
 * and every path below it is built by appending a name to its directory's path.
 * A file therefore costs one string and one {@link createMatcher} test rather than a resolve of its own.
 * The walk is iterative, so a deep tree cannot overflow the stack,
 * and a directory that cannot be read is skipped rather than thrown from.
 * Unless `dot` is set, a name beginning with `.` is skipped before it is tested, which prunes whole trees such as `.git`.
 * A pattern that spells a leading dot, as `.github/**` or `**\/.cache/*` does, disarms this and lets the walk descend.
 * Symbolic links are not followed, since a link never reports itself as a directory, which is what keeps a link cycle
 * from being walked.
 *
 * @example
 * ```ts
 * collectFiles(cwd(), [ 'src/**\/*.ts', '!**\/*.spec.ts' ]);
 * // [ 'src/index.ts', 'src/models/files.model.ts' ]
 * ```
 *
 * @see createMatcher
 * @see GlobOptionsInterface
 *
 * @since 3.0.0
 */

export function collectFiles(base: string, globs: Array<string>, options: GlobOptionsInterface = {}): Array<string> {
    const root = FrameworkService.resolve(base);
    const matcher = createMatcher(globs, options);
    const dotted = options.dot || globs.some(glob => at(glob, 0) === Char.Dot || glob.includes('/.'));

    const files: Array<string> = [];
    const stack: Array<string> = [ '' ];

    while (stack.length > 0) {
        const directory = stack.pop()!;

        let entries: Array<Dirent>;
        try {
            entries = readdirSync(directory ? join(root, directory) : root, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!dotted && at(entry.name, 0) === Char.Dot) continue;
            const path = directory ? `${ directory }/${ entry.name }` : entry.name;

            if (entry.isDirectory()) stack.push(path);
            else if (matcher(path)) files.push(path);
        }
    }

    return files;
}
