// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const importIntentsAction = vi.fn();
vi.mock("@/app/(dashboard)/knowledge/custom/actions", () => ({
  importIntentsAction: (rows: unknown) => importIntentsAction(rows),
}));

import { ImportIntentsDialog } from "./import-intents-dialog";

const CSV = [
  "intent,initialStep,keywords,description,tags",
  "refund,/refunds,money back|refund,,billing",
  "bad/name,/x,k,,",
  "order,/orders,track,,",
].join("\n");

function renderDialog() {
  return render(<ImportIntentsDialog open onOpenChange={() => undefined} />);
}

async function upload(user: ReturnType<typeof userEvent.setup>, content: string, name = "intents.csv") {
  const input = screen.getByLabelText(/elija un archivo csv o json/i);
  await user.upload(input, new File([content], name, { type: "text/plain" }));
}

beforeEach(() => {
  importIntentsAction.mockReset();
});

describe("ImportIntentsDialog", () => {
  it("documents the format and offers both templates", () => {
    renderDialog();
    expect(screen.getByText(/se separan con/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar plantilla csv/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /descargar plantilla json/i })).toBeInTheDocument();
  });

  it("shows a preview with per-row errors and the valid/invalid counts", async () => {
    const user = userEvent.setup();
    renderDialog();
    await upload(user, CSV);

    expect(await screen.findByText(/Válidas: 2 · Con errores: 1/)).toBeInTheDocument();
    const badRow = screen.getByRole("row", { name: /fila 2/i });
    expect(within(badRow).getByText(/use solo letras/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importar 2 filas válidas/i })).toBeEnabled();
  });

  it("imports only the valid rows and reports each result", async () => {
    const user = userEvent.setup();
    importIntentsAction.mockResolvedValue({
      ok: true,
      results: [
        { intent: "refund", status: "created" },
        { intent: "order", status: "duplicate", message: "Intent exists" },
      ],
    });
    renderDialog();
    await upload(user, CSV);
    await user.click(await screen.findByRole("button", { name: /importar 2 filas válidas/i }));

    await waitFor(() => expect(screen.getByText(/Creadas: 1 · Duplicadas: 1 · Con error: 0/)).toBeInTheDocument());
    expect(importIntentsAction).toHaveBeenCalledTimes(1);
    const sent = importIntentsAction.mock.calls[0][0] as Array<{ intent: string }>;
    expect(sent.map((r) => r.intent)).toEqual(["refund", "order"]);
    expect(within(screen.getByRole("row", { name: /order/ })).getByText(/duplicada/i)).toBeInTheDocument();
  });

  it("sends valid rows in batches", async () => {
    const user = userEvent.setup();
    importIntentsAction.mockImplementation(async (rows: Array<{ intent: string }>) => ({
      ok: true,
      results: rows.map((r) => ({ intent: r.intent, status: "created" })),
    }));
    const lines = Array.from({ length: 30 }, (_v, i) => `intent${i},/s,k,,`);
    renderDialog();
    await upload(user, ["intent,initialStep,keywords,description,tags", ...lines].join("\n"));
    await user.click(await screen.findByRole("button", { name: /importar 30 filas válidas/i }));

    await waitFor(() => expect(screen.getByText(/Creadas: 30/)).toBeInTheDocument());
    expect(importIntentsAction.mock.calls.map((call) => (call[0] as unknown[]).length)).toEqual([25, 5]);
  });

  it("shows a file-level error and no import button for unusable files", async () => {
    const user = userEvent.setup();
    renderDialog();
    await upload(user, "intent,keywords\na,k");
    expect(await screen.findByRole("alert")).toHaveTextContent(/initialStep/);
    expect(screen.queryByRole("button", { name: /^import \d+/i })).not.toBeInTheDocument();
  });

  it("rejects unsupported file types", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderDialog();
    await upload(user, "x", "intents.txt");
    expect(await screen.findByRole("alert")).toHaveTextContent(/csv o json/i);
  });

  it("surfaces a failed action", async () => {
    const user = userEvent.setup();
    importIntentsAction.mockResolvedValue({ ok: false, message: "No tiene permiso para realizar esta acción." });
    renderDialog();
    await upload(user, CSV);
    await user.click(await screen.findByRole("button", { name: /importar 2 filas válidas/i }));
    expect(await screen.findByText(/no tiene permiso/i)).toBeInTheDocument();
  });
});
