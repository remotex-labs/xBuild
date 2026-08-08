# xbuild.config.ts

All build settings live in `xbuild.config.ts` (or `.js`). xBuild loads it from the working directory by default; change the path with `--config`.

## Basic Structure

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

const config: xBuildConfig = {
    declaration: true,
    buildOnError: false,
    noTypeChecker: false,
    esbuild: {
        entryPoints: [ './src/index.ts' ],
        bundle: true,
        minify: true,
        format: 'esm'
    },
    serve: {
        active: true,
        port: 8080,
        host: 'localhost'
    }
};

export default config;
```

## Multiple Configurations

Export an array to produce several outputs in one run. Each subsequent configuration inherits from - and can override - the previous one:

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

import { version } from 'process';
import pkg from './package.json' with { type: 'json' };

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

| Property            | Type                                    | Description                                                                                      |
|---------------------|-----------------------------------------|--------------------------------------------------------------------------------------------------|
| `dev`               | `boolean \| Array<string>`              | Build and run entry point(s) in Node.js for development.                                         |
| `watch`             | `boolean`                               | Rebuild on file changes.                                                                         |
| `declaration`       | `boolean`                               | Emit TypeScript declaration (`.d.ts`) files.                                                     |
| `bundleDeclaration` | `boolean`                               | Bundle all declaration files into a single output file.                                          |
| `declarationOutDir` | `string?`                               | Output directory for `.d.ts` files. Falls back to `tsconfig.json`'s `outDir`.                    |
| `moduleTypeOutDir`  | `string?`                               | Where to write the generated `package.json` declaring the module format (see below).             |
| `buildOnError`      | `boolean`                               | Continue the build even if TypeScript errors are present.                                        |
| `noTypeChecker`     | `boolean`                               | Skip TypeScript type checking entirely.                                                          |
| `esbuild`           | `BuildOptions`                          | Core esbuild options: entry points, bundling, format, target, and so on.                         |
| `serve`             | `ServeInterface`                        | Serve the output over HTTP(S). See [Serve configuration](serve).                                 |
| `hooks`             | `Partial<HooksInterface>?`              | Lifecycle hook functions. See [Lifecycle hooks](lifecycle).                                      |
| `define`            | `Record<string, unknown>`               | Compile-time constants; also drives [`ifdef`](../macros/ifdef).                                  |
| `banner`            | `{ [type]: string \| (() => string) }?` | String prepended to every output file ([esbuild banner](https://esbuild.github.io/api/#banner)). |
| `footer`            | `{ [type]: string \| (() => string) }?` | String appended to every output file ([esbuild footer](https://esbuild.github.io/api/#footer)).  |

### `moduleTypeOutDir`

Controls where the generated `package.json` declaring the module format is written:

- If `format` is `esm`, writes `{ "type": "module" }`
- If `format` is `cjs`, writes `{ "type": "commonjs" }`

```ts
{
    esbuild: {
        outdir: 'dist',
        format: 'esm'
    },
    moduleTypeOutDir: 'custom/dist'
}
```

### `define`

Compile-time global constants, ideal for environment flags:

```ts
define: {
    'process.env.NODE_ENV': '"development"',
    'API_URL': '"https://api.example.com"'
}
```

Flags declared here also control [`ifdef` blocks and `$$` function stripping](../macros/ifdef).

## See also

- [CLI options](cli)
- [Lifecycle hooks](lifecycle)
- [Serve configuration](serve)
- [esbuild options](https://esbuild.github.io/api/)
