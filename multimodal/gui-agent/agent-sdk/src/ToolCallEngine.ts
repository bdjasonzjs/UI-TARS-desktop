import {
  ToolCallEngine,
  Tool,
  ToolCallEnginePrepareRequestContext,
  ChatCompletionCreateParams,
  ChatCompletionAssistantMessageParam,
  ChatCompletionChunk,
  MultimodalToolCallResult,
  AgentEventStream,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ParsedModelResponse,
  StreamProcessingState,
  StreamChunkResult,
} from '@ui-tars-test/tarko-agent-interface';
import { DefaultActionParser } from '@ui-tars-test/action-parser';
import { GUI_ADAPTED_TOOL_NAME } from './constants';
import { ConsoleLogger, LogLevel } from '@agent-infra/logger';
import { serializeAction } from '@ui-tars-test/shared/utils';
import { CustomActionParser } from '@ui-tars-test/shared/types';

const defaultParser = new DefaultActionParser();
const defaultLogger = new ConsoleLogger('[GUIAgent:ToolCallEngine]', LogLevel.DEBUG);

/**
 * GUIAgentToolCallEngine - Minimal prompt engineering tool call engine
 *
 * This is the simplest possible implementation of a tool call engine that:
 * 1. Uses prompt engineering to instruct the LLM to output tool calls in a specific format
 * 2. Parses tool calls from LLM response text using simple regex matching
 * 3. Does not support streaming (focuses on core functionality only)
 *
 * Format used: <tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
 */
export class GUIAgentToolCallEngine extends ToolCallEngine {
  private customActionParser?: CustomActionParser;

  constructor(customActionParser?: CustomActionParser) {
    super();
    this.customActionParser = customActionParser;
  }

  /**
   * Prepare system prompt with tool information and instructions
   */
  preparePrompt(instructions: string, tools: Tool[]): string {
    return instructions;
  }

  /**
   * Prepare request parameters for the LLM
   *
   * FIXME: move to base tool call engine.
   */
  prepareRequest(context: ToolCallEnginePrepareRequestContext): ChatCompletionCreateParams {
    defaultLogger.log(
      "【New Sys Prompt'】 System Prompt:",
      JSON.stringify(context.messages.find((m) => m.role === 'system')?.content || ''),
    );
    return {
      model: context.model,
      messages: context.messages,
      temperature: context.temperature || 0.7,
      stream: true,
      // When tools are undefined (disabled), tool_choice MUST also be undefined
      // Otherwise OpenAI/Azure will return 400 Bad Request
      tool_choice: undefined,
      tools: undefined,
    };
  }

  /**
   * Initialize processing state (minimal implementation)
   *
   * FIXME: move to base tool call engine.
   */
  initStreamProcessingState(): StreamProcessingState {
    return {
      contentBuffer: '',
      toolCalls: [],
      reasoningBuffer: '',
      finishReason: null,
    };
  }

  /**
   * Process streaming chunks - simply accumulate content
   *
   * FIXME: make it optional
   */
  processStreamingChunk(
    chunk: ChatCompletionChunk,
    state: StreamProcessingState,
  ): StreamChunkResult {
    // For non-streaming requests, the entire response comes in one chunk
    const delta = chunk.choices[0]?.delta;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (chunk.choices[0] as any)?.message;

    // Accumulate content from delta (streaming) or message (non-streaming)
    const content = delta?.content || message?.content || '';
    if (content) {
      state.contentBuffer += content;
    }

    // Record finish reason
    if (chunk.choices[0]?.finish_reason) {
      state.finishReason = chunk.choices[0].finish_reason;
    }

    // Return incremental content without tool call detection during streaming
    return {
      content: content,
      reasoningContent: '',
      hasToolCallUpdate: false,
      toolCalls: [],
    };
  }

  /**
   * Generate a tool call ID
   */
  private generateToolCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Extract tool calls from complete response text
   */
  finalizeStreamProcessing(state: StreamProcessingState): ParsedModelResponse {
    const fullContent = state.contentBuffer;
    console.log('[DEBUG] Full content length:', fullContent.length);
    console.log('[DEBUG] Full content prefix:', fullContent.slice(0, 100));
    console.log('[DEBUG] Full content suffix:', fullContent.slice(-100));
    defaultLogger.log("【New Sys Prompt'】 Model Response:", fullContent);
    defaultLogger.log('[finalizeStreamProcessing] fullContent', fullContent);

    // Add explicit log to confirm XML parsing intent
    console.log('[CLI DEBUG] [ToolCallEngine] Full model response received:', fullContent);

    // Try custom action parser first if available
    let parsedGUIResponse = null;
    if (this.customActionParser) {
      parsedGUIResponse = this.customActionParser(fullContent);
      defaultLogger.log('[finalizeStreamProcessing] Using custom action parser');
      console.log('[CLI DEBUG] [ToolCallEngine] Using custom action parser');
    }

    // Priority: Custom Regex Parser > Default Parser
    // Check if the content contains the specific XML format with dynamic suffixes
    if (/<seed:tool_call_never_used_/.test(fullContent)) {
      console.log(
        '[CLI DEBUG] [ToolCallEngine] Detected custom XML format. Attempting custom regex parser.',
      );
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actions: any[] = [];
        // Regex to match <function_...=name>...</function...>
        // Handles dynamic suffixes like _never_used_...
        const functionRegex = /<function_[^=>]*=([a-zA-Z0-9_]+)>([\s\S]*?)<\/function_[^>]*>/g;
        let match;

        while ((match = functionRegex.exec(fullContent)) !== null) {
          const actionName = match[1];
          const innerContent = match[2];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const args: any = {};

          // Regex to match <parameter_...=key>value</parameter...>
          const paramRegex = /<parameter_[^=>]*=([a-zA-Z0-9_]+)>([\s\S]*?)<\/parameter_[^>]*>/g;
          let paramMatch;
          while ((paramMatch = paramRegex.exec(innerContent)) !== null) {
            const key = paramMatch[1];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let value: any = paramMatch[2].trim();

            // Special handling for coordinate parameters (point, start_point, end_point)
            // Convert string "x y" to { raw: { x, y } } object structure expected by Operators
            if (
              ['point', 'start_point', 'end_point', 'start', 'end'].includes(key) &&
              typeof value === 'string'
            ) {
              // Remove potential wrapping tags like <point>...</point>
              value = value.replace(/^<[^>]+>([\s\S]*?)<\/[^>]+>$/, '$1').trim();

              // Match coordinates pattern: digits followed by comma or space followed by digits
              // Supports: "100 200", "100, 200", "(100, 200)"
              const coordsMatch = value.match(/(\d+)[, ]+(\d+)/);
              if (coordsMatch) {
                const x = parseInt(coordsMatch[1], 10);
                const y = parseInt(coordsMatch[2], 10);
                value = { raw: { x, y } };
              }
            }

            args[key] = value;
          }

          actions.push({
            type: actionName,
            inputs: args,
            thought: '',
          });
        }

        // Also try to extract thought from <think_...>...</think_...>
        const thoughtRegex = /<think_[^>]*>([\s\S]*?)<\/think_[^>]*>/g;
        const thoughtMatch = thoughtRegex.exec(fullContent);
        const thoughtContent = thoughtMatch ? thoughtMatch[1].trim() : '';

        if (actions.length > 0) {
          console.log(
            `[CLI DEBUG] [ToolCallEngine] Custom regex parser found ${actions.length} actions.`,
          );
          parsedGUIResponse = {
            errorMessage: '',
            rawContent: fullContent,
            actions: actions,
            reasoningContent: thoughtContent,
          };
        }
      } catch (e) {
        console.error('[CLI DEBUG] [ToolCallEngine] Custom regex parser error:', e);
      }
    }

    // Fall back to default parser if regex parser didn't produce results
    if (!parsedGUIResponse) {
      console.log('[CLI DEBUG] [ToolCallEngine] Using default action parser (XML parser)');
      parsedGUIResponse = defaultParser.parsePrediction(fullContent);
      defaultLogger.log('[finalizeStreamProcessing] Using default action parser');
    }

    if (parsedGUIResponse) {
      console.log(
        '[CLI DEBUG] [ToolCallEngine] Parsed response:',
        JSON.stringify(parsedGUIResponse, null, 2),
      );
    } else {
      console.log('[CLI DEBUG] [ToolCallEngine] Parsing failed or returned null');
    }

    if (!parsedGUIResponse || parsedGUIResponse.errorMessage) {
      return {
        content: '',
        rawContent: fullContent,
        toolCalls: [
          {
            id: this.generateToolCallId(),
            type: 'function',
            function: {
              name: GUI_ADAPTED_TOOL_NAME,
              arguments: JSON.stringify({
                action: '',
                step: '',
                thought: '',
                operator_action: null,
                errorMessage:
                  parsedGUIResponse?.errorMessage ?? 'Failed to parse GUI Action from output',
              }),
            },
          },
        ],
        finishReason: 'tool_calls',
      };
    }

    const toolCalls: ChatCompletionMessageToolCall[] = [];

    let finished = false;
    let finishMessage: string | null = null;
    for (const action of parsedGUIResponse.actions) {
      if (action.type === 'finished') {
        finished = true;
        finishMessage = action.inputs?.content ?? null;
        continue;
      }
      toolCalls.push({
        id: this.generateToolCallId(),
        type: 'function',
        function: {
          name: GUI_ADAPTED_TOOL_NAME,
          arguments: JSON.stringify({
            action: serializeAction(action),
            step: '',
            thought: parsedGUIResponse.reasoningContent ?? '',
            operator_action: action,
          }),
        },
      });
    }

    const content = finishMessage ?? '';
    const reasoningContent = parsedGUIResponse.reasoningContent ?? '';
    const contentForWebUI = content.replace(/\\n|\n/g, '<br>');
    const reasoningContentForWebUI = reasoningContent.replace(/\\n|\n/g, '<br>');

    // No tool calls found - return regular response
    return {
      content: contentForWebUI,
      rawContent: fullContent,
      reasoningContent: reasoningContentForWebUI,
      toolCalls,
      finishReason: toolCalls.length > 0 && !finished ? 'tool_calls' : 'stop',
    };
  }

  /**
   * Build assistant message for conversation history
   * For PE engines, we preserve the raw content including tool call markup
   *
   * FIXME: move to base tool call engine.
   */
  buildHistoricalAssistantMessage(
    currentLoopAssistantEvent: AgentEventStream.AssistantMessageEvent,
  ): ChatCompletionAssistantMessageParam {
    return {
      role: 'assistant',
      content: currentLoopAssistantEvent.rawContent || currentLoopAssistantEvent.content,
    };
  }

  /**
   * Build tool result messages as user messages
   * PE engines format tool results as user input for next iteration
   *
   * FIXME: move to base tool call engine.
   */
  buildHistoricalToolCallResultMessages(
    toolCallResults: MultimodalToolCallResult[],
  ): ChatCompletionMessageParam[] {
    return toolCallResults.map((result) => {
      // Extract text content from multimodal result
      const textContent = result.content
        .filter((part) => part.type === 'text')
        .map((part) => (part as { text: string }).text)
        .join('');

      return {
        role: 'user',
        content: `Tool "${result.toolName}" result:\n${textContent}`,
      };
    });
  }
}
