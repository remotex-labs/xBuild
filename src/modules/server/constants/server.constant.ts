/**
 * The content type each served file extension is sent with, keyed by the extension without its dot.
 *
 * @remarks
 * Covers what a build emits rather than the web at large.
 * TypeScript is served as plain text, so a browser shows a source file instead of downloading it.
 * Built once at load rather than on every request.
 *
 * @example
 * ```ts
 * ContentTypes.js;  // 'application/javascript'
 * ContentTypes.ts;  // 'text/plain'
 * ```
 *
 * @since 3.2.0
 */

export const ContentTypes: Readonly<Record<string, string>> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    cjs: 'application/javascript',
    mjs: 'application/javascript',
    ts: 'text/plain',
    map: 'application/json',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    gif: 'image/gif',
    txt: 'text/plain'
};
