/**
 * Import will remove at compile time
 */

import type { ResolveOptionsInterface, ResolveMetadataInterface as xMapResolveMetadataInterface } from '@remotex-labs/xmap';

/**
 * Configuration options for parsing and formatting stack traces.
 *
 * @remarks
 * These options control how stack traces are parsed, what frames are included,
 * and how much source code context is displayed. Used by {@link getErrorMetadata}
 * to customize stack trace output.
 *
 * @see stackEntry
 * @see getErrorMetadata
 *
 * @since 2.0.0
 */

export interface StackTraceInterface  extends Omit<ResolveOptionsInterface, 'getSource'> {
    /**
     * Whether to include framework-internal stack frames in the output.
     *
     * @defaultValue Based on `ConfigurationService.verbose` setting
     *
     * @remarks
     * Framework frames are identified by {@link FrameworkService.isFrameworkFile}.
     * When false, these frames are filtered out to reduce noise in stack traces.
     * Automatically set based on the `verbose` configuration setting if not
     * explicitly provided.
     *
     * @see FrameworkService.isFrameworkFile
     * @since 2.0.0
     */

    withFrameworkFrames?: boolean;
}

/**
 * Additional metadata used when resolving and formatting source output.
 *
 * @remarks
 * Extends the base xMap resolution metadata with optional formatted code text
 * that can be attached to the resolution result.
 *
 * @since 2.2.5
 */

export interface ResolveMetadataInterface extends xMapResolveMetadataInterface {
    /**
     * Formatted source code associated with the resolved item.
     *
     * @remarks
     * Typically used when a resolved file needs to preserve or expose its
     * transformed code representation for later processing or display.
     *
     * @since 2.2.5
     */

    formatCode?: string;
}
