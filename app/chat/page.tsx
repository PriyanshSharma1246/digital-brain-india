import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense, lazy } from "react";
import { authOptions } from "@/lib/auth";

const ChatClient = lazy(() => import("@/components/chat/ChatClient"));

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">Loading chat…</div>}>
      <ChatClient
        user={
          session.user as {
            id: string;
            name?: string | null;
            email?: string | null;
          }
        }
      />
    </Suspense>
  );
}
