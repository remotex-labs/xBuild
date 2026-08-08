# CLI

The `xbuild` command builds the entry points given on the command line or in `xbuild.config.ts`.

## Basic Usage

```bash
xbuild [file] [options]
```

- `file` (positional): the entry point to build. Falls back to `esbuild.entryPoints` from the config file.

## Options

| Option            | Alias   | Type      | Description                                              |
|-------------------|---------|-----------|----------------------------------------------------------|
| `--typeCheck`     | `--tc`  | `boolean` | Perform type checking only.                              |
| `--node`          | `-n`    | `boolean` | Build for the Node.js platform.                          |
| `--dev`           | `-d`    | `array`   | Entry points to build and run in Node.js.                |
| `--debug`         | `--db`  | `array`   | Entry points to run in Node.js with the debugger.        |
| `--serve`         | `-s`    | `boolean` | Serve the build folder over HTTP.                        |
| `--outdir`        | `-o`    | `string`  | Output directory.                                        |
| `--declaration`   | `--de`  | `boolean` | Emit TypeScript declaration files.                       |
| `--watch`         | `-w`    | `boolean` | Watch for file changes.                                  |
| `--config`        | `-c`    | `string`  | Build configuration file. Default: `xbuild.config.ts`.   |
| `--tsconfig`      | `--tsc` | `string`  | TypeScript configuration file. Default: `tsconfig.json`. |
| `--minify`        | `-m`    | `boolean` | Minify the output.                                       |
| `--bundle`        | `-b`    | `boolean` | Bundle the output.                                       |
| `--noTypeChecker` | `--ntc` | `boolean` | Skip TypeScript type checking.                           |
| `--buildOnError`  | `--boe` | `boolean` | Continue building even on TypeScript errors.             |
| `--format`        | `-f`    | `string`  | Output format: `cjs`, `esm`, or `iif`.                   |
| `--version`       | `-v`    | `boolean` | Show the version number.                                 |
| `--help`          | `-h`    | `boolean` | Show help.                                               |

## Examples

```bash
# Bundle and minify to dist/ as ESM
xbuild src/index.ts -o dist --bundle --format esm --minify

# Type-check only
xbuild --typeCheck

# Build and run during development, rebuilding on changes
xbuild -w -d src/index.ts

# Use an alternative config file
xbuild -c build/xbuild.config.ts
```

CLI flags override the corresponding fields of [`xbuild.config.ts`](file).

## See also

- [`xbuild.config.ts` reference](file)
- [Serve configuration](serve)
