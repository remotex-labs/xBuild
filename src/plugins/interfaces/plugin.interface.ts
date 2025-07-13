/**
 * Import will remove at compile time
 */

import type { PluginsBuildStateInterface } from '@providers/interfaces/plugins.interface';

/**
 * The `BuildStateInterface` extends the `PluginsBuildStateInterface` interface to include additional properties related to the build
 * process, specifically for handling `ifdef` conditions and function removals in macros.
 *
 * @interface BuildStateInterface
 */

export interface BuildStateInterface extends PluginsBuildStateInterface{
    ifdef: Array<string>
    macros: {
        removeFunctions: Set<string>
    };
}
