# CLI

xBuild has built-in CLI options and also supports custom options from `config.xbuild.ts` via `userArgv`.

## Basic Usage

```bash
xBuild [entryPoints..] [options]
```

## Built-in Options (Common)

- `--config`, `-c`: config file path (default: `config.xbuild.ts`)
- `--build`, `--xb`: select variant(s) by name
- `--watch`, `-w`: rebuild on file change
- `--serve`, `-s`: start server (optionally pass folder)
- `--bundle`, `-b`: bundle dependencies
- `--minify`, `-m`: minify output
- `--format`, `-f`: output format (`cjs`, `esm`, `iife`)
- `--platform`, `-p`: platform (`browser`, `node`, `neutral`)
- `--types`, `--btc`: run type checking in build
- `--typeCheck`, `--tc`: type-check only
- `--declaration`, `--de`: emit `.d.ts`
- `--failOnError`, `--foe`: fail on TS errors
- `--outdir`, `-o`: output directory
- `--tsconfig`, `--tsc`: custom tsconfig
- `--verbose`, `-v`: verbose output

## Build Variants from CLI

```bash
xBuild --build dev
xBuild --build dev prod
```

If `--build` is omitted, all variants are built.

## Custom CLI Arguments with `userArgv`

You can add **custom elements to argv** in `config.xbuild.ts` under `userArgv`.

```ts
import type { xBuildConfig } from '@remotex-labs/xbuild';

export const config: xBuildConfig = {
  userArgv: {
    env: {
      type: 'string',
      choices: ['development', 'staging', 'production'],
      default: 'development',
      description: 'Target environment'
    },
    deploy: {
      type: 'boolean',
      default: false,
      description: 'Deploy after successful build'
    }
  },
  variants: {
    main: {
      esbuild: {
        entryPoints: ['src/index.ts'],
        outdir: 'dist'
      },
      lifecycle: {
        onSuccess(context) {
          if (context.argv.deploy) {
            console.log('Deploying to', context.argv.env);
          }
        }
      }
    }
  }
};
```

Run with custom args:

```bash
xBuild --env production --deploy
```

::: tip Note
These args are parsed by CLI and available in lifecycle hook `context.argv`.
:::

## Help Output

Custom `userArgv` options appear in the CLI help under **user Options**.
