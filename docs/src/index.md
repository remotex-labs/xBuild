---
layout: home
title: 'xBuild'
titleTemplate: 'A versatile JavaScript and TypeScript toolchain build system'
hero:
  name: 'xBuild'
  text: 'Build, type-check, and serve TypeScript projects'
  tagline: xBuild is an esbuild-powered toolchain with variant builds, lifecycle plugins, and oxc-driven compile-time macros.
  actions:
    - theme: brand
      text: Get Started
      link: ./guide
    - theme: alt
      text: Configuration
      link: ./configuration/file
    - theme: alt
      text: GitHub
      link: https://github.com/remotex-labs/xBuild
  image:
    src: /logo.png
    alt: 'xBuild logo'
features:
  - title: Multi-variant builds
    icon: 🧩
    details: Declare several outputs in one file, order them with `dependOn`, and run a subset with `--build`.
  - title: TypeScript tooling
    icon: 🧠
    details: Type-check with `types` and emit bundled or per-file `.d.ts` with `declaration`, both driven by the project tsconfig.
  - title: Lifecycle hooks and plugins
    icon: 🪝
    details: Extend a build with `onSetup`, `onStart`, `onResolve`, `onLoad`, `onEnd`, and `onSuccess`, as one set or as named plugins.
  - title: Compile-time macros
    icon: ⚡
    details: '`$$ifdef`, `$$ifndef`, and `$$inline` rewrite the source as span edits over an oxc AST, dropping dead bindings across files.'
  - title: Watch, serve, and shortcuts
    icon: 🔁
    details: '`--watch` and `--serve` share one interactive terminal with a status bar and single-key rebuild, reload, and verbose toggles.'
  - title: Levelled reporting
    icon: 🎚️
    details: One `logLevel` for the run, and `logOverride` to lift, lower, or silence a single esbuild message by id or by pattern.
---
