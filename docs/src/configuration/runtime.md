# Runtime Config Updates

xBuild supports updating configuration at runtime (without using the CLI).

## Exported APIs

From `@remotex-labs/xbuild`:
- `overwriteConfig(config)`: replace the whole active config.
- `patchConfig(config)`: merge partial config into current config.

## When to use which

- Use `overwriteConfig` when you want a full reset.
- Use `patchConfig` when you want incremental changes.

## Example: full replace

```ts
import { BuildService, overwriteConfig } from '@remotex-labs/xbuild';

overwriteConfig({
  variants: {
    main: {
      esbuild: {
        entryPoints: ['src/index.ts'],
        outdir: 'dist/main',
        bundle: true,
        format: 'esm'
      }
    }
  }
});

const build = new BuildService();
await build.build('main');
```

## Example: partial patch

```ts
import { patchConfig } from '@remotex-labs/xbuild';

patchConfig({
  common: {
    esbuild: {
      minify: false,
      sourcemap: true
    }
  }
});
```

## Hot Reload Notes

Variant services subscribe to configuration changes.

On update, xBuild:
- reloads merged variant config
- re-registers lifecycle hooks
- updates esbuild options
- recreates TypeScript module if `esbuild.tsconfig` changed

This allows runtime config changes while watch/build processes are active.
