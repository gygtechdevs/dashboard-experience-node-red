import { Suspense } from "react";
import type { Metadata } from "next";
import { UsersSkeleton } from "@/components/users-skeleton";
import { UsersTable } from "@/components/users-table";
import { canManageUsers } from "@/lib/auth/jwt";
import { getSession } from "@/lib/auth/session";
import { GatewayError } from "@/lib/gateway/client";
import { describeUserError } from "@/lib/users/messages";
import { withUsers } from "@/lib/users/server";

export const metadata: Metadata = { title: "Usuarios | Node-RED Dashboard" };

export default function UsersPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          Personas con acceso al dashboard. El nivel de acceso puede ser Lectura, Lectura y escritura o Administrador.
        </p>
      </header>
      {/* Request-time data (cookie + gateway) streams in behind a Suspense boundary. */}
      <Suspense fallback={<UsersSkeleton />}>
        <UsersSection />
      </Suspense>
    </div>
  );
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

async function UsersSection() {
  const session = await getSession();
  if (!session || !canManageUsers(session)) {
    return <Notice title="Acceso restringido" message="Se requiere permiso ADMIN para administrar usuarios." />;
  }

  let users;
  try {
    users = await withUsers((client) => client.listUsers());
  } catch (error) {
    // withUsers redirects on 401 by throwing NEXT_REDIRECT; let anything that is not a gateway error propagate.
    if (!(error instanceof GatewayError)) throw error;
    if (error.kind === "forbidden") {
      return <Notice title="Acceso restringido" message="Se requiere permiso ADMIN para administrar usuarios." />;
    }
    return <Notice title="No se pudieron cargar los usuarios" message={describeUserError(error)} />;
  }

  return <UsersTable users={users} currentUserId={session.userId} />;
}
