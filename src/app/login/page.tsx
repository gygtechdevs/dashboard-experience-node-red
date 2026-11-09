import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión | Node-RED Dashboard" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-lg">
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Utilice su cuenta de la plataforma Node-RED.</p>
        <LoginForm />
      </div>
    </main>
  );
}
