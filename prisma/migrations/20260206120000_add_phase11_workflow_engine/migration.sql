-- Phase 11: AI Workflow Engine
-- Adds the workflow DAG models: Workflow, WorkflowNode, WorkflowEdge,
-- WorkflowRun, and WorkflowExecutionLog. Plus the `name`, `condition`,
-- `input`, and `output` extensions introduced alongside the engine.

-- CreateTable: Workflow
CREATE TABLE "Workflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Workflow
CREATE INDEX "Workflow_ownerId_idx" ON "Workflow"("ownerId");

-- CreateTable: WorkflowNode
CREATE TABLE "WorkflowNode" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "positionX" INTEGER NOT NULL DEFAULT 0,
    "positionY" INTEGER NOT NULL DEFAULT 0,
    "configuration" JSONB,

    CONSTRAINT "WorkflowNode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowNode_workflowId_idx" ON "WorkflowNode"("workflowId");

ALTER TABLE "WorkflowNode" ADD CONSTRAINT "WorkflowNode_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WorkflowEdge
CREATE TABLE "WorkflowEdge" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "sourceNode" TEXT NOT NULL,
    "targetNode" TEXT NOT NULL,
    "condition" TEXT,

    CONSTRAINT "WorkflowEdge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEdge_workflowId_idx" ON "WorkflowEdge"("workflowId");

ALTER TABLE "WorkflowEdge" ADD CONSTRAINT "WorkflowEdge_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WorkflowRun
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "input" JSONB,
    "output" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "executionTime" INTEGER,
    "error" TEXT,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowRun_workflowId_status_idx" ON "WorkflowRun"("workflowId", "status");

ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: WorkflowExecutionLog
CREATE TABLE "WorkflowExecutionLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "WorkflowExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowExecutionLog_runId_timestamp_idx" ON "WorkflowExecutionLog"("runId", "timestamp");

ALTER TABLE "WorkflowExecutionLog" ADD CONSTRAINT "WorkflowExecutionLog_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;