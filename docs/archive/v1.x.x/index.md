---
layout: home
title: 'xBuild'
titleTemplate: 'A versatile JavaScript and TypeScript toolchain build system'
hero:
  name: 'xBuild'
  text: 'Build, type-check, and serve TypeScript projects'
  tagline: xBuild v1 is an esbuild-powered toolchain with lifecycle hooks, conditional code inclusion, and a built-in dev server.
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
  - title: TypeScript tooling
    icon: 🧠
    details: Type checking and `.d.ts` generation with `declaration`, `bundleDeclaration`, and `--typeCheck`.
  - title: esbuild under the hood
    icon: ⚙️
    details: Bundling, minification, and format control through the `esbuild` options block.
  - title: Lifecycle hooks
    icon: 🪝
    details: Tap into the build with `onStart`, `onResolve`, `onLoad`, `onEnd`, and `onSuccess`.
  - title: Conditional code
    icon: 🔌
    details: Strip code blocks and `$$`-prefixed functions at build time with `ifdef` and `define`.
  - title: Dev workflow
    icon: 🔁
    details: Watch mode, Node.js dev runner, and an HTTP/HTTPS server for the build output.
  - title: Programmatic API
    icon: 🧩
    details: Drive builds from code with `build`, `buildWithConfigPath`, and `buildWithArgv`.
---
