# Release Notes

What changed in the notable releases of `@remotex-labs/xbuild`.

## v3.1.1

- **Fixed**: A build sets the exit code on what it found rather than throwing `Cannot set property exitCode of
  #<process> which has only a getter`. The process reached through the bare `process` import exposes `exitCode`
  as a getter alone, so the write that ends a build threw before the run could say how it went. The process is
  taken from `node:process` now, which is the object the write lands on.

## v3.1.0

- **Fixed**: [`outbase`](/configuration/file#outbase) decides the names a build writes its outputs under. Entry
  points are resolved into a record before the build runs, and esbuild reads `outbase` for entry points written
  as plain paths alone, so the setting reached the build with nothing left to act on: a glob list under
  `outbase: 'src'` still wrote `src/index.ts` to `dist/src/index.js`. The resolved names are taken against
  `outbase` instead, and an unbundled build names its per-file outputs the same way rather than against the
  `rootDir` of its `tsconfig.json`, which stays the fallback where a configuration names no `outbase`. A file the
  globs reach from outside the base keeps its whole path rather than the steps out of `outdir` a relative path
  would carry, and the declarations emitted beside the outputs follow the same names.
- **Fixed**: A watch run picks up an edit to its own [configuration file](/configuration/file) again. The version
  it compared came from the cached contents rather than from disk, so the file never read as changed, and the run
  went on building under the configuration it started with until it was restarted. The modification time is read
  from the filesystem on every watch event instead, which costs one `stat` per event.

## Earlier releases

- [v3.0.x](v3.0.x/release) - the oxc rewrite, the lifecycle plugins, and the interactive terminal (archived docs).
- [v2.5.x](v2.5.x/release) - the last of the TypeScript-AST line (archived docs).
- [v2.0.0 / v2.1.x](v2.1.x/release) - the variant/directive rewrite and the `$argv` global (archived docs).
- [v1.x](v1.x.x/release) - the original hooks-based toolchain (archived docs).

## See also

- [Getting Started](/guide)
- [config.xbuild.ts](/configuration/file)
