/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenJS } from '@tarko/llm-client';
import { OpenAI } from 'openai';
import { LLMRequest, AgentModel } from './types';
import type { ChatCompletionCreateParamsBase } from './third-party';

// Providers that should not be added to extended model list
const NATIVE_PROVIDERS = new Set(['openrouter', 'openai-compatible', 'azure-openai']);

export type LLMRequestInterceptor = (
  provider: string,
  request: LLMRequest,
  baseURL?: string,
) => ChatCompletionCreateParamsBase;

/**
 * Create LLM Client based on current model configuration
 *
 * @param agentModel Resolved model configuration
 * @param requestInterceptor Optional request interceptor for modifying requests
 * @returns OpenAI-compatible client
 */
export function createLLMClient(
  agentModel: AgentModel,
  requestInterceptor?: LLMRequestInterceptor,
): OpenAI {
  const { provider, id, baseProvider, baseURL, apiKey, headers, params, azure } = agentModel;

  const client = new TokenJS({
    apiKey,
    baseURL,
    defaultHeaders: headers,
    azure,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch: ((url: any, init: any) => {
      // If using Azure OpenAI and a custom endpoint is provided in the 'azure' config,
      // force override the URL to that endpoint.
      // This is necessary because the standard OpenAI SDK forces specific URL patterns
      // (like /openai/deployments/...) which may not match custom gateways.
      if (
        (provider === 'azure-openai' || baseProvider === 'azure-openai') &&
        azure?.endpoint &&
        !azure.endpoint.includes('openai.azure.com')
      ) {
        // Construct new URL object from the provided endpoint
        const newUrlObj = new URL(azure.endpoint);

        try {
          // Parse the original URL to extract query parameters (like api-version)
          const originalUrlObj = new URL(url);

          // Copy all search parameters from original URL to new URL
          // This ensures parameters like 'api-version' are preserved
          originalUrlObj.searchParams.forEach((value, key) => {
            newUrlObj.searchParams.append(key, value);
          });
        } catch (e) {
          // If original url is not valid, just ignore query params copy
          console.warn('[LLMClient] Failed to parse original URL query params', e);
        }

        const finalUrl = newUrlObj.toString();
        // console.log('[DEBUG] Intercepted Azure request. New URL:', finalUrl);
        return fetch(finalUrl, init);
      }
      return fetch(url, init);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  });

  // Add extended model support for non-native providers
  if (baseProvider && !NATIVE_PROVIDERS.has(baseProvider)) {
    // Safely extend model list with type assertion
    const extendableClient = client as unknown as {
      extendModelList: (
        provider: string,
        model: string,
        capabilities: Record<string, boolean>,
      ) => void;
    };

    if (typeof extendableClient.extendModelList === 'function') {
      extendableClient.extendModelList(baseProvider, id, {
        streaming: true,
        json: true,
        toolCalls: true,
        images: true,
      });
    }
  }

  // Create OpenAI-compatible interface
  return {
    chat: {
      completions: {
        async create(requestParams: ChatCompletionCreateParamsBase) {
          const requestPayload = {
            ...requestParams,
            provider,
            model: id,
            // Merge experimental params directly into request body
            ...params,
          };

          const finalRequest = requestInterceptor
            ? requestInterceptor(provider, requestPayload, baseURL)
            : requestPayload;

          return client.chat.completions.create({
            ...finalRequest,
            provider: baseProvider || 'openai',
          });
        },
      },
    },
  } as unknown as OpenAI;
}
