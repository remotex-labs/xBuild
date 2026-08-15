/**
 * Type-only imports erased during TypeScript compilation.
 */

import type { ResolveOptionsInterface, ResolveMetadataInterface as xMapResolveMetadataInterface } from '@remotex-labs/xmap';

/**
 * Options deciding which frames a resolved stack keeps and how much source is shown with them.
 *
 * @remarks
 * Extends the xMap resolve options with the one question xMap has no view on:
 * whether the framework's own frames belong in the output.
 * The inherited `linesBefore` and `linesAfter` size the code window,
 * and every other inherited option is passed through to `resolveError` as it stands.
 *
 * @example
 * ```ts
 * getErrorMetadata(error, { withFrameworkFrames: false, linesBefore: 2, linesAfter: 2 });
 * ```
 *
 * @see getErrorMetadata
 * @since 2.0.0
 */

export interface StackTraceInterface  extends Omit<ResolveOptionsInterface, 'getSource'> {
    /**
     * Whether the framework's own frames stay in the resolved stack.
     *
     * @remarks
     * A frame counts as the framework's by {@link FrameworkService.isFrameworkFile}.
     * Omitting it reads as `false`, which is what keeps a project's own frames at the head of the trace.
     * It settles two further questions: whether native frames are admitted
     * and whether a framework frame may supply the code window.
     *
     * @example
     * ```ts
     * getErrorMetadata(error, { withFrameworkFrames: true }); // a failure raised inside the build
     * getErrorMetadata(error);                                // a failure in the project being built
     * ```
     *
     * @see FrameworkService.isFrameworkFile
     * @since 2.0.0
     */

    withFrameworkFrames?: boolean;
}

/**
 * Resolved stack metadata, carrying the code window this package renders for it.
 *
 * @remarks
 * Everything xMap resolves, plus the snippet {@link getErrorMetadata} builds from the first frame that carried code.
 *
 * @example
 * ```ts
 * const metadata = getErrorMetadata(error);
 *
 * metadata.stack[0].format; // 'at run src/index.ts:12:8'
 * metadata.formatCode;      // the highlighted snippet
 * ```
 *
 * @see getErrorMetadata
 * @since 2.2.5
 */

export interface ResolveMetadataInterface extends xMapResolveMetadataInterface {
    /**
     * The highlighted code window to print with the error.
     *
     * @remarks
     * Taken from the first frame that carried code, highlighted and marked at the failing column.
     * Left unset when no frame carried any, which is what a resolve against sources that are gone produces.
     *
     * @example
     * ```ts
     * metadata.formatCode; // '11 | x();\n   | ^'
     * metadata.formatCode; // undefined - no frame resolved to code
     * ```
     *
     * @since 2.2.5
     */

    formatCode?: string;
}
