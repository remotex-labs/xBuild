/**
 * Import will remove at compile time
 */

import type { OnLoadResult } from 'esbuild';
import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Imports
 */

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

/**
 * Removes HTML comments from the given HTML string.
 *
 * @param html - The HTML string to process
 * @returns The HTML string with all comments removed
 */
function removeComments(html: string): string {
    return html.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Collapses redundant whitespace in an HTML string.
 *
 * @param html - The HTML string to process
 * @returns The HTML string with collapsed whitespace
 */
function collapseWhitespace(html: string): string {
    return html
        .replace(/\s{2,}/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
}

/**
 * Minifies a CSS string by removing comments, collapsing whitespace,
 * and stripping spaces around operators and punctuation.
 *
 * @param css - The CSS string to minify
 * @returns The minified CSS string
 */
function minifyCSS(css: string): string {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,>~+])\s*/g, '$1')
        .replace(/;}/g, '}')
        .replace(/:\s+/g, ':')
        .trim();
}

/**
 * Minifies all inline `<style>` blocks within an HTML string.
 *
 * @param html - The HTML string to process
 * @returns The HTML string with minified style blocks
 */
function minifyStyles(html: string): string {
    return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs, css) =>
        `<style${ attrs }>${ minifyCSS(css) }</style>`
    );
}

/**
 * Represents a pure string transformation function.
 */
type TransformerType = (input: string) => string;

/**
 * Composes multiple string transformers into a single transformer,
 * applying them left to right.
 *
 * @param fns - The transformer functions to compose
 * @returns A single transformer that applies each function in sequence
 */
function pipe(...fns: Array<TransformerType>): TransformerType {
    return (input: string) => fns.reduce((acc, fn) => fn(acc), input);
}

/**
 * Minifies an HTML string by removing comments, minifying inline styles and scripts,
 * and collapsing whitespace.
 *
 * @param html - The HTML string to minify
 * @returns The minified HTML string
 */
export const minifyHTML = pipe(
    removeComments,
    minifyStyles,
    collapseWhitespace
);

/**
 * Config build
 */

export const config: xBuildConfig = {
    variants: {
        main: {
            define: {
                __VERSION: pkg.version
            },
            esbuild: {
                bundle: true,
                minify: true,
                format: 'esm',
                target: [ `node${ version.slice(1) }` ],
                platform: 'node',
                packages: 'external',
                sourcemap: true,
                external: [ './index.js' ],
                sourceRoot: `https://github.com/remotex-labs/xBuild/tree/v${ pkg.version }/`,
                entryPoints: {
                    bash: 'src/bash.ts',
                    index: 'src/index.ts'
                },
                loader: {
                    '.html': 'text'
                }
            },
            lifecycle: {
                onLoad({ args, contents }): OnLoadResult | undefined {
                    if (!args.path.endsWith('.html')) return;

                    return {
                        contents: minifyHTML(contents.toString())
                    };
                }
            }
        }
    }
};
