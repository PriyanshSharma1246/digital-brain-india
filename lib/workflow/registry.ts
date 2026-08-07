/**
 * Phase 11 — Workflow Node Registry.
 *
 * Owns the collection of node handlers keyed by node type. Handlers are
 * registered once at module load and then consumed by the executor. The
 * registry is a plain in-memory map (process-scoped) — handlers are
 * stateless, so this is safe across requests.
 *
 * The real handler implementations live in ./handlers and delegate to the
 * existing AI, RAG, Connector, Tool and Memory infrastructure.
 */
import { NodeHandler } from "./types";
import { logEvent } from "@/lib/logger";
import { registerDefaultHandlers } from "./handlers";

class WorkflowRegistry {
  private handlers: Map<string, NodeHandler> = new Map();

  /** Registers a handler for a node type. Idempotent per type. */
  register(type: string, handler: NodeHandler): void {
    if (this.handlers.has(type)) {
      logEvent("warn", `Overwriting existing handler for node type ${type}`);
    }
    this.handlers.set(type, handler);
  }

  /** Returns the handler for a node type, or undefined when not registered. */
  get(type: string): NodeHandler | undefined {
    return this.handlers.get(type);
  }

  /** Returns true when a handler is registered for the given type. */
  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Returns all registered node type strings. */
  listTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /** Clears all registered handlers (used by tests). */
  clear(): void {
    this.handlers.clear();
  }
}

export const workflowRegistry = new WorkflowRegistry();

// Register all built-in handlers on module load.
registerDefaultHandlers(workflowRegistry);

export default workflowRegistry;

