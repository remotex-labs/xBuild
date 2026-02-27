# Configuration Options

Set options in `xbuild.config.ts` (or .js):

```ts
const config: ConfigurationInterface = {
    declaration: true,
    buildOnError: false,
    noTypeChecker: false,
    esbuild: {
        entryPoints: ['./src/index.ts'],
        bundle: true,
        minify: true,
        format: 'esm',
    },
    serve: {
        active: true,
        port: 8080,
        host: 'localhost',
        onRequest: (req, res, next) => {
            console.log('Server request received');
            next();
        }
    }
};
```

You can also define multiple configurations as an array:
> When using multiple configurations, subsequent configurations will inherit and can override properties from previous configurations

```ts
/**
 * Import will remove at compile time
 */

import type { xBuildConfig } from '@remotex-labs/xbuild';

/**
 * Imports
 */

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

/**
 * Config build
 */

const config: Array<xBuildConfig> = [
    {
        declaration: true,
        esbuild: {
            bundle: true,
            minify: true,
            format: 'esm',
            outdir: 'dist/esm',
            target: [ `node${ version.slice(1) }` ],
            platform: 'node',
            packages: 'external',
            sourcemap: true,
            sourceRoot: `https://github.com/remotex-labs/xmap/tree/v${ pkg.version }/`,
            entryPoints: [ 'src/index.ts' ]
        }
    },
    {
        declaration: false,
        noTypeChecker: true,
        esbuild: {
            bundle: true,
            format: 'cjs',
            outdir: 'dist/cjs'
        }
    }
];

export default config;
```

## Properties

### `dev: boolean | string[]`

Build and run entry point(s) for development.

### `watch: boolean`

Enable watch mode for file changes during development.

### `moduleTypeOutDir?: string`

Controls where the generated `package.json` will be saved to declare the module format.

- If `format` is `esm`, writes: `{ "type": "module" }`
- If `format` is `cjs`, writes: `{ "type": "commonjs" }`

Example:

```ts
{
  esbuild: {
    outdir: 'dist',
    format: 'esm'
  },
  moduleTypeOutDir: 'custom/dist'
}
```

### `declaration: boolean`

Emit TypeScript declaration (`.d.ts`) files.

### `bundleDeclaration: boolean`

Whether to bundle all declaration files into one output file.

### `declarationOutDir?: string`

Overrides the output directory for `.d.ts` files. Falls back to `tsconfig.json`'s `outDir`.

### `buildOnError: boolean`

Continue build even if TypeScript errors are present.

### `noTypeChecker: boolean`

Skip TypeScript type checking completely.

### `esbuild: BuildOptions`

The core esbuild options to control bundling, format, target, etc.

### `serve: ServeInterface`

Serve output over HTTP(S). Can include custom request handlers.

### `hooks?: Partial<HooksInterface>`

Lifecycle hook functions to customize the build.

### `define: Record<string, unknown>`

Compile-time global constants. Ideal for environment flags.

Example:

```ts
define: {
  'process.env.NODE_ENV': '"development"',
  'API_URL': '"https://api.example.com"'
}
```

### `banner?: { [type: string]: string | () => string }`

Add a string to the top of every output file. See: [esbuild banner docs](https://esbuild.github.io/api/#banner)

### `footer?: { [type: string]: string | () => string }`

Add a string to the bottom of every output file. See: [esbuild footer docs](https://esbuild.github.io/api/#footer)

---

## `HooksInterface`

Used to tap into the build lifecycle. These hooks let you execute custom logic at various phases of the build process.

### Example

```ts
const myHooks: HooksInterface = {
  onEnd: async (result) => {
    console.log('Build finished:', result)
  },
  onLoad: async (contents, loader, args) => {
    return { contents, loader }
  },
  onStart: async (build) => {
    console.log('Build started:', build)
  },
  onResolve: async (args) => {
    if (args.path === 'my-module') {
      return { path: './src/my-module.ts' }
    }
    return null
  }
}
```

### Hook Types

#### `onStart: OnStartType`

Runs before the build starts. Useful for logging or setup.

#### `onEnd: OnEndType`

Runs after the build finishes. Ideal for post-processing or cleanup.

#### `onLoad: OnLoadType`

Called when esbuild loads a module. You can alter contents or loader.

#### `onResolve: OnResolveType`

Used to intercept and modify module resolution.

#### `onSuccess: OnEndType`

Alternative to `onEnd`, but only triggered when the build succeeds.

---

## See Also

- [esbuild Options](https://esbuild.github.io/api/)
- [Hooks Plugin API](hooks.md)
