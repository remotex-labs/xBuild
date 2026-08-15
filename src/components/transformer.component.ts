/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { Span } from '@oxc-project/types';
import type { SourceEditInterface } from './interfaces/transformer-component.interface';

/**
 * Imports
 */

import { Char } from '@constants/char.constant';

/**
 * Records an edit that deletes a node along with the rest of its line.
 *
 * @param node - Span of the node to delete, as the parser reported it
 * @param content - Source text the span points into
 * @param edits - Collector the deletion is appended to
 *
 * @remarks
 * The deleted range runs from the start of the node through the spaces and tabs that follow it and one line terminator,
 * so a statement that sat alone on its line does not leave a blank line behind.
 * Anything before the node on that line is kept, since the scan only moves forward from the node's end.
 *
 * @example
 * ```ts
 * const content = "import 'a';\nconst x = 1;";
 * const edits: Array<SourceEditInterface> = [];
 *
 * removeNode({ start: 0, end: 11 }, content, edits);
 * edits;                      // [ { start: 0, end: 12 } ]
 * applyEdits(content, edits); // 'const x = 1;'
 * ```
 *
 * @see applyEdits
 * @since 3.0.0
 */

export function removeNode(node: Span, content: string, edits: Array<SourceEditInterface>): void {
    let cursor = node.end;

    while (cursor < content.length) {
        const code = content.charCodeAt(cursor);
        if (code !== Char.Space && code !== Char.Tab) break;
        cursor++;
    }
    if (content.charCodeAt(cursor) === Char.Cr) cursor++;
    if (content.charCodeAt(cursor) === Char.Lf) cursor++;

    edits.push({ start: node.start, end: cursor });
}

/**
 * Rewrites the source text with a set of edits applied.
 *
 * @param content - Source text the edits point into
 * @param edits - Edits to apply, sorted in place by start offset
 * @returns The rewritten text, or `content` itself when there is nothing to apply
 *
 * @remarks
 * The edits are ordered by start offset and applied left to right,
 * so a transform can collect them in whatever order it walks the tree.
 * An edit starting inside a range an earlier edit already replaced is dropped rather than merged,
 * which keeps the output well-formed when two passes claim overlapping spans.
 * An edit carrying no `text` deletes its span.
 * The array is sorted in place, so a caller that depends on its original order should pass a copy.
 *
 * @example
 * ```ts
 * applyEdits('const a = 1;', [ { start: 0, end: 5, text: 'let' } ]); // 'let a = 1';
 * applyEdits('const a = 1;', [ { start: 0, end: 6 } ]);              // 'a = 1;' - deleted
 * applyEdits('const a = 1;', []);                                    // 'const a = 1;' - returned untouched
 * ```
 *
 * @see SourceEditInterface
 * @since 3.0.0
 */

export function applyEdits(content: string, edits: Array<SourceEditInterface>): string {
    if (edits.length < 1) return content;
    edits.sort((left, right) => left.start - right.start);

    const parts: Array<string> = new Array(edits.length * 2 + 1);
    let index = 0;
    let cursor = 0;

    for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        if (edit.start < cursor) continue;
        parts[index++] = content.slice(cursor, edit.start);
        parts[index++] = edit.text ?? '';
        cursor = edit.end;
    }

    parts[index++] = content.slice(cursor);
    parts.length = index;

    return parts.join('');
}
