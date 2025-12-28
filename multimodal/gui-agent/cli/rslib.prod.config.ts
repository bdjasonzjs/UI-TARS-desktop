import { defineConfig } from '@rslib/core';

const BANNER = `/**
* Copyright (c) 2025 Bytedance, Inc. and its affiliates.
* SPDX-License-Identifier: Apache-2.0
*/`;

export default defineConfig({
  source: {
    entry: {
      index: ['./src/index.ts'],
    },
  },
  lib: [
    {
      format: 'cjs',
      syntax: 'es2021',
      bundle: true,
      autoExternal: false,
      dts: false,
      banner: { js: '#!/usr/bin/env node\n' + BANNER },
    },
  ],
  output: {
    target: 'node',
    cleanDistPath: true,
    distPath: {
      root: 'dist-prod',
    },
  },
});
