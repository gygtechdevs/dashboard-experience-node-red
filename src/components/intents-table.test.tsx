// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Intent, Step } from "@/lib/gateway/schemas";

vi.mock("@/app/(dashboard)/knowledge/custom/actions", () => ({
  createIntentAction: vi.fn(),
  updateIntentAction: vi.fn(),
  deleteIntentAction: vi.fn(),
  importIntentsAction: vi.fn(),
}));

import { IntentsTable } from "./intents-table";

const intents: Intent[] = [
  { intent: "order status", initialStep: "/orders", keywords: ["track", "package"], tags: ["Logistics", "support"] },
  { intent: "refund", initialStep: "/refunds", keywords: ["money back"], tags: ["support"] },
  { intent: "greeting", initialStep: "/hello", keywords: ["hi"], tags: [] },
];
const steps: Step[] = [
  { name: "Orders", path: "/orders" },
  { name: "Refunds", path: "/refunds" },
];

function renderTable(props: Partial<{ intents: Intent[]; canWrite: boolean; canDelete: boolean }> = {}) {
  return render(
    <IntentsTable intents={intents} steps={steps} canWrite canDelete {...props} />,
  );
}

describe("IntentsTable", () => {
  it("lists every intent with its keywords", () => {
    renderTable();
    expect(screen.getByText("order status")).toBeInTheDocument();
    expect(screen.getByText("refund")).toBeInTheDocument();
    expect(screen.getByText("track")).toBeInTheDocument();
  });

  it("renders tags as chips in the Tags column", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: /etiquetas/i })).toBeInTheDocument();
    expect(screen.queryByText("Not available yet")).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /order status/ });
    expect(within(row).getByText("Logistics")).toBeInTheDocument();
    expect(within(row).getByText("support")).toBeInTheDocument();
  });

  it("filters rows by tag alongside the search", async () => {
    const user = userEvent.setup();
    renderTable();
    const filter = screen.getByRole("combobox", { name: /filtrar por etiqueta/i });
    expect(within(filter).getAllByRole("option").map((o) => o.textContent)).toEqual(["Todas las etiquetas", "Logistics", "support"]);
    await user.selectOptions(filter, "support");
    expect(screen.getByText("order status")).toBeInTheDocument();
    expect(screen.getByText("refund")).toBeInTheDocument();
    expect(screen.queryByText("greeting")).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: /buscar intenciones/i }), "money");
    expect(screen.queryByText("order status")).not.toBeInTheDocument();
    expect(screen.getByText("refund")).toBeInTheDocument();
  });

  it("hides the tag filter when no intent has tags", () => {
    renderTable({ intents: [{ intent: "x", initialStep: "/x", keywords: ["x"], tags: [] }] });
    expect(screen.queryByRole("combobox", { name: /filtrar por etiqueta/i })).not.toBeInTheDocument();
  });

  it("filters rows by intent name or keyword", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.type(screen.getByRole("searchbox", { name: /buscar intenciones/i }), "money");
    expect(screen.queryByText("order status")).not.toBeInTheDocument();
    expect(screen.getByText("refund")).toBeInTheDocument();
  });

  it("shows a no-results state when the search matches nothing", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.type(screen.getByRole("searchbox", { name: /buscar intenciones/i }), "zzz");
    expect(screen.getByText(/ninguna intención coincide/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no intents", () => {
    renderTable({ intents: [] });
    expect(screen.getByText(/aún no hay intenciones/i)).toBeInTheDocument();
  });

  it("opens the import dialog from the import button and disables it without WRITE", async () => {
    const user = userEvent.setup();
    const { unmount } = renderTable();
    await user.click(screen.getByRole("button", { name: "Importar" }));
    expect(await screen.findByRole("heading", { name: /importar intenciones/i })).toBeInTheDocument();
    unmount();
    renderTable({ canWrite: false });
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("offers write actions to users who can write and delete", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Nueva intención" })).toBeEnabled();
    const row = screen.getByRole("row", { name: /order status/ });
    expect(within(row).getByRole("button", { name: "Editar order status" })).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Eliminar order status" })).toBeEnabled();
  });

  it("disables write actions without WRITE/ADMIN", () => {
    renderTable({ canWrite: false, canDelete: false });
    expect(screen.getByRole("button", { name: "Nueva intención" })).toBeDisabled();
    const row = screen.getByRole("row", { name: /order status/ });
    expect(within(row).getByRole("button", { name: "Editar order status" })).toBeDisabled();
    expect(within(row).getByRole("button", { name: "Eliminar order status" })).toBeDisabled();
  });

  it("disables delete for writers that are not admins", () => {
    renderTable({ canWrite: true, canDelete: false });
    const row = screen.getByRole("row", { name: /order status/ });
    expect(within(row).getByRole("button", { name: "Editar order status" })).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Eliminar order status" })).toBeDisabled();
  });
});
