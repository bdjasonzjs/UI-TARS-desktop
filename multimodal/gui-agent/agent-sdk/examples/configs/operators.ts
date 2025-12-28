/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { AdbOperator } from '@ui-tars-test/operator-adb';
import { NutJSOperator } from '@ui-tars-test/operator-nutjs';
import {
  LocalBrowserOperator,
  RemoteBrowserOperator,
  SearchEngine,
} from '@ui-tars-test/operator-browser';

const computerOperator = new NutJSOperator();
const androidOperator = new AdbOperator();
const browserOperator = new LocalBrowserOperator({
  searchEngine: SearchEngine.GOOGLE,
  showActionInfo: false,
  showWaterFlow: false,
  highlightClickableElements: false,
});

const remoteBrowserOperator = new RemoteBrowserOperator({
  wsEndpoint: 'ws://localhost:9222/devtools/browser/<id>',
  searchEngine: SearchEngine.GOOGLE,
  showActionInfo: true,
  showWaterFlow: true,
  highlightClickableElements: true,
});

export { computerOperator, androidOperator, browserOperator, remoteBrowserOperator };
