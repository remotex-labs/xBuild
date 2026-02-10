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
 * @see {@link MacrosStaeInterface} for the stage interface that contains this metadata
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

export interface MacrosStaeInterface extends LifecycleStageInterface {
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

    defineMetadata: MacrosMetadataInterface
}
