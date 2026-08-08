---
layout: home
title: 'xBuild'
titleTemplate: 'A versatile JavaScript and TypeScript toolchain build system'
hero:
  name: 'xBuild'
  text: 'Build, type-check, and serve TypeScript projects'
  tagline: xBuild is a fast, esbuild-powered toolchain with variant builds, lifecycle hooks, and compile-time macros.
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
    details: Define multiple build targets in one config and run selected variants with `--build`.
  - title: TypeScript tooling
    icon: 🧠
    details: Enable type checks and `.d.ts` generation with `types` and `declaration` options.
  - title: Lifecycle hooks
    icon: 🪝
    details: Extend the build process using `onStart`, `onResolve`, `onLoad`, `onEnd`, and `onSuccess`.
  - title: Compile-time macros
    icon: ⚡
    details: Use `$$ifdef`, `$$ifndef`, and `$$inline` for conditional code and build-time evaluation.
  - title: Dev workflow
    icon: 🔁
    details: Use `--watch` and `--serve` for fast local iteration.
  - title: Esbuild-compatible config
    icon: ⚙️
    details: Reuse familiar esbuild options while adding xBuild features on top.
---
