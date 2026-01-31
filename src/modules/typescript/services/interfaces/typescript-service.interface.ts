/**
 * Import will remove at compile time
 */

import type { ParsedCommandLine, LanguageService } from 'typescript';
import type { LanguageHostService } from '@typescript/services/hosts.service';

/**
 * Represents a cached TypeScript language service instance with reference counting for shared resource management.
 * Enables multiple consumers to share the same language service while tracking active usage through reference counts.
 *
 * @remarks
 * This interface is used internally by {@link TypescriptService} to implement a caching strategy that prevents
 * duplicate language service instances for the same configuration file. The lifecycle follows these rules:
 * - When a new service is created, `refCount` starts at 1
 * - Each additional consumer increments `refCount`
 * - Calling dispose decrements `refCount`
 * - When `refCount` reaches 0, the service is disposed and removed from cache
 *
 * The cached data includes all components needed to maintain a fully functional TypeScript compiler instance:
 * compiled configuration, language service host, and the language service itself.
 *
 * @example
 * ```ts
 * const cached: CachedServiceInterface = {
 *   config: parsedConfig,
 *   host: languageHost,
 *   service: tsLanguageService,
 *   refCount: 1
 * };
 *
 * // Another consumer acquires the same service
 * cached.refCount++; // Now 2
 *
 * // Consumers finish and dispose
 * cached.refCount--; // Now 1
 * cached.refCount--; // Now 0, triggers cleanup
 * ```
 *
 * @see {@link TypescriptService}
 * @see {@link LanguageHostService}
 *
 * @since 2.0.0
 */

export interface CachedServiceInterface {

    /**
     * Number of active consumers currently using this cached language service instance.
     *
     * @remarks
     * This counter tracks how many TypeScript service instances are sharing this cached language service.
     * When it reaches zero, the service can be safely disposed of and removed from the cache.
     *
     * @since 2.0.0
     */
    refCount: number;

    /**
     * Language service host managing file system operations and compiler options for this instance.
     * @since 2.0.0
     */

    host: LanguageHostService;

    /**
     * TypeScript language service providing type checking, analysis, and compilation capabilities.
     * @since 2.0.0
     */

    service: LanguageService;

    /**
     * Parsed TypeScript configuration including compiler options, file names, and project references.
     *
     * @remarks
     * This configuration is reloaded when the `tsconfig.json` file changes, ensuring the cached
     * service stays synchronized with the project's compilation settings.
     *
     * @since 2.0.0
     */

    config: ParsedCommandLine;
}

/**
 * Represents formatted diagnostic information from TypeScript compilation, including errors, warnings, and suggestions.
 * Provides a simplified interface for displaying compiler messages with optional source location details.
 *
 * @remarks
 * This interface normalizes TypeScript's diagnostic format into a structure suitable for display in logs,
 * editor integrations, or build output. All location information (file, line, column) is optional because
 * some diagnostics apply globally or lack specific source positions.
 *
 * Line and column numbers are 1-indexed to match standard editor conventions, even though TypeScript
 * internally uses 0-indexed positions.
 *
 * @example
 * ```ts
 * const diagnostic: DiagnosticsInterface = {
 *   file: 'src/index.ts',
 *   line: 42,
 *   column: 15,
 *   code: 2304,
 *   message: "Cannot find name 'unknownVariable'."
 * };
 *
 * console.log(`${diagnostic.file}:${diagnostic.line}:${diagnostic.column}`);
 * console.log(`TS${diagnostic.code}: ${diagnostic.message}`);
 * ```
 *
 * @see {@link TypescriptService.check}
 * @see {@link TypescriptService.formatDiagnostic}
 *
 * @since 2.0.0
 */

export interface DiagnosticsInterface {

    /**
     * File path where the diagnostic occurred.
     *
     * @remarks
     * Optional because some diagnostics are configuration-level errors that don't relate to a specific file.
     *
     * @since 2.0.0
     */

    file?: string;

    /**
     * Line number where the diagnostic occurred, 1-indexed.
     *
     * @remarks
     * Optional because diagnostics without source location (like config errors) won't have line information.
     * When present, this value is 1-indexed to match standard editor conventions.
     *
     * @since 2.0.0
     */

    line?: number;

    /**
     * Column number where the diagnostic occurred, 1-indexed.
     *
     * @remarks
     * Optional because diagnostics without source location won't have column information.
     * When present, this value is 1-indexed to match standard editor conventions.
     *
     * @since 2.0.0
     */

    column?: number;

    /**
     * TypeScript diagnostic code identifying the specific error or warning type.
     *
     * @remarks
     * Optional because not all diagnostics have associated error codes. When present, this can be used
     * to look up detailed documentation or implement diagnostic-specific handling.
     *
     * @example
     * Common codes include 2304 (cannot find name), 2322 (type not assignable), 2307 (cannot find module).
     *
     * @since 2.0.0
     */

    code?: number;

    /**
     * Human-readable diagnostic message describing the error, warning, or suggestion.
     *
     * @remarks
     * This message is flattened from TypeScript's potentially nested diagnostic message structure
     * using newline separators for multi-line messages.
     *
     * @since 2.0.0
     */

    message: string;
}
