/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ParseResult } from 'oxc-parser';
import type { Span, StringLiteral } from '@oxc-project/types';
import type { TypescriptService } from '@typescript/services/typescript.service';
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

/**
 * Queues an edit rewriting a specifier to the relative path of the project file it resolves to.
 *
 * @param source - Specifier literal to rewrite, or `null` when the statement carries none
 * @param target - Resolved absolute path of the file the specifier was written in
 * @param edits - Collector the rewrite is appended to
 * @param ts - Service whose module resolution decides what the specifier names
 *
 * @remarks
 * Only a project file is rewritten, so a specifier naming a package or resolving nowhere is left as it was written.
 * So is a statement with no specifier at all, which is what `export { a }` without a `from` clause looks like.
 * The replacement is measured from the importing file's own directory and carries no extension,
 * so an alias or a `paths` mapping becomes a specifier that still resolves once the file no longer sits in the source
 * tree.
 *
 * @example
 * ```ts
 * const edits: Array<SourceEditInterface> = [];
 *
 * rewrite(statement.source, 'D:/app/src/index.ts', edits, ts);
 * edits; // [ { start: 21, end: 43, text: "'./components/builder.js'" } ]
 * ```
 *
 * @see resolveSource
 * @since 3.0.0
 */

export function rewrite(source: StringLiteral | null, target: string, edits: Array<SourceEditInterface>, ts: TypescriptService): void {
    if (!source) return;

    const resolved = ts.resolve(source.value, target);
    if (!resolved || resolved.isExternalLibraryImport) return;
    const { extension, relativeFileName } = resolved;
    const path = extension ? relativeFileName.slice(0, -extension.length) : relativeFileName;

    edits.push({ end: source.end, start: source.start, text: `'${ path }.js'` });
}

/**
 * Rewrites every project specifier in a parsed file and returns the text with the rewrites applied.
 *
 * @param parse - Parse of the text, whose spans are offsets into `content`
 * @param target - Resolved absolute path of the file the text belongs to
 * @param content - The text the parse describes, handed back unchanged when it is empty
 * @param ts - Service whose module resolution decides which specifiers name project files
 * @returns The text with every project specifier rewritten, or `content` itself when none was
 *
 * @remarks
 * Only top-level statements are visited, since only those can carry module syntax.
 * An import, an `export *`, and a named export are read for their `from` clause,
 * while `import x = require('m')` is read for its module name.
 * `import A = B.C` names no module, so it is left alone, as is an `export { a }` that carries no `from` clause.
 * Every specifier found goes through {@link rewrite}, so a package stays as it was written,
 * and only a project file is rewritten.
 * The parse and the text have to come from the same source, since the spans are offsets into it - a parse of one text
 * applied to another lands its edits in the wrong places.
 *
 * @example
 * ```ts
 * const content = "import { build } from '@components/builder';\nexport const x = 1;";
 * const parse = parseSync('src/index.ts', content, { sourceType: 'module' });
 *
 * resolveSource(parse, 'D:/app/src/index.ts', content, ts);
 * // "import { build } from './components/builder';\nexport const x = 1;"
 * ```
 *
 * @see rewrite
 * @see applyEdits
 *
 * @since 3.0.0
 */

export function resolveSource(parse: ParseResult, target: string, content: string = '', ts: TypescriptService): string {
    if(!content) return content;
    const edits: Array<SourceEditInterface> = [];

    for (const statement of parse.program.body) {
        switch (statement.type) {
            case 'ImportDeclaration':
            case 'ExportAllDeclaration':
            case 'ExportNamedDeclaration':
                rewrite(statement.source, target, edits, ts);
                break;

            case 'TSImportEqualsDeclaration':
                if (statement.moduleReference.type === 'TSExternalModuleReference')
                    rewrite(statement.moduleReference.expression, target, edits, ts);
        }
    }

    return applyEdits(content, edits);
}

