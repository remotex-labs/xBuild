/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { DiagnosticCategory, ResolvedModuleFull } from 'typescript';
import type { TypescriptService } from '@typescript/services/typescript.service';

/**
 * A shared service instance together with the number of consumers holding it.
 *
 * @remarks
 * One entry per configuration path, which is what lets several consumers naming the same `tsconfig.json` share a
 * language service instead of each building one.
 * The count decides the teardown: releasing drops it, and only the release that takes it to zero disposes the service.
 *
 * @example
 * ```ts
 * const entry: CacheEntryInterface = { instance, refCount: 1 };
 * entry.refCount++; // a second consumer acquired the same configuration
 * ```
 *
 * @see TypescriptService
 * @since 3.0.0
 */

export interface CacheEntryInterface {
    /**
     * The number of consumers currently holding the instance.
     *
     * @remarks
     * Every acquisition raises it, and every release lowers it.
     * An instance therefore survives until its last holder is done rather than until its first one is.
     *
     * @example
     * ```ts
     * entry.refCount; // 2 - two consumers share this service
     * ```
     *
     * @since 2.0.0
     */

    refCount: number;

    /**
     * The service that the entry hands out.
     *
     * @remarks
     * The first acquisition of a configuration path builds it, and every later one reads back the same instance.
     *
     * @example
     * ```ts
     * const { instance } = entry;
     * instance.check(); // [] - the shared project reports nothing
     * ```
     *
     * @see TypescriptService
     * @since 3.0.0
     */

    instance: TypescriptService;
}

/**
 * A compiler diagnostic reduced to what reporting needs.
 *
 * @remarks
 * Flat and free of compiler objects,
 * so the service caches a diagnostic, holds it across a rebuild, and prints it after its file has left the program.
 * The location fields travel together: {@link file}, {@link line}, {@link column}, and {@link code} are all present
 * for a diagnostic that carries a position, and all absent for one that carries none, such as a configuration error.
 * Only project files reach here, since {@link TypescriptService.check} skips a dependency and every excluded path.
 *
 * @example
 * ```ts
 * service.check();
 * // [ { file: 'D:/app/src/index.ts', line: 3, column: 7, code: 2322, message: "Type 'string'…", category: 1 } ]
 * ```
 *
 * @see TypescriptService
 * @since 2.0.0
 */

export interface DiagnosticInterface {
    /**
     * The file that carries the diagnostic, absent when the diagnostic belongs to no file.
     *
     * @remarks
     * Spelled the way the compiler spells it, which is the absolute path with forward slashes.
     *
     * @example
     * ```ts
     * diagnostic.file; // 'D:/app/src/index.ts'
     * ```
     *
     * @since 2.0.0
     */

    file?: string;

    /**
     * The line that the diagnostic reports, counted from one.
     *
     * @remarks
     * The compiler counts lines from zero, so the service shifts this one to match what an editor and a terminal read.
     *
     * @example
     * ```ts
     * diagnostic.line; // 3 - the third line of the file
     * ```
     *
     * @since 2.0.0
     */

    line?: number;

    /**
     * The TypeScript error number, as the compiler documents it.
     *
     * @remarks
     * The number is what lets a report filter or link by rule rather than by message text.
     *
     * @example
     * ```ts
     * diagnostic.code; // 2322 - Type 'X' is not assignable to type 'Y'
     * ```
     *
     * @since 2.0.0
     */

    code?: number;

    /**
     * The column that the diagnostic reports, counted from one.
     *
     * @remarks
     * The service shifts it from the compiler's zero-based character offset for the same reason it shifts {@link line}.
     *
     * @example
     * ```ts
     * diagnostic.column; // 7 - the seventh character of the line
     * ```
     *
     * @since 2.0.0
     */

    column?: number;

    /**
     * The text of the diagnostic, with any chained messages flattened into it.
     *
     * @remarks
     * A chain that the compiler nests to explain why an assignment failed arrives here as one string,
     * and a newline separates its links.
     *
     * @example
     * ```ts
     * diagnostic.message; // "Type 'string' is not assignable to type 'number'."
     * ```
     *
     * @since 2.0.0
     */

    message: string;

    /**
     * The severity that the compiler assigned, which decides whether the diagnostic fails a build.
     *
     * @example
     * ```ts
     * diagnostic.category; // 1 - the compiler's error category
     * ```
     *
     * @since 2.0.0
     */

    category: DiagnosticCategory
}

/**
 * A resolved module together with the directory that anchored the resolution.
 *
 * @remarks
 * `ResolvedModuleFull` names the file a specifier reached.
 * A rewrite also needs the base directory of that resolution,
 * since the emitted specifier has to sit relative to the file that carries it.
 * {@link TypescriptService.resolve} attaches both fields on the first resolution
 * and hands them back with the cached module.
 * It fills them for a package as well as for a project file,
 * so `isExternalLibraryImport` is what tells the two apart rather than the presence of a relative path.
 *
 * @example
 * ```ts
 * const module = service.resolve('@components/builder', 'D:/app/src/index.ts');
 *
 * module?.resolvedFileName;        // 'D:/app/src/components/builder.ts'
 * module?.relativeFileName;        // './components/builder.ts'
 * module?.isExternalLibraryImport; // false
 * ```
 *
 * @see TypescriptService.resolve
 * @since 3.0.0
 */

export interface ResolvedModuleInterface extends ResolvedModuleFull {
    /**
     * The absolute directory that anchored the resolution.
     *
     * @remarks
     * The directory of the importing file, or the working directory when the caller names no importing file.
     *
     * @example
     * ```ts
     * module.container; // 'D:/app/src'
     * ```
     *
     * @since 3.0.0
     */

    container: string;

    /**
     * The path from {@link container} to the resolved file, always spelled relative.
     *
     * @remarks
     * A path that does not already start with a dot gains a `./` prefix,
     * so it reads as a relative specifier rather than as a bare one that a resolver would look for in `node_modules`.
     * The extension is the one the target carries, so a rewrite that wants a different one has to replace it.
     *
     * @example
     * ```ts
     * module.relativeFileName; // './components/builder.ts'
     * ```
     *
     * @since 3.0.0
     */

    relativeFileName: string;
}
