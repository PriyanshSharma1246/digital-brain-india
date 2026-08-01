import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import KnowledgeManager from "@/components/knowledge/KnowledgeManager";

export default async function KnowledgePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <KnowledgeManager user={session.user} />;
}
