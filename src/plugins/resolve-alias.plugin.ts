/**
 * Imports
 */

import { relative } from 'path';

/**
 * Resolves path aliases in the provided content based on the specified paths and root directory.
 *
 * This function takes a string of content and replaces occurrences of defined path alias keys
 * with their corresponding relative paths derived from the specified source file and root directory.
 * It ensures that the resulting paths are relative to the directory of the source file and formatted
 * correctly for use in a JavaScript/TypeScript environment.
 *
 * Example:
 * Given the following inputs:
 * ```ts
 * const content = "import { foo } from '@core/foo';";
 * const sourceFile = "/project/src/index.ts";
 * const paths = {
 *   '@core/': 'src/core',
 *   '@utils/': 'src/utils'
 * };
 * const rootDir = "/project";
 * ```
 * The function will replace `@core/foo` with a relative path based on the source file's location,
 * potentially resulting in:
 * ```ts
 * const content = "import { foo } from './core/foo';";
 * ```
 *
 * @param content - The content in which path aliases need to be resolved.
 * @param sourceFile - The path of the source file from which relative paths will be calculated.
 * @param paths - An object mapping path alias keys to their corresponding paths.
 * @param esm -  A flag indicating whether ESM is enabled.
 * @returns The updated content with resolved path aliases.
 */

export function resolveAliasPlugin(content: string, sourceFile: string, paths: Record<string, string>, esm: boolean): string {
    const importExportRegex = /(?:import|export)\s.*?\sfrom\s+['"]([^'"]+)['"]/g;
    for (const key in paths) {
        let relativePath = relative(sourceFile, paths[key]).replace(/\\/g, '/');
        if (!relativePath.startsWith('..')) {
            relativePath = `./${ relativePath }`;
        }

        content = content.replaceAll(key, `${ relativePath }/`);
        if (esm) {
            content = content.replace(importExportRegex, (match, p1) =>
                (p1.startsWith('../') || p1.startsWith('./')) && !p1.endsWith('.js')
                    ? match.replace(p1, `${ p1 }.js`)
                    : match
            );
        }
    }

    return content;
}
