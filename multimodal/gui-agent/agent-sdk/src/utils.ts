/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseAction } from '@ui-tars-test/shared/types';
import { MultimodalToolCallResult } from '@ui-tars-test/tarko-agent';

export const createGUIErrorResponse = (
  action: BaseAction,
  errorMessage: string,
): MultimodalToolCallResult => {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          action: action,
          error: errorMessage,
        }),
      },
    ],
    // @ts-ignore: isError is not in MultimodalToolCallResult type but might be used by internal logic
    isError: true,
  };
};

export const convertToAgentUIAction = (action: BaseAction) => {
  // Use type assertion or access properties safely as BaseAction might be generic
  // or properties might be on specific action types
  const anyAction = action as any;
  return {
    action: anyAction.prediction,
    thought: anyAction.thought,
    action_type: anyAction.action_type,
    action_input: anyAction.action_input,
  };
};
