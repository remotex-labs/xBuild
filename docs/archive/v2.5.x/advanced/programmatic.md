# Programmatic API

You can use xBuild directly from code without CLI.

## Common exports

- `BuildService`
- `WatchService`
- `ServerModule`
- `overwriteConfig`
- `patchConfig`

## Minimal build example

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

## Watch flow example

```ts
import { WatchService } from '@remotex-labs/xbuild';

const watch = new WatchService();
await watch.start();
```

## Server flow example

```ts
import { ServerModule } from '@remotex-labs/xbuild';

const server = new ServerModule({
  dir: 'dist',
  host: 'localhost',
  port: 3000
});

await server.start();
```

Tip: configure runtime behavior using `overwriteConfig` / `patchConfig` before starting services.
