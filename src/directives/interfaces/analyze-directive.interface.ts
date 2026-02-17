/**
 * Import will remove at compile time
 */

import type { LifecycleStageInterface } from '@providers/interfaces/lifecycle-provider.interface';

/**
 * Metadata collected during macro analysis for a build variant.
 *
 * @remarks
 * This interface stores essential information about macro usage across the project,
 * used during the transformation phase to:
 * - Determine which files need macro processing
 * - Identify which macro functions should be removed
 * - Optimize build performance by skipping files without macros
 *
 * Both sets use absolute file paths for accurate file identification.
 *
 * @example Metadata after analyzing a project
 * ```ts
 * const metadata: MacrosMetadataInterface = {
 *   filesWithMacros: new Set([
 *     '/project/src/index.ts',
 *     '/project/src/config.ts',
 *     '/project/src/features/analytics.ts'
 *   ]),
 *   disabledMacroNames: new Set([
 *     '$$noProd',      // from $$ifndef('PRODUCTION') when PRODUCTION=true
 *     '$$devOnly',     // from $$ifdef('DEVELOPMENT') when DEVELOPMENT=false
 *     '$$testMode'     // from $$ifdef('TEST') when TEST=false
 *   ])
 * };
 * ```
 *
 * @example Using metadata for optimization
 * ```ts
 * function shouldProcessFile(filePath: string, metadata: MacrosMetadataInterface): boolean {
 *   // Skip files that don't contain any macros
 *   return metadata.filesWithMacros.has(filePath);
 * }
 *
 * function shouldRemoveMacro(macroName: string, metadata: MacrosMetadataInterface): boolean {
 *   // Check if macro should be stripped from output
 *   return metadata.disabledMacroNames.has(macroName);
 * }
 * ```
 *
 * @example Building metadata incrementally
 * ```ts
 * const metadata: MacrosMetadataInterface = {
 *   filesWithMacros: new Set(),
 *   disabledMacroNames: new Set()
 * };
 *
 * // During analysis
 * if (fileContainsMacros(file)) {
 *   metadata.filesWithMacros.add(file);
 * }
 *
 * // When a macro is disabled by definitions
 * if (shouldDisableMacro(macro, defines)) {
 *   metadata.disabledMacroNames.add(macro);
 * }
 * ```
 *
 * @see {@link analyzeMacroMetadata} for the function that generates this metadata
 * @see {@link MacrosStateInterface} for the stage interface that contains this metadata
 *
 * @since 2.0.0
 */

export interface MacrosMetadataInterface {
    /**
     * Set of absolute file paths that contain macro expressions.
     *
     * @remarks
     * Files in this set require macro transformation during the build process.
     * Files not in this set can skip macro processing entirely, improving build performance.
     *
     * Includes files with any of:
     * - `$$ifdef` expressions
     * - `$$ifndef` expressions
     * - Macro variable declarations
     * - Inline macro calls
     *
     * @example
     * ```ts
     * filesWithMacros: new Set([
     *   '/project/src/config.ts', // Has: const $$debug = $$ifdef('DEBUG', ...)
     *   '/project/src/features.ts', // Has: $$ifdef('ANALYTICS', ...)
     *   '/project/src/utils/logger.ts' // Has: export const $$log = $$ifndef('PROD', ...)
     * ])
     * ```
     *
     * @since 2.0.0
     */

    filesWithMacros: Set<string>;

    /**
     * Set of macro function names that should be removed from the output.
     *
     * @remarks
     * Contains macro names that evaluated to false based on the current build definitions.
     * These macros and their calls will be replaced with `undefined` during transformation.
     *
     * A macro is disabled when:
     * - `$$ifdef('X', ...)` and X is false or undefined
     * - `$$ifndef('X', ...)` and X is true
     *
     * @example
     * ```ts
     * // With definitions: { DEBUG: false, PRODUCTION: true, TEST: false }
     * disabledMacroNames: new Set([
     *   '$$hasDebug', // from $$ifdef('DEBUG', ...) - DEBUG is false
     *   '$$noProd', // from $$ifndef('PRODUCTION', ...) - PRODUCTION is true
     *   '$$testMode' // from $$ifdef('TEST', ...) - TEST is false
     * ])
     * ```
     *
     * @since 2.0.0
     */

    disabledMacroNames: Set<string>;
}

/**
 * Describes a single text replacement produced by macro analysis/transformation.
 *
 * @remarks
 * This is a small helper contract used to capture:
 * - the original source fragment ({@link MacroReplacementInterface.source}), and
 * - the text that should replace it ({@link MacroReplacementInterface.replacement}).
 *
 * It is useful for debugging, reporting, and applying deterministic transformations.
 *
 * @example Recording a replacement
 * ```ts
 * const r: MacroReplacementInterface = {
 *   source: "$$ifdef('DEBUG', () => log())",
 *   replacement: "undefined"
 * };
 * ```
 *
 * @since 2.0.0
 */

export interface MacroReplacementInterface {
    /**
     * Original source text that should be replaced.
     *
     * @remarks
     * Typically, this is an exact substring extracted from a file (e.g., a macro call,
     * a macro variable initializer, or any other segment discovered during analysis).
     *
     * Consumers can use this to:
     * - build diagnostics ("what was replaced?")
     * - provide debug output / reports
     * - verify transformations are deterministic
     *
     * @since 2.0.0
     */

    source: string;

    /**
     * Replacement text that should be substituted in place of {@link source}.
     *
     * @remarks
     * This is the final text representation that should appear in the transformed output.
     * For disabled macros this is often `'undefined'`, but it may also be an inlined constant,
     * rewritten function body, or other generated code.
     *
     * @since 2.0.0
     */

    replacement: string;
}

/**
 * Extended lifecycle stage interface with macro-specific metadata.
 *
 * @remarks
 * This interface extends the base {@link LifecycleStageInterface} to include
 * macro analysis metadata, making it available throughout the build lifecycle.
 *
 * The metadata is:
 * - Populated during the analysis phase by {@link analyzeMacroMetadata}
 * - Consumed during the transformation phase by {@link transformerDirective}
 * - Accessible to all lifecycle hooks that need macro information
 *
 * @example Using in build lifecycle
 * ```ts
 * async function onBuild(context: { stage: MacrosStaeInterface }) {
 *   const { defineMetadata } = context.stage;
 *
 *   console.log(`Files with macros: ${defineMetadata.filesWithMacros.size}`);
 *   console.log(`Disabled macros: ${defineMetadata.disabledMacroNames.size}`);
 * }
 * ```
 *
 * @example Checking macro status in plugin
 * ```ts
 * function myPlugin(stage: MacrosStaeInterface) {
 *   return {
 *     name: 'my-plugin',
 *     setup(build) {
 *       build.onLoad({ filter: /\.ts$/ }, (args) => {
 *         if (!stage.defineMetadata.filesWithMacros.has(args.path)) {
 *           // Skip macro processing for this file
 *           return null;
 *         }
 *
 *         // Process macros...
 *       });
 *     }
 *   };
 * }
 * ```
 *
 * @example Accessing in transformer
 * ```ts
 * function transform (code: string, stage: MacrosStaeInterface): string {
 *   const { disabledMacroNames } = stage.defineMetadata;
 *
 *   // Remove disabled macros
 *   for (const macroName of disabledMacroNames) {
 *     code = code.replace(new RegExp(macroName, 'g'), 'undefined');
 *   }
 *
 *   return code;
 * }
 * ```
 *
 * @see {@link analyzeMacroMetadata} for metadata generation
 * @see {@link MacrosMetadataInterface} for metadata structure
 * @see {@link LifecycleStageInterface} for base stage properties
 *
 * @since 2.0.0
 */

export interface MacrosStateInterface extends LifecycleStageInterface {
    /**
     * Macro analysis metadata for the current build.
     *
     * @remarks
     * Contains information about:
     * - Which files contain macros and need processing
     * - Which macro names should be removed based on definitions
     *
     * This metadata is shared across all build plugins and transformers
     * to ensure consistent macro handling throughout the build process.
     *
     * @since 2.0.0
     */

    defineMetadata: MacrosMetadataInterface;

    /**
     * Optional list of macro-driven source replacements recorded during transformation.
     *
     * @remarks
     * When present, this can be used for:
     * - debugging (“what exactly changed?”),
     * - producing transformation reports, or
     * - testing/verifying deterministic output.
     *
     * Each entry describes the original fragment and its replacement via
     * {@link MacroReplacementInterface}.
     *
     * @example
     * ```ts
     * stage.replacementInfo = [
     *   { source: "$$inline(() => 1 + 1)", replacement: "2" },
     *   { source: "$$debug()", replacement: "undefined" }
     * ];
     * ```
     *
     * @since 2.0.0
     */

    replacementInfo?: Array<MacroReplacementInterface>;
}
