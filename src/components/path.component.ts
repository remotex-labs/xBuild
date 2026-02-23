/**
 * Import
 */

import * as path from 'path';
import * as pathPosix from 'path/posix';

/**
 * Regular expression to match backslashes in file paths.
 *
 * @remarks
 * Used by {@link toPosix} to convert Windows-style backslash path separators
 * to POSIX-style forward slashes for cross-platform path normalization.
 *
 * Matches: `\`
 *
 * @since 2.0.0
 */

const BACKSLASH_RE = /\\/g;

/**
 * Regular expression to match consecutive forward slashes in file paths.
 *
 * @remarks
 * Used by {@link toPosix} to normalize paths by collapsing multiple consecutive
 * forward slashes into a single slash. This ensures consistent path formatting
 * across different platforms and input sources.
 *
 * Matches: Two or more forward slashes (`//`, `///`, etc.)
 *
 * @since 2.0.0
 */

const DUPLICATE_SLASH_RE = /\/+/g;

/**
 * Converts a file path to POSIX format by normalizing backslashes and duplicate slashes.
 *
 * @param input - The file path to convert (can be null or undefined)
 *
 * @returns The path in POSIX format with forward slashes, or an empty string if input is falsy
 *
 * @remarks
 * This function performs the following transformations:
 * 1. Converts all backslashes (`\`) to forward slashes (`/`)
 * 2. Collapses consecutive forward slashes into a single slash
 * 3. Returns an empty string for null, undefined, or empty input
 *
 * This is useful for normalizing Windows-style paths to POSIX-style paths for
 * cross-platform compatibility in build tools and file processing.
 *
 * @example Converting Windows path
 * ```ts
 * const windowsPath = 'C:\\Users\\Documents\\file.txt';
 * const posixPath = toPosix(windowsPath);
 * // 'C:/Users/Documents/file.txt'
 * ```
 *
 * @example Normalizing duplicate slashes
 * ```ts
 * const messyPath = 'src//components///Button.tsx';
 * const cleanPath = toPosix(messyPath);
 * // 'src/components/Button.tsx'
 * ```
 *
 * @example Handling falsy values
 * ```ts
 * toPosix(null);      // ''
 * toPosix(undefined); // ''
 * toPosix('');        // ''
 * ```
 *
 * @since 2.0.0
 */

export function toPosix(input: string | null | undefined): string {
    if (!input) return '';

    let p = String(input);
    p = p.replace(BACKSLASH_RE, '/');
    p = p.replace(DUPLICATE_SLASH_RE, '/');

    return p;
}

/**
 * Normalizes a file path to POSIX format and resolves `.` and `..` segments.
 *
 * @param path - The file path to normalize
 *
 * @returns The normalized POSIX path with resolved relative segments
 *
 * @remarks
 * This function:
 * 1. Converts the path to POSIX format using {@link toPosix}
 * 2. Applies `path.posix.normalize()` to resolve `.` and `..` segments
 * 3. Removes trailing slashes (except for root `/`)
 *
 * @example Resolving relative segments
 * ```ts
 * const path = 'src/components/../utils/./helper.ts';
 * const normalized = normalize(path);
 * // 'src/utils/helper.ts'
 * ```
 *
 * @example Normalizing Windows path
 * ```ts
 * const windowsPath = 'C:\\Users\\..\\Documents\\file.txt';
 * const normalized = normalize(windowsPath);
 * // 'C:/Documents/file.txt'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function normalize(path: string): string {
    return pathPosix.normalize(toPosix(path));
}

/**
 * Joins multiple path segments into a single POSIX path.
 *
 * @param paths - Path segments to join
 *
 * @returns The joined path in POSIX format with normalized separators
 *
 * @remarks
 * This function:
 * 1. Converts each path segment to POSIX format using {@link toPosix}
 * 2. Joins them using `path.posix.join()`
 * 3. Normalizes the result (resolves `.` and `..`, removes duplicate slashes)
 *
 * @example Joining path segments
 * ```ts
 * const fullPath = join('src', 'components', 'Button.tsx');
 * // 'src/components/Button.tsx'
 * ```
 *
 * @example Joining mixed-format paths
 * ```ts
 * const fullPath = join('C:\\Users', 'Documents', '../Pictures/photo.jpg');
 * // 'C:/Users/Pictures/photo.jpg'
 * ```
 *
 * @example Joining with empty segments
 * ```ts
 * const fullPath = join('src', '', 'utils');
 * // 'src/utils'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function join(...paths: Array<string>): string {
    return pathPosix.join(...paths.map(toPosix));
}

/**
 * Resolves a sequence of paths into an absolute POSIX path.
 *
 * @param paths - Path segments to resolve (processed right-to-left until an absolute path is found)
 *
 * @returns The resolved absolute path in POSIX format
 *
 * @remarks
 * This function:
 * 1. Uses Node.js `path.resolve()` to compute the absolute path
 * 2. Converts the result to POSIX format using {@link toPosix}
 * 3. Processes paths right-to-left, stopping at the first absolute path
 *
 * The resolution process:
 * - If no absolute path is found, prepends the current working directory
 * - Relative segments (`.` and `..`) are resolved
 * - The result is always an absolute path
 *
 * @example Resolving relative paths
 * ```ts
 * // Current directory: /home/user/project
 * const absolutePath = resolve('src', 'components', 'Button.tsx');
 * // '/home/user/project/src/components/Button.tsx'
 * ```
 *
 * @example Resolving with an absolute path
 * ```ts
 * const absolutePath = resolve('/var/www', 'html', 'index.html');
 * // '/var/www/html/index.html'
 * ```
 *
 * @example Resolving on Windows
 * ```ts
 * // Current directory: C:\Users\project
 * const absolutePath = resolve('src\\utils', '../components/Button.tsx');
 * // 'C:/Users/project/src/components/Button.tsx'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function resolve(...paths: Array<string>): string {
    return toPosix(path.resolve(...paths));
}

/**
 * Returns the directory name of a path in POSIX format.
 *
 * @param p - The file path
 *
 * @returns The directory portion of the path, or `.` for paths without a directory component
 *
 * @remarks
 * This function:
 * 1. Converts the path to POSIX format using {@link toPosix}
 * 2. Extracts the directory portion using `path.posix.dirname()`
 * 3. Removes the last segment (file or final directory name)
 *
 * @example Getting directory name
 * ```ts
 * const dir = dirname('/home/user/file.txt');
 * // '/home/user'
 * ```
 *
 * @example Windows path
 * ```ts
 * const dir = dirname('C:\\Users\\Documents\\file.txt');
 * // 'C:/Users/Documents'
 * ```
 *
 * @example Path without directory
 * ```ts
 * const dir = dirname('file.txt');
 * // '.'
 * ```
 *
 * @example Root path
 * ```ts
 * const dir = dirname('/file.txt');
 * // '/'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function dirname(p: string): string {
    return toPosix(path.dirname(p));
}

/**
 * Calculates the relative path from one location to another in POSIX format.
 *
 * @param from - The source path (starting point)
 * @param to - The destination path (target)
 *
 * @returns The relative path from `from` to `to`, or `.` if paths are identical
 *
 * @remarks
 * This function:
 * 1. Converts both paths to POSIX format using {@link toPosix}
 * 2. Computes the relative path using `path.posix.relative()`
 * 3. Returns `.` when the result is empty (indicating the same location)
 *
 * The relative path uses `..` to navigate up directories and includes only
 * the necessary segments to reach the destination from the source.
 *
 * @example Basic relative path
 * ```ts
 * const rel = relative('/home/user/project', '/home/user/docs/file.txt');
 * // '../docs/file.txt'
 * ```
 *
 * @example Same directory
 * ```ts
 * const rel = relative('/home/user', '/home/user');
 * // '.'
 * ```
 *
 * @example Windows paths
 * ```ts
 * const rel = relative('C:\\Users\\project\\src', 'C:\\Users\\project\\dist\\bundle.js');
 * // '../dist/bundle.js'
 * ```
 *
 * @example Sibling directories
 * ```ts
 * const rel = relative('/app/src/components', '/app/src/utils');
 * // '../utils'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function relative(from: string, to: string): string {
    return pathPosix.relative(toPosix(from), toPosix(to)) || '.';
}

/**
 * Returns the last portion of a path (filename or directory name) in POSIX format.
 *
 * @param p - The file path
 * @param suffix - Optional file extension to remove from the result
 *
 * @returns The base name of the path, optionally with the suffix removed
 *
 * @remarks
 * This function:
 * 1. Converts the path to POSIX format using {@link toPosix}
 * 2. Extracts the final segment using `path.posix.basename()`
 * 3. Optionally removes the specified suffix if it matches the end of the basename
 *
 * The suffix parameter is useful for extracting filenames without extensions.
 *
 * @example Getting filename
 * ```ts
 * const name = basename('/home/user/documents/report.pdf');
 * // 'report.pdf'
 * ```
 *
 * @example Removing extension
 * ```ts
 * const name = basename('/home/user/documents/report.pdf', '.pdf');
 * // 'report'
 * ```
 *
 * @example Windows path
 * ```ts
 * const name = basename('C:\\Users\\Documents\\file.txt');
 * // 'file.txt'
 * ```
 *
 * @example Directory name
 * ```ts
 * const name = basename('/home/user/documents/');
 * // 'documents'
 * ```
 *
 * @example Suffix doesn't match
 * ```ts
 * const name = basename('file.txt', '.md');
 * // 'file.txt'
 * ```
 *
 * @see {@link toPosix} for path conversion
 *
 * @since 2.0.0
 */

export function basename(p: string, suffix?: string): string {
    return toPosix(path.basename(p, suffix));
}
