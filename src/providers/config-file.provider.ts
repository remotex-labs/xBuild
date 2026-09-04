/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { xBuildConfigInterface } from '@providers/interfaces/config-file-provider.interface';

/**
 * Imports
 */

import { resolve } from 'path';
import process from 'node:process';
import { createRequire } from 'module';
import { ArgvModule } from '@argv/argv.module';
import { inject } from '@remotex-labs/xinject';
import { FilesModel } from '@models/files.model';
import { sandboxExecute } from '@services/vm.service';
import { deepMerge } from '@components/object.component';
import { FrameworkService } from '@services/framework.service';
import { buildFromString } from '@services/transpiler.service';

/**
 * Runs a compiled configuration file and returns what it exported.
 *
 * @typeParam T - Shape the export is cast to, which the caller states rather than this function checks
 *
 * @param code - The file, already compiled to CommonJS
 * @param path - Path the file came from, which binds its `require` and names it in a stack
 * @param $argv - Arguments to expose to the file as a global, empty where none have been parsed yet
 * @param isolation - Whether to keep the file's console output from reaching the host
 * @returns The named `config` export, the default export where there is none, or an empty object for neither
 *
 * @throws Error - Whatever the file itself threw while it ran
 *
 * @remarks
 * The `require` handed in is bound to the file's own path rather than to this module,
 * so a configuration file resolves a package the way a file in its own directory would.
 * A named `config` export wins over a default export, and a file exporting neither comes back empty.
 * Compiled CommonJS replaces `module.exports` outright,
 * which is what leaves the two exports to be told apart rather than read off the object this function seeded.
 * Reach for `isolation` on a run whose output would only be repeated, since a file may be run more than once.
 *
 * @example
 * ```ts
 * // the file: export const config = { serve: { dir: 'dist' } };
 * const config = await execConfigFile(code, 'xbuild.config.ts', { watch: true });
 * config.serve; // { dir: 'dist' }
 * ```
 *
 * @see sandboxExecute
 * @see configFileProvider
 *
 * @since 3.0.0
 */

export async function execConfigFile<T>(code: string, path: string, $argv = {}, isolation = false): Promise<T> {
    const module = { exports: { config: {}, default: {} } };
    await sandboxExecute(code, { require: createRequire(resolve(path)), module, $argv }, { filename: path }, isolation);
    const config = module.exports.config ?? module.exports.default;

    return (config ?? {}) as T;
}

/**
 * Loads a configuration file and returns what it exported.
 *
 * @typeParam T - Shape the result is cast to, which the caller states rather than this provider checks
 * @param path - Path of the configuration file, relative or absolute
 * @param argv - Object the parsed arguments are written onto, left untouched where the file is missing
 * @returns What the file exported over the default watch settings, or an empty object where it exported nothing
 *
 * @throws BuildFailure - Rejected by esbuild when the file does not compile
 * @throws Error - Whatever the file itself threw while it ran
 *
 * @remarks
 * A configuration file is built as CommonJS and runs through {@link sandboxExecute},
 * with its `require` bound to its own path,
 * so it may import a package the project already depends on rather than only what this build bundles.
 * Its identifiers survive the build, and its source map is registered with {@link FrameworkService},
 * so an error thrown while it runs is reported against the source that was written.
 *
 * The file runs twice, since the options it declares through `userArgv` are known only once it has been read.
 * The first run is a throwaway: it sees an empty `$argv`, and its output is isolated,
 * so a file that logs does not report the same lines on both passes.
 * The command line is then parsed knowing those options, and the second run sees the whole option set on `$argv`.
 * The caller's `argv` object receives those arguments too, which is how a caller reads them back.
 * Anything the file does on its way to an export therefore happens twice.
 *
 * {@link execConfigFile} settles which of the two exports is read,
 * and what comes back here is that export merged over a default watch filter and recursive watching, key by key,
 * so a file naming one watch setting keeps the others.
 * A `filter` the file names joins the default list rather than replacing it,
 * since {@link deepMerge} concatenates two arrays.
 * A file that exports nothing still picks up those defaults,
 * while one that is missing or holds no text returns before the merge and comes back as a bare empty object.
 * The result is cast rather than validated, so a file exporting something else entirely reaches the caller unchanged.
 *
 * @example
 * ```ts
 * // the configuration file
 * export const config = { serve: { dir: 'dist', start: true }, watch: { debounce: 50 } };
 *
 * const loaded = await configFileProvider('xbuild.config.ts');
 * loaded.serve; // { dir: 'dist', start: true }
 * loaded.watch; // { filter: [ ... ], recursive: true, debounce: 50 } - the defaults kept
 * ```
 *
 * @see deepMerge
 * @see execConfigFile
 * @see buildFromString
 * @see xBuildConfigInterface
 *
 * @since 3.0.0
 */

export async function configFileProvider<T extends xBuildConfigInterface>(path: string, argv: Record<string, unknown> = {}): Promise<T> {
    const fileObject = inject(FilesModel).touch(path);
    const text = fileObject.snapshot?.text;
    if (!text) return <T> {};

    const [ map, code ] = (await buildFromString(text, path, {
        minify: false,
        format: 'cjs',
        platform: 'node',
        logLevel: 'silent',
        packages: 'external',
        minifySyntax: true,
        minifyWhitespace: true,
        minifyIdentifiers: false
    })).outputFiles!;

    const argvService = inject(ArgvModule);
    inject(FrameworkService).addSourceMap(path, map.text);

    const preConfig = await execConfigFile<T>(code.text, path, {}, true);
    const args = argvService.enhancedParse(process.argv, preConfig.userArgv ?? {});

    Object.assign(argv, args);
    const config = await execConfigFile<T>(code.text, path, args);

    return deepMerge({} as T, {
        watch: {
            filter: [ '**/*.{js,ts,json}', '!**/*.d.ts' ],
            recursive: true
        }
    }, config as T);
}
