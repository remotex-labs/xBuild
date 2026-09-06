/**
 * Imports
 */

import { parseSync } from 'oxc-parser';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { isDefined } from '@directives/define.directive';
import { Macros, MacroScanHint } from '@constants/macros.constant';

/**
 * Collects the names of the macro declarations a build is to drop.
 *
 * @param files - Paths to scan, relative or absolute
 * @param defines - The definition table the build substitutes, holding the source text each flag stands for
 * @returns The names bound to a conditional macro whose condition does not hold
 *
 * @remarks
 * Each file is read through {@link FilesModel}, so a path already tracked is served from the cache rather than
 * from the disk, and a path that is missing is skipped.
 * A file is parsed only once it contains {@link MacroScanHint}, which spares the parse where no conditional
 * macro can be.
 *
 * - **What is looked at** - an exported top-level binding alone, `export const NAME = $$ifdef('FLAG')` or its
 *   `$$ifndef` counterpart. A macro nested in a block, or bound without an export, is not seen.
 * - **What counts as defined** - a definition holds source text rather than a value, so the text is what decides.
 *   Anything in {@link MacroFalsyDefines} leaves the flag unset, as does a flag that the table does not name.
 *   Every other text sets the flag, `'0'` and the empty string among them.
 * - **What ends up in the set** - an `$$ifdef` name whose flag is absent, and an `$$ifndef` name whose flag is
 *   present. {@link Macros.inline} is not read here.
 *
 * @example
 * ```ts
 * // src/feature.ts
 * export const $$dev = $$ifdef('DEV');
 * export const $$release = $$ifndef('DEV');
 *
 * analyzeMacros([ 'src/feature.ts' ], { DEV: 'true' });  // Set { '$$release' }
 * analyzeMacros([ 'src/feature.ts' ], { DEV: 'false' }); // Set { '$$dev' }
 * ```
 *
 * @see Macros
 * @see isDefined
 * @see MacroScanHint
 *
 * @since 3.0.0
 */

export function analyzeMacros(files: Iterable<string>, defines: Record<string, string>): Set<string> {
    const dropped = new Set<string>();
    const filesModel = inject(FilesModel);

    for (const file of files) {
        const content = filesModel.touch(file).snapshot?.text;

        if (!content?.includes(MacroScanHint)) continue;
        const { program } = parseSync(file, content, { sourceType: 'module' });

        for (const node of program.body) {
            if (node.type !== 'ExportNamedDeclaration') continue;
            if (node.declaration?.type !== 'VariableDeclaration') continue;

            for (const declarator of node.declaration.declarations) {
                const call = declarator.init;
                if (call?.type !== 'CallExpression' || call.callee.type !== 'Identifier') continue;

                const directive = call.callee.name;
                if (directive !== Macros.ifdef && directive !== Macros.ifndef) continue;

                const arg = call.arguments[0];
                if (arg?.type !== 'Literal' || typeof arg.value !== 'string') continue;
                if (declarator.id.type !== 'Identifier') continue;

                if ((directive === Macros.ifdef) !== isDefined(defines, arg.value)) {
                    dropped.add(declarator.id.name);
                }
            }
        }
    }

    return dropped;
}
