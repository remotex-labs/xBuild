# config.xbuild.ts

`config.xbuild.ts` is the main xBuild configuration file.

## Basic Structure

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

export const config: xBuildConfig = {
  common: {
    types: true,
    declaration: true,
    esbuild: {
      sourcemap: true,
      platform: 'node'
    }
  },
  variants: {
    main: {
      define: {
        DEBUG: true
      },
      esbuild: {
        entryPoints: ['src/index.ts'],
        outdir: 'dist',
        bundle: true,
        format: 'esm'
      }
    }
  },
  serve: {
    dir: 'dist',
    start: true
  }
};

// also supported:
// export default config;
```

## Top-Level Fields

- `variants` (required): named build variants.
- `common` (optional): shared config merged into all variants.
- `verbose` (optional): enable detailed logs.
- `userArgv` (optional): custom CLI options using yargs `Options`.
- `serve` (optional): development server config.

## `serve`

For full `serve` options and examples, see:

- [`Serve Configuration`](./serve.md)

## `variants`

Each variant requires `esbuild.entryPoints` and can override anything from `common`.

```ts
variants: {
  dev: {
    esbuild: {
      entryPoints: ['src/index.ts'],
      outdir: 'dist/dev',
      sourcemap: true,
      minify: false
    }
  },
  prod: {
    define: { DEBUG: false },
    esbuild: {
      entryPoints: ['src/index.ts'],
      outdir: 'dist/prod',
      minify: true,
      bundle: true
    }
  }
}
```

## `common`

Shared defaults for all variants:

```ts
common: {
  types: { failOnError: true },
  declaration: { bundle: true, outDir: 'dist/types' },
  esbuild: {
    platform: 'node',
    target: ['node20']
  }
}
```

## `types` and `declaration`

xBuild handles TypeScript checks and declaration generation in lifecycle hooks:

- `types` is handled in the build `start` phase.
- `declaration` is handled in the build `end` phase (only when build has no errors).

### `types`

Supported forms:

```ts
types: true
// or
types: {
  failOnError: true
}
```

Behavior:

- `types: true` enables TS diagnostics.
- If `failOnError` is `false`, diagnostics are reported as warnings and build can continue.
- If `failOnError` is `true` (or not set), TS errors fail the build.

### `declaration`

Supported forms:

```ts
declaration: true
// or
declaration: {
  outDir: 'dist/types',
  bundle: true
}
```

Behavior:

- Declaration generation runs only after a successful build.
- `outDir` overrides declaration output directory.

Bundle behavior:

- `bundle` default is `true`.
- When `bundle: true`, xBuild uses declaration bundling (`emitBundle`) and creates bundled `.d.ts` outputs from entry points.
- When `bundle: false`, xBuild emits per-file declarations (`emit`).

Example:

```ts
common: {
  types: { failOnError: true },
  declaration: {
    bundle: true,
    outDir: 'dist/types'
  }
}
```

## `define` + Macros

`define` values are used by macros like `$$ifdef`, `$$ifndef`, and `$$inline`.

```ts
define: {
  DEBUG: true,
  PRODUCTION: false
}
```

## Lifecycle Hooks

For complete lifecycle hook docs and context details, see:

- [`Build Lifecycle Hooks`](./lifecycle.md)

## Export Style

`configFileProvider` supports both:

- `export const config = { ... }`
- `export default { ... }`

## TypeScript Autocomplete

To get macro and config typings in TS projects:

```json
{
  "compilerOptions": {
    "types": [
      "node",
      "@remotex-labs/xBuild"
    ]
  }
}
```
