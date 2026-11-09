import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SESSION_EXPIRED_PATH } from "@/lib/auth/constants";
import { getSession } from "@/lib/auth/session";
import { logoutAction } from "../login/actions";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect(SESSION_EXPIRED_PATH);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppSidebar email={session.email} logout={logoutAction} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
