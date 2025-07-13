/**
 * Import will remove at compile time
 */

import type { BuildOptions } from 'esbuild';
import type { IncomingMessage, ServerResponse } from 'http';
import type { OnEndType, OnLoadType, OnResolveType, OnStartType } from '@providers/interfaces/plugins.interface';

/**
 * Represents the format for specifying entry points in TypeScript declaration generation and esbuild configuration.
 *
 * This type allows for various formats to specify the entry points from which TypeScript declaration files should be generated.
 * The supported formats are:
 * - `Array<string>`: An array of file paths as strings. Each string represents a path to a TypeScript entry point file.
 *   For example: `['src/index.ts', 'src/utils.ts']`.
 *
 * - `Record<string, string>`: An object where each key-value pair represents an entry point.
 *   The key is used as the output file name (without extension), and the value is the file path to the TypeScript entry point.
 *   For example: `{ main: 'src/index.ts', utils: 'src/utils.ts' }`.
 *
 * - `Array<{ in: string, out: string }>`: An array of objects, where each object specifies an input file path (`in`)
 *   and an output file path (`out`). This format allows for specifying where each entry point file is located and
 *   where its corresponding declaration file should be output.
 *   For example: `[{ in: 'src/index.ts', out: 'dist/index.d.ts' }]`.
 *
 * The chosen format affects how the build system processes your entry points and generates output files.
 *
 * @example
 * ```ts
 * // Array of file paths
 * const entryPoints1: EntryPointsType = ['src/index.ts', 'src/utils.ts'];
 *
 * // Object with named entry points
 * const entryPoints2: EntryPointsType = {
 *   main: 'src/index.ts',
 *   utils: 'src/utils.ts'
 * };
 *
 * // Array of objects with explicit input and output paths
 * const entryPoints3: EntryPointsType = [
 *   { in: 'src/index.ts', out: 'dist/index.d.ts' },
 *   { in: 'src/utils.ts', out: 'dist/utils.d.ts' }
 * ];
 * ```
 *
 * When used with esbuild configuration, the format determines how output files are named and structured.
 * When used for TypeScript declaration generation, it affects how declaration files are generated and organized.
 */

export type EntryPointsType = (string | { in: string, out: string })[] | Record<string, string> | undefined;

/**
 * Represents a deeply nested partial version of a given type `T`.
 *
 * This type utility allows for partial objects at any level of nesting.
 * It recursively makes all properties optional and applies the same behavior to nested objects.
 *
 * **Example Usage:**
 *
 * ```ts
 * interface User {
 *     name: string;
 *     address: {
 *         street: string;
 *         city: string;
 *     };
 * }
 *
 * // PartialDeepType<User> will allow the following:
 * const partialUser: PartialDeepType<User> = {
 *     name: 'Alice',        // 'name' is optional
 *     address: {
 *         city: 'Wonderland' // 'street' is optional
 *     }
 * };
 * ```
 *
 * @template T - The type to be made partially optional and deeply nested.
 *
 * @typeParam T - The base type to apply the partial transformation.
 *
 * @example
 * ```
 * type MyPartial = PartialDeepType<{ a: number; b: { c: string; d: { e: boolean } } }>;
 * // MyPartial will be equivalent to:
 * // {
 * //   a?: number;
 * //   b?: {
 * //     c?: string;
 * //     d?: {
 * //       e?: boolean;
 * //     }
 * //   }
 * // }
 * ```
 */

export type PartialDeepType<T> = {
    [P in keyof T]?: T[P] extends object ? PartialDeepType<T[P]> : T[P];
};

/**
 * Represents a module with its exports and an optional default export.
 *
 * This interface provides a structure to define and interact with the exports of a module.
 * It includes both named and default exports, where default exports are of a specific type.
 *
 * @interface ModuleInterface
 *
 * @property exports - An object representing the exports of the module.
 * The keys are strings that represent the names of the exports, and the values can be of any type.
 *
 * @property exports[key: string] - A dictionary where each key is a string representing the export name,
 * and the associated value can be of any type.
 *
 * @property [exports.default] - An optional default export.
 * The default export, if present, is of type `ConfigurationInterface`.
 */

export interface ModuleInterface {

    /**
     * An object representing the exports of the module.
     * The keys are strings representing export names, and the values can be of any type.
     *
     * @property default - An optional default export of type `ConfigurationInterface`.
     */

    exports: {
        [key: string]: unknown;
        default?: ConfigurationInterface;
    };
}

/**
 * Configuration options for the serve the build.
 *
 * This object allows you to specify various settings related to the server,
 * such as the port, host, SSL/TLS certificates, and request handling functions.
 *
 * @example
 * ```ts
 * const serverConfig = {
 *     serve: {
 *         active: true,
 *         port: 8080,
 *         host: 'localhost',
 *         keyfile: '/path/to/ssl/keyfile.pem',
 *         certfile: '/path/to/ssl/certfile.pem',
 *         onStart: () => {
 *             console.log('Server started');
 *         }
 *         onRequest: (req, res, next) => {
 *             console.log('Server request received');
 *             next();
 *         }
 *     }
 * };
 * ```
 *
 * @public
 */

export interface ServeInterface {
    port: number
    host: string
    active: boolean,
    keyfile?: string
    certfile?: string,
    onRequest?: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
    onStart?: () => void
}

/**
 * Defines the lifecycle HooksInterface used in the plugin system.
 *
 * This interface specifies the types for various HooksInterface that can be registered
 * to customize the behavior of the build process. Each hook corresponds to a
 * specific stage in the lifecycle of an esbuild operation.
 *
 * @interface HooksInterface
 *
 * @property onEnd - A hook function that is called after the build process completes.
 *                               This allows for post-processing or cleanup tasks.
 * @property onLoad - A hook function that is called when esbuild attempts to load a module.
 *                                 It can be used to modify the contents of the loaded module.
 * @property onStart - A hook function that is called before the build process starts.
 *                                    This is useful for initialization tasks or logging.
 * @property onResolve - A hook function that is called when esbuild attempts to resolve a module path.
 *                                        It can be used to customize module resolution behavior.
 *
 * @example
 * ```ts
 * const myHooks: HooksInterface = {
 *     onEnd: async (result) => {
 *         console.log('Build finished:', result);
 *     },
 *     onLoad: async (contents, loader, args) => {
 *         // Modify contents if necessary
 *         return { contents, loader };
 *     },
 *     onStart: async (build) => {
 *         console.log('Build started:', build);
 *     },
 *     onResolve: async (args) => {
 *         if (args.path === 'my-module') {
 *             return { path: './src/my-module.ts' };
 *         }
 *         return null;
 *     }
 * };
 * ```
 *
 * @see OnEndType
 * @see OnLoadType
 * @see OnStartType
 * @see OnResolveType
 */

export interface HooksInterface {
    onEnd: OnEndType,
    onLoad: OnLoadType,
    onStart: OnStartType,
    onSuccess: OnEndType
    onResolve: OnResolveType,
}

/**
 * Represents the configuration options for the build and development process.
 *
 * This interface defines various settings that control how the application is built and run, including development mode,
 * file watching, TypeScript declaration generation, error handling, TypeScript type checking, and esbuild bundler options.
 *
 * @example
 * ```ts
 * const config: ConfigurationInterface = {
 *     dev: true,
 *     watch: true,
 *     declaration: true,
 *     buildOnError: false,
 *     noTypeChecker: false,
 *     esbuild: {
 *         entryPoints: ['./src/index.ts'],
 *         bundle: true,
 *         minify: true,
 *         target: 'es2020'
 *     },
 *     hooks: {
 *         onStart: async (build) => {
 *             console.log('Build started');
 *         },
 *         onEnd: async (result) => {
 *             console.log('Build finished:', result);
 *         }
 *     }
 * };
 * ```
 *
 * In this example, the configuration sets the application to development mode with file watching enabled,
 * generates TypeScript declaration files, continues building on TypeScript errors, and includes esbuild options for bundling and minification.
 * Additionally, custom hooks are provided to log messages at the start and end of the build process.
 *
 * @public
 * @category Configuration
 */


export interface ConfigurationInterface {
    /**
     * Build and run entryPoint for development
     */

    dev: boolean | Array<string>;

    /**
     * Enables watching for file changes during development.
     */

    watch: boolean;

    /**
     * The directory where the generated `package.json` file will be saved,
     * indicating the module type (`"commonjs"` or `"module"`).
     *
     * - If the format is `esm`, the `package.json` file will contain `"type": "module"`.
     * - If the format is `cjs`, the `package.json` file will contain `"type": "commonjs"`.
     *
     * If this field is not set (`undefined`), the `package.json` file will be saved in the
     * `outdir` specified in the esbuild configuration.
     *
     * Example:
     *
     * ```ts
     * {
     *   esbuild: {
     *     outdir: 'dist',
     *     format: 'esm'
     *   },
     *   moduleTypeOutDir: 'custom/dist'
     * }
     * // This will create 'custom/dist/package.json' with the content: {"type": "module"}
     *
     * // If moduleTypeOutDir is not provided:
     * {
     *   esbuild: {
     *     outdir: 'dist',
     *     format: 'cjs'
     *   }
     * }
     * // This will create 'dist/package.json' with the content: {"type": "commonjs"}
     * ```
     */

    moduleTypeOutDir?: string;

    /**
     * Generates TypeScript declaration files.
     */

    declaration: boolean;

    /**
     * Bundle declaration file
     */

    bundleDeclaration: boolean;

    /**
     * Overrides the output directory for TypeScript declaration files (.d.ts).
     *
     * If this option is not set, the output directory specified in the `outDir`
     * field of your `tsconfig.json` will be used.
     * This allows for custom control
     * over where the declaration files are emitted, separate from the main
     * output directory for compiled JavaScript files.
     *
     * @default The `outDir` from `tsconfig.json` will be used if this is not provided.
     */

    declarationOutDir?: string;

    /**
     * Continues building even if TypeScript type errors are present.
     */

    buildOnError: boolean;

    /**
     * Skips TypeScript type checking.
     */

    noTypeChecker: boolean;

    /**
     * Options for the esbuild bundler.
     */

    esbuild: BuildOptions;

    /**
     * Option for the serve the build over http/s
     */

    serve: ServeInterface;

    /**
     * lifecycle hooks to customize the build process.
     *
     * This property allows you to provide implementations for various HooksInterface defined in the `HooksInterface` interface.
     * Using `Partial<HooksInterface>` means you can specify only the HooksInterface you want to implement,
     * while the others will default to `undefined`.
     */

    hooks?: Partial<HooksInterface>;

    /**
     * A dictionary of define options for the build process.
     *
     * This property allows you to specify global constants that can be replaced during the build process.
     * Each key-value pair in the `define` object represents a constant where the key is the name of the
     * constant, and the value is the string to replace it with. This is particularly useful for feature flags,
     * environment-specific configurations, or any other value that you may want to define at compile time.
     *
     * @example
     * ```ts
     * const config: ConfigurationInterface = {
     *     dev: true,
     *     define: {
     *         'process.env.NODE_ENV': 'development',
     *         'API_URL': 'https://api.example.com'
     *     }
     * };
     * ```
     *
     * In this example, the constants `process.env.NODE_ENV` and `API_URL` will be replaced with their
     * corresponding values during the build, making it easy to manage different configurations across
     * various environments.
     *
     * @public
     */

    define: Record<string, unknown>;

    /** Documentation: https://esbuild.github.io/api/#banner */
    banner?: { [type: string]: string | (() => string) }

    /** Documentation: https://esbuild.github.io/api/#footer */
    footer?: { [type: string]: string | (() => string) }
}

interface ExportedConfigurationInterface extends ConfigurationInterface {
    /**
     * Options for the esbuild bundler.
     */

    esbuild: Omit<BuildOptions, 'plugins' | 'define'>;
}

/**
 * Type alias for a partial configuration object.
 *
 * This type represents a configuration where all properties of the
 * `ConfigurationInterface` are optional. It allows for flexible configuration
 * objects where only a subset of properties need to be specified.
 */

export type xBuildConfig = PartialDeepType<ExportedConfigurationInterface>;

/**
 * Represents a partially deep configuration type based on the `ConfigurationInterface`.
 *
 * This type is used to define configurations that may have some properties
 * missing or undefined. It leverages the `PartialDeepType` utility type to allow
 * for flexibility in configuration management.
 */

export type PartialDeepConfigurationsType = PartialDeepType<ConfigurationInterface>;

/**
 * Defines the possible types for configurations.
 *
 * This type can either be a single instance of `PartialDeepConfigurationsType`
 * or an array of such instances. This flexibility allows for configurations
 * to be specified as a single object or as multiple objects, enabling
 * support for various build setups.
 *
 * @example
 * ```ts
 * // A single configuration object
 * const config: ConfigurationsType = {
 *     esbuild: {
 *         bundle: true,
 *         outdir: 'dist'
 *     }
 * };
 * ```
 *
 * @example
 * ```ts
 * // An array of configuration objects
 * const configs: ConfigurationsType = [
 *     {
 *         esbuild: {
 *             bundle: true,
 *             outdir: 'dist/esm'
 *         }
 *     },
 *     {
 *         esbuild: {
 *             bundle: false,
 *             outdir: 'dist/cjs',
 *             declaration: false,
 *             noTypeChecker: true
 *         }
 *     }
 * ];
 * ```
 */

export type ConfigurationsType = PartialDeepConfigurationsType | Array<PartialDeepConfigurationsType>;
