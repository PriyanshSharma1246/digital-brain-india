/**
 * Phase 11 - Workflow Node Handlers.
 *
 * Each handler implements the NodeHandler interface defined in ./types and
 * is registered with workflowRegistry in ./registry. Handlers are thin
 * adapters that delegate to the existing infrastructure:
 *
 *   CHAT      -> lib/agents.ts (routeQuery / getAgent), lib/ai/promptBuilder
 *   RAG       -> lib/ai/rag.ts (searchKnowledge / retrieveRelevantChunks)
 *   CONNECTOR -> lib/connectors/registry.ts (getConnector)
 *   LLM       -> @google/genai (direct Gemini call)
 *   MEMORY    -> lib/conversations.ts (listMessages / addMessage)
 *   CONDITION -> inline expression evaluator
 *   END       -> pass-through result collection
 *
 * All handlers are defensive: they must never throw. On error they return
 * { success: false, error: ... } so the executor can continue other branches.
 */
import { GoogleGenAI } from "@google/genai";
import { routeQuery } from "@/lib/aiRouter";
import { getAgent } from "@/lib/agents";
import { searchKnowledge, retrieveRelevantChunks } from "@/lib/ai/rag";
import { buildChatPrompt } from "@/lib/ai/promptBuilder";
import type { ChatPromptInput } from "@/lib/ai/promptBuilder";
import type { RetrievedChunk } from "@/lib/ai/search";
import { searchLiveWeb } from "@/lib/liveIntelligence";
import { getConnector } from "@/lib/connectors/registry";
import { listMessages, addMessage } from "@/lib/conversations";
import { logEvent, logError } from "@/lib/logger";
import type {
  NodeHandler,
  NodeOutput,
  WorkflowContext,
  WorkflowNode,
  ChatNodeConfig,
  RagNodeConfig,
  ConnectorNodeConfig,
  LlmNodeConfig,
  MemoryNodeConfig,
  ConditionNodeConfig,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function getConfig<T>(node: WorkflowNode): T {
  return (node.configuration ?? {}) as unknown as T;
}

function safeString(value: unknown): string {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value ?? "");
}

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    const val = data[key] ?? (data as any)?.output?.[key];
    return val !== undefined ? String(val) : "";
  });
}

function mergeInputs(inputs: Record<string, unknown>[]): Record<string, any> {
  const merged: any = {};
  for (const inp of inputs) {
    if (inp && typeof inp === "object") Object.assign(merged, inp);
  }
  return merged;
}


// ---------------------------------------------------------------------------
// LLM helper - shared by CHAT and LLM handlers
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.7;

function createAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logEvent("warn", "GEMINI_API_KEY not set - LLM handlers will return a fallback response");
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

async function callGemini(
  prompt: string,
  opts: { model?: string; temperature?: number; maxTokens?: number; systemPrompt?: string } = {}
): Promise<{ text: string; tokensUsed?: number }> {
  const ai = createAiClient();
  if (!ai) {
    return { text: "[LLM] Gemini API key not configured. Prompt: " + prompt.slice(0, 200), tokensUsed: 0 };
  }
  const model = opts.model ?? DEFAULT_MODEL;
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts.systemPrompt ? { systemInstruction: opts.systemPrompt } : {}),
    },
  });
  const text = response.text ?? "";
  const tokensUsed = response.usageMetadata?.totalTokenCount ?? undefined;
  return { text, tokensUsed };
}

// ---------------------------------------------------------------------------
// CHAT handler - full agent router with optional RAG and live search
// ---------------------------------------------------------------------------

export const chatHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<ChatNodeConfig>>(node);
    return typeof cfg.prompt === "string" && cfg.prompt.length > 0;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<ChatNodeConfig>(node);
      const merged = mergeInputs(inputs);
      merged.variables = context.variables;

      const userPrompt = interpolate(cfg.prompt, merged);
      const systemPrompt = cfg.systemPrompt ?? getAgent(cfg.agent ?? "general").systemPrompt;
      const temperature = cfg.temperature ?? DEFAULT_TEMPERATURE;
      const maxTokens = cfg.maxTokens ?? DEFAULT_MAX_TOKENS;
      const model = cfg.model ?? DEFAULT_MODEL;

      // Route the query to determine the agent (or use configured agent)
      const agentId = cfg.agent ?? routeQuery(userPrompt).agentId;
      const agent = getAgent(agentId);

      // RAG pass
      let chunks: RetrievedChunk[] = [];
      if (cfg.useRAG) {
        try {
          chunks = await retrieveRelevantChunks(userPrompt, { topK: 5 });
          logEvent("info", "RAG chunks retrieved for CHAT node", { nodeId: node.id, count: chunks.length });
        } catch (e) {
          logError("RAG search failed in CHAT handler", { error: e instanceof Error ? e.message : String(e), nodeId: node.id });
        }
      }

      // Live search pass
      let liveContext = "";
      if (cfg.useLiveSearch) {
        try {
          const liveInfo = await searchLiveWeb(userPrompt);
          liveContext = liveInfo.context;
        } catch (e) {
          logError("Live search failed in CHAT handler", { error: e instanceof Error ? e.message : String(e), nodeId: node.id });
        }
      }

      // Build the prompt
      const promptInput: ChatPromptInput = {
        agent,
        message: userPrompt,
        retrievedChunks: chunks,
        liveContext,
        fileContext: "",
      };
      const built = buildChatPrompt(promptInput);

      // Call Gemini
      let response: string;
      let tokensUsed = 0;
      try {
        const result = await callGemini(built.prompt, { systemPrompt, temperature, maxTokens, model });
        response = result.text;
        tokensUsed = result.tokensUsed ?? 0;
      } catch (e) {
        logEvent("warn", "Gemini call failed, using fallback", { nodeId: node.id, error: e instanceof Error ? e.message : String(e) });
        response = "[LLM error] Could not reach the Gemini API. Your query was: " + userPrompt.slice(0, 200);
      }

      logEvent("info", "CHAT handler completed", { nodeId: node.id, tokensUsed });
      return {
        nodeId: node.id,
        success: true,
        output: { result: response, tokensUsed, ragChunks: chunks.length, agentId },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("CHAT handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};


// ---------------------------------------------------------------------------
// RAG handler - knowledge base retrieval
// ---------------------------------------------------------------------------

export const ragHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<RagNodeConfig>>(node);
    return typeof cfg.query === "string" && cfg.query.length > 0;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<RagNodeConfig>(node);
      const merged = mergeInputs(inputs);
      merged.variables = context.variables;

      const query = interpolate(cfg.query, merged);

      const searchResult = await searchKnowledge(query, { topK: cfg.topK ?? 5 });

      const hits = searchResult.chunks.map((c) => ({
        content: c.content,
        chunkIndex: c.chunkIndex,
        documentTitle: c.documentTitle,
        category: c.category,
        source: c.source,
        score: c.score,
        sourceUrl: c.sourceUrl,
        headingPath: c.headingPath,
      }));

      logEvent("info", "RAG handler completed", { nodeId: node.id, hitCount: hits.length });
      return {
        nodeId: node.id,
        success: true,
        output: { result: hits, hitCount: hits.length, query },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("RAG handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};

// ---------------------------------------------------------------------------
// CONNECTOR handler - government data connector lookup
// ---------------------------------------------------------------------------

export const connectorHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<ConnectorNodeConfig>>(node);
    return typeof cfg.connector === "string" && cfg.connector.length > 0;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<ConnectorNodeConfig>(node);
      const merged = mergeInputs(inputs);
      merged.variables = context.variables;

      const connector = getConnector(cfg.connector);
      if (!connector) {
        const msg = `Connector "${cfg.connector}" not found`;
        logError("CONNECTOR handler", { error: msg, nodeId: node.id });
        return { nodeId: node.id, success: false, error: msg };
      }

      const query = interpolate(cfg.query ?? "", merged);
      const searchParams = cfg.params ? Object.fromEntries(
        Object.entries(cfg.params).map(([k, v]) => [k, typeof v === "string" ? interpolate(v, merged) : v])
      ) : {};
      const finalQuery = query || (searchParams.query as string) || "";

      const result = await connector.search(finalQuery);

      logEvent("info", "CONNECTOR handler completed", { nodeId: node.id, connector: cfg.connector });
      return { nodeId: node.id, success: true, output: { result, connector: cfg.connector, items: result.items } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("CONNECTOR handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};


// ---------------------------------------------------------------------------
// LLM handler - direct LLM call without agent routing
// ---------------------------------------------------------------------------

export const llmHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<LlmNodeConfig>>(node);
    return typeof cfg.prompt === "string" && cfg.prompt.length > 0;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<LlmNodeConfig>(node);
      const merged = mergeInputs(inputs);
      merged.variables = context.variables;

      const prompt = interpolate(cfg.prompt, merged);
      const systemPrompt = cfg.systemPrompt ?? "You are a helpful assistant.";
      const { text, tokensUsed } = await callGemini(prompt, {
        model: cfg.model ?? DEFAULT_MODEL,
        temperature: cfg.temperature ?? DEFAULT_TEMPERATURE,
        maxTokens: cfg.maxTokens ?? DEFAULT_MAX_TOKENS,
        systemPrompt,
      });

      logEvent("info", "LLM handler completed", { nodeId: node.id, tokensUsed });
      return { nodeId: node.id, success: true, output: { result: text, tokensUsed } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("LLM handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};


// ---------------------------------------------------------------------------
// MEMORY handler - read/write conversation history
// ---------------------------------------------------------------------------

export const memoryHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<MemoryNodeConfig>>(node);
    return cfg.action === "read" || cfg.action === "write";
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<MemoryNodeConfig>(node);
      const merged = mergeInputs(inputs);
      merged.variables = context.variables;

      const conversationId = cfg.conversationId
        ?? context.variables.conversationId
        ?? context.runId;

      if (cfg.action === "read") {
        const limit = cfg.limit ?? 20;
        const messagePage = await listMessages(context.userId ?? "system", String(conversationId), {
          page: 1,
          pageSize: limit,
        });

        const messages = messagePage?.messages ?? [];
        logEvent("info", "MEMORY handler read messages", { nodeId: node.id, count: messages.length });
        return { nodeId: node.id, success: true, output: { result: messages, messageCount: messages.length } };
      }

      // action === "write"
      const textToWrite = cfg.text
        ? interpolate(cfg.text, merged)
        : safeString(merged.result ?? merged.output);

      const saved = await addMessage(context.userId ?? "system", String(conversationId), "assistant", textToWrite);
      logEvent("info", "MEMORY handler wrote message", { nodeId: node.id });
      return { nodeId: node.id, success: true, output: { result: saved, saved: !!saved } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("MEMORY handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};


// ---------------------------------------------------------------------------
// CONDITION handler - evaluates a simple comparison expression
// Format: ${field} <operator> <value>
// Operators: >, <, >=, <=, ==, !=
// ---------------------------------------------------------------------------

function evaluateCondition(expression: string, inputs: Record<string, unknown>[]): boolean {
  const match = expression.match(/\$\{(\w+)\}\s*(>=|<=|==|!=|>|<)\s*(.+)/);
  if (!match) {
    logError("Invalid condition expression", { expression });
    return false;
  }

  const [, field, op, rawValue] = match;
  const data = inputs[0] ?? {};
  const actualValue = (data as any)?.[field] ?? (data as any)?.output?.[field];

  let expected: unknown;
  const trimmedRaw = rawValue.trim();
  if (trimmedRaw.startsWith("'") && trimmedRaw.endsWith("'")) {
    expected = trimmedRaw.slice(1, -1);
  } else if (trimmedRaw.startsWith('"') && trimmedRaw.endsWith('"')) {
    expected = trimmedRaw.slice(1, -1);
  } else if (trimmedRaw === "true") {
    expected = true;
  } else if (trimmedRaw === "false") {
    expected = false;
  } else if (!isNaN(Number(trimmedRaw))) {
    expected = Number(trimmedRaw);
  } else {
    expected = trimmedRaw;
  }

  switch (op) {
    case ">": return Number(actualValue) > Number(expected);
    case "<": return Number(actualValue) < Number(expected);
    case ">=": return Number(actualValue) >= Number(expected);
    case "<=": return Number(actualValue) <= Number(expected);
    case "==": return String(actualValue) === String(expected);
    case "!=": return String(actualValue) !== String(expected);
    default: return false;
  }
}

export const conditionHandler: NodeHandler = {
  validate(node: WorkflowNode): boolean {
    const cfg = getConfig<Partial<ConditionNodeConfig>>(node);
    return typeof cfg.expression === "string" && cfg.expression.length > 0;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<ConditionNodeConfig>(node);
      const expression = cfg.expression ?? "";

      if (!expression) {
        return { nodeId: node.id, success: false, error: "CONDITION node requires an 'expression' in configuration." };
      }

      const result = evaluateCondition(expression, inputs);
      logEvent("info", "CONDITION handler evaluated", { expression, result });

      return { nodeId: node.id, success: true, output: { result, expression } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("CONDITION handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};


// ---------------------------------------------------------------------------
// END handler - collects and finalizes workflow output
// ---------------------------------------------------------------------------

export const endHandler: NodeHandler = {
  validate(): boolean {
    return true;
  },

  async execute(context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]): Promise<NodeOutput> {
    try {
      const cfg = getConfig<{ resultKey?: string; template?: string }>(node);
      const merged = Object.assign({}, ...inputs);

      let output: unknown;
      if (cfg.template) {
        output = interpolate(cfg.template, merged);
      } else if ((merged as any).result !== undefined) {
        output = (merged as any).result;
      } else if ((merged as any).output !== undefined) {
        output = (merged as any).output;
      } else if (inputs.length > 0) {
        output = inputs[inputs.length - 1];
      } else {
        output = "Workflow completed.";
      }

      logEvent("info", "END handler finalized output");

      return {
        nodeId: node.id,
        success: true,
        output: { result: output, resultKey: cfg.resultKey ?? "output" },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError("END handler failed", { error: message, nodeId: node.id });
      return { nodeId: node.id, success: false, error: message };
    }
  },
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDefaultHandlers(registry: {
  register: (type: string, handler: NodeHandler) => void;
}): void {
  registry.register("CHAT", chatHandler);
  registry.register("RAG", ragHandler);
  registry.register("CONNECTOR", connectorHandler);
  registry.register("LLM", llmHandler);
  registry.register("MEMORY", memoryHandler);
  registry.register("CONDITION", conditionHandler);
  registry.register("END", endHandler);
}


// ---------------------------------------------------------------------------
// END handler - collects and finalizes workflow output
// ---------------------------------------------------------------------------