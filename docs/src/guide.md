# Guide

This guide helps you start quickly with xBuild.

## Create `config.xbuild.ts`

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

export const config: xBuildConfig = {
  variants: {
    main: {
      esbuild: {
        entryPoints: ['src/index.ts'],
        outdir: 'dist',
        bundle: true,
        format: 'esm'
      }
    }
  }
};
```

## Run Build

```bash
xBuild
```

Or target a variant:

```bash
xBuild --build main
```

## Useful Docs

- Configuration file: [`configuration/file.md`](./configuration/file.md)
- CLI options: [`configuration/cli.md`](./configuration/cli.md)
- Serve config: [`configuration/serve.md`](./configuration/serve.md)
- Lifecycle hooks: [`configuration/lifecycle.md`](./configuration/lifecycle.md)
- Runtime config updates: [`configuration/runtime.md`](./configuration/runtime.md)
- Programmatic API: [`advanced/programmatic.md`](./advanced/programmatic.md)
- Observables (architecture): [`advanced/observables.md`](./advanced/observables.md)
- Macros:
  - [`macros/ifdef.md`](./macros/ifdef.md)
  - [`macros/ifndef.md`](./macros/ifndef.md)
  - [`macros/inline.md`](./macros/inline.md)

## TypeScript Autocomplete

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

## Programmatic Build (Without CLI)

xBuild also exports APIs from `index` so you can create custom builds in code (without using the CLI).

Useful exports:
- `BuildService`
- `overwriteConfig`
- `patchConfig`
- `ServerModule` (serve)
- `WatchService` (watch)

```ts
import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';

overwriteConfig({
  variants: {
    custom: {
      esbuild: {
        entryPoints: ['src/index.ts'],
        outdir: 'dist/custom',
        bundle: true,
        format: 'esm'
      }
    }
  }
});

const service = new BuildService();
await service.build('custom');
```
