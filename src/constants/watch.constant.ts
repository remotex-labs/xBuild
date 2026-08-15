/**
 * Numeric codes for the kind of change reported for a watched path.
 *
 * @remarks
 * A `const enum`, so every reference inlines to its literal value at compile time, and no runtime object is emitted.
 * Used internally by the watcher on the event path.
 * The runtime-visible counterpart consumers import is {@link ChangeTypes}.
 *
 * @example
 * ```ts
 * if (change.type === ChangeCode.Deleted) forget(path);
 * ```
 *
 * @see ChangeTypes
 * @since 3.0.0
 */

export const enum ChangeCode {
    /**
     * A path seen for the first time, recognized by its `birthtime` and `mtime` being equal.
     *
     * @since 3.0.0
     */

    Added = 0,

    /**
     * A later modification to a path the watcher already knew about.
     *
     * @since 3.0.0
     */

    Change = 1,

    /**
     * A path that no longer resolves on the disk, after which its watcher is closed.
     *
     * @since 3.0.0
     */

    Deleted = 2
}

/**
 * Runtime map of watch change kinds, keyed by name.
 *
 * @remarks
 * Mirrors {@link ChangeCode} as a real exported object,
 * so consumers can reference the codes at runtime - to validate or label the `type` of an emitted
 * {@link WatchChangeInterface}, among other uses.
 * The companion {@link ChangeType} type narrows to the union of these codes.
 *
 * @example
 * ```ts
 * ChangeTypes.Added;   // 0
 * ChangeTypes.Deleted; // 2
 * ```
 *
 * @see ChangeCode
 * @since 3.0.0
 */

export const ChangeTypes = {
    /**
     * A path seen for the first time.
     *
     * @see ChangeCode.Added
     * @since 3.0.0
     */

    Added: ChangeCode.Added,

    /**
     * A later modification to a path already known.
     *
     * @see ChangeCode.Change
     * @since 3.0.0
     */

    Change: ChangeCode.Change,

    /**
     * A path that no longer resolves on the disk.
     *
     * @see ChangeCode.Deleted
     * @since 3.0.0
     */

    Deleted: ChangeCode.Deleted
} as const;
