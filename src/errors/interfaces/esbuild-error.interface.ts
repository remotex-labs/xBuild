/**
 * Represents the location of an ESBuild error within a source file.
 *
 * @remarks
 * Contains detailed information about the file, line, and column where the error occurred.
 * Also includes the full text of the line, the namespace, and optional suggestions
 * to assist in resolving the error.
 *
 * @since 2.0.0
 */

export interface ESBuildLocationInterface {
    /**
     * File path where the error occurred.
     * @since 2.0.0
     */

    file: string;

    /**
     * Line number where the error occurred.
     * @since 2.0.0
     */

    line: number;

    /**
     * Length of the erroneous code span.
     * @since 2.0.0
     */

    length: number;

    /**
     * Column number where the error starts.
     * @since 2.0.0
     */

    column: number;

    /**
     * Full text of the line containing the error.
     * @since 2.0.0
     */

    lineText: string;

    /**
     * Namespace in which the error occurred.
     * @since 2.0.0
     */

    namespace: string;

    /**
     * Suggested fix or guidance for resolving the error.
     * @since 2.0.0
     */

    suggestion: string;
}

/**
 * Represents an individual aggregate error produced by ESBuild.
 *
 * @remarks
 * Aggregate errors often accompany a larger build error. Each contains
 * a message, optional notes, the source location, and the responsible plugin.
 *
 * @since 2.0.0
 */

export interface ESBuildAggregateErrorInterface {
    /**
     * Unique identifier of the aggregate error.
     * @since 2.0.0
     */

    id: string;

    /**
     * Main error message describing the problem.
     * @since 2.0.0
     */

    text: string;

    /**
     * Optional notes providing additional context about the error.
     * @since 2.0.0
     */

    notes: Array<{ text: string }>;

    /**
     * Optional detailed description of the error.
     * @since 2.0.0
     */

    detail?: string;

    /**
     * Source location information for the error.
     * @see ESBuildLocationInterface @since 2.0.0
     */

    location: ESBuildLocationInterface;

    /**
     * Name of the plugin that produced the error.
     * @since 2.0.0
     */

    pluginName: string;
}

/**
 * Represents an ESBuild error, optionally containing aggregate errors.
 *
 * @remarks
 * This interface extends the standard Error object with an optional
 * `aggregateErrors` array, which contains detailed sub-errors that may
 * occur during the build process.
 *
 * @see ESBuildAggregateErrorInterface
 * @since 2.0.0
 */

export interface ESBuildErrorInterface extends Error {
    /**
     * Optional array of aggregate errors associated with this build error.
     * @since 2.0.0
     */

    errors?: Array<ESBuildAggregateErrorInterface>;

    /**
     * Optional array of aggregate errors associated with this build error.
     * @since 2.0.0
     */

    aggregateErrors?: Array<ESBuildAggregateErrorInterface>;
}
