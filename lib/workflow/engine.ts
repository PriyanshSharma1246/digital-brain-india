import { prisma } from "@/lib/prisma";
import { validateWorkflow } from "./validator";
import { executeWorkflowDefinition } from "./executor";
import { WorkflowDefinition } from "./types";
import { logEvent, logError } from "@/lib/logger";

/** Loads a workflow definition (with nodes + edges) from the database. */
export async function loadWorkflowById(id: string) {
  const wf = await prisma.workflow.findUnique({
    where: { id },
    include: { nodes: true, edges: true },
  });
  if (!wf) return null;
  const def: WorkflowDefinition = {
    id: wf.id,
    name: wf.name,
    description: wf.description ?? undefined,
    ownerId: wf.ownerId,
    status: wf.status,
    nodes: wf.nodes.map((n) => ({
      id: n.id,
      workflowId: n.workflowId,
      name: n.name ?? null,
      type: n.type,
      positionX: n.positionX ?? 0,
      positionY: n.positionY ?? 0,
      configuration: (n.configuration as Record<string, unknown> | null) ?? null,
    })),
    edges: wf.edges.map((e) => ({
      id: e.id,
      workflowId: e.workflowId,
      sourceNode: e.sourceNode,
      targetNode: e.targetNode,
      condition: e.condition ?? null,
    })),
  };
  return def;
}

/**
 * Validates and executes a workflow by id.
 *
 * @param workflowId  The workflow to execute.
 * @param userId      The authenticated user (used by handlers that need session context).
 * @param input       Optional JSON input variables injected into the workflow context.
 */
export async function executeWorkflow(
  workflowId: string,
  userId?: string,
  input?: Record<string, unknown>
) {
  const def = await loadWorkflowById(workflowId);
  if (!def) {
    throw new Error("Workflow not found");
  }

  const validation = validateWorkflow(def);
  if (validation.length > 0) {
    // Store a failed run with validation errors.
    const run = await prisma.workflowRun.create({
      data: {
        workflowId,
        status: "failed",
        startedAt: new Date(),
        finishedAt: new Date(),
        input: input == null ? undefined : JSON.parse(JSON.stringify(input)),
        error: JSON.stringify(validation.map((v) => v.message)),
      },
    });

    for (const v of validation) {
      await prisma.workflowExecutionLog.create({
        data: { runId: run.id, level: "error", message: v.message, timestamp: new Date() },
      });
    }

    logError("Workflow validation failed", { workflowId, errors: validation });
    return { runId: run.id, success: false, errors: validation };
  }

  // Create a run record.
  const run = await prisma.workflowRun.create({
    data: {
      workflowId,
      status: "running",
      startedAt: new Date(),
      input: input == null ? undefined : JSON.parse(JSON.stringify(input)),
    },
  });
  const context = { runId: run.id, workflowId, userId, variables: input ?? {} };

  try {
    const result = await executeWorkflowDefinition(def, context);

    // Persist logs.
    for (const l of result.logs) {
      await prisma.workflowExecutionLog.create({
        data: {
          runId: run.id,
          level: l.level,
          message: l.message,
          metadata: l.metadata == null ? undefined : JSON.parse(JSON.stringify(l.metadata)),
          timestamp: new Date(),
        },
      });
    }

    // Determine the final output from END node(s) or best-effort aggregation.
    let finalOutput: Record<string, unknown> | null = null;
    for (const output of result.outputs) {
      if (output.success && output.output) {
        const out = output.output as Record<string, unknown>;
        if (out.resultKey === "output" && out.result !== undefined) {
          finalOutput = { result: out.result };
          break;
        }
        if (!finalOutput) finalOutput = out;
      }
    }

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: {
        status: "completed",
        finishedAt: new Date(),
        input: input == null ? undefined : JSON.parse(JSON.stringify(input)),
        output: finalOutput == null ? undefined : JSON.parse(JSON.stringify(finalOutput)),
        tokensUsed: result.tokensUsed ?? 0,
        executionTime: result.executionTimeMs,
      },
    });

    logEvent("info", "Workflow run completed", { workflowId, runId: run.id });
    return { runId: run.id, success: true, outputs: result.outputs, output: finalOutput };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("Workflow execution failed", { workflowId, error: message });
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), error: message },
    });
    await prisma.workflowExecutionLog.create({
      data: { runId: run.id, level: "error", message: message, timestamp: new Date() },
    });
    return { runId: run.id, success: false, error: message };
  }
}

/** Lists all runs for a workflow, newest first. */
export async function listWorkflowRuns(workflowId: string) {
  const runs = await prisma.workflowRun.findMany({
    where: { workflowId },
    orderBy: { startedAt: "desc" },
    include: { logs: true },
  });
  return runs;
}

/** Returns a single run with its execution logs, or null. */
export async function getWorkflowRun(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: {
      workflow: { select: { id: true, name: true } },
      logs: { orderBy: { timestamp: "asc" } },
    },
  });
  return run;
}
