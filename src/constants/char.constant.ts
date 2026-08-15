/**
 * UTF-16 code units for the characters that carry meaning in a glob pattern.
 *
 * @remarks
 * Each member is the numeric code unit of its character, so scanning code can compare against
 * {@link String.charCodeAt} results without allocating single-character substrings.
 * Declared as a `const enum` so references inline to their literal value at compile time.
 *
 * @example
 * ```ts
 * 'a/b'.charCodeAt(1) === Char.Slash; // true
 * ```
 *
 * @since 3.0.0
 */

export const enum Char {
    At = 64,        // @
    Cr = 13,        // carriage return
    Lf = 10,        // line feed
    Tab = 9,        // tab
    Dot = 46,       // .
    Bang = 33,      // !
    Star = 42,      // *
    Plus = 43,      // +
    Pipe = 124,     // |
    Comma = 44,     // ,
    Colon = 58,     // :
    Caret = 94,     // ^
    Slash = 47,     // /
    Space = 32,     // space
    Dollar = 36,    // $
    LParen = 40,    // (
    RParen = 41,    // )
    LBrace = 123,   // {
    RBrace = 125,   // }
    Question = 63,  // ?
    LBracket = 91,  // [
    RBracket = 93,  // ]
    Backslash = 92, // \
}
