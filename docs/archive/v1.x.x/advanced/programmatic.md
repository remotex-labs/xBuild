# Programmatic API

Drive xBuild from your own scripts instead of the CLI. The package exports three entry points:

```ts
import { build, buildWithArgv, buildWithConfigPath } from '@remotex-labs/xbuild';
```

| Function                          | Signature                                                           | Use case                                         |
|-----------------------------------|---------------------------------------------------------------------|--------------------------------------------------|
| `build(config)`                   | `(config: PartialDeepConfigurationsType) => Promise<BuildResult[]>` | Build from an in-memory configuration object.    |
| `buildWithConfigPath(configPath)` | `(configFilePath: string) => Promise<BuildResult[]>`                | Load a `xbuild.config.ts` file and build it.     |
| `buildWithArgv(argv)`             | `(argv: Array<string>) => Promise<void>`                            | Run the full CLI pipeline with custom arguments. |

## Build from a config object

```ts
import { build } from '@remotex-labs/xbuild';

const results = await build({
    declaration: true,
    esbuild: {
        entryPoints: [ './src/index.ts' ],
        bundle: true,
        format: 'esm',
        outdir: 'dist'
    }
});

console.log(results); // esbuild BuildResult[]
```

## Build from a config file

```ts
import { buildWithConfigPath } from '@remotex-labs/xbuild';

const results = await buildWithConfigPath('./xbuild.config.ts');
```

## Run the CLI pipeline

```ts
import { buildWithArgv } from '@remotex-labs/xbuild';

// Same arguments the xbuild binary accepts
await buildWithArgv([ 'src/index.ts', '-o', 'dist', '--bundle', '--watch' ]);
```

## See also

- [`xbuild.config.ts` reference](../configuration/file)
- [CLI options](../configuration/cli)
