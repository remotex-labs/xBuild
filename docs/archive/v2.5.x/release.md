# Release Notes

What changed in the notable releases of `@remotex-labs/xbuild`.

## v2.5.1

- **Changed**: Qualifiers on named imports (`import type { ... }`) are preserved when bundling declaration files, so
  generated `.d.ts` output keeps `type`-only imports intact. See [`declaration`](configuration/file#declaration).

## v2.5.0

- **Changed**: Diagnostic logging categorizes output into errors, warnings, and info instead of printing a flat list,
  making build output easier to scan.

## v2.4.0

Dependency-aware build execution: variants can declare what they depend on, and xBuild orders the build accordingly.

```ts
const config: xBuildConfig = {
    variants: {
        types: { /* ... */ },
        main: {
            dependOn: 'types' // main builds only after types finishes
        }
    }
};
```

- **Added**: [`dependOn`](configuration/file#dependon) field on a variant (`string` or `Array<string>`) to define
  build order between variants. Dependencies always finish before the dependent variant starts, independent variants
  run in parallel, and cycles or unknown variant names are rejected with a validation error.

## v2.3.0

- **Changed**: Reloading the configuration in watch mode clears the build cache, so config changes take effect without
  stale results. See [Runtime Config Updates](configuration/runtime).
- **Changed**: Path and stack-trace handling moved to `@remotex-labs/xmap`, removing the internal path component.

## v2.2.0

- **Changed**: `$$inline` callbacks receive the full build context: `context.options` now carries the active esbuild
  options and `context.variantName` the current build variant. See [Inline Context](macros/inline#inline-context).
- **Changed**: `outfile` is preferred over `outdir` when both are set on a variant.
- **Changed**: Plain-text esbuild build and runtime errors are normalized as `xBuildError`, and warning-only builds no
  longer fail.

## Earlier releases

- [v2.0.0 / v2.1.x](v2.1.x/release) - the variant/directive rewrite and the `$argv` global (archived docs).
- [v1.x](v1.x.x/release) - the original hooks-based toolchain (archived docs).

## See also

- [Getting Started](guide)
- [config.xbuild.ts](configuration/file)
