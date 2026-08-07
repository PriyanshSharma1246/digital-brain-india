import WorkflowRunsDashboard from "@/components/workflow/runs/WorkflowRunsDashboard";

export const dynamic = "force-dynamic";

export default async function WorkflowRunsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkflowRunsDashboard workflowId={id} />;
}
