// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BulkReviewResult, ImpactSimulation, UnmatchedClusters } from "@/lib/gateway/schemas";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/app/(dashboard)/training/review/actions", () => ({
  simulateImpactAction: vi.fn(),
  bulkApproveUnmatchedAction: vi.fn(),
  bulkRejectUnmatchedAction: vi.fn(),
}));

// The real dialog needs the steps catalog and server actions; only the wiring is under test here.
const dialog = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock("@/components/intent-form-dialog", () => ({
  IntentFormDialog: (props: { open: boolean } & Record<string, unknown>) => {
    dialog.props = props;
    return props.open ? <div role="dialog" aria-label="New intent dialog" /> : null;
  },
}));

import {
  bulkApproveUnmatchedAction,
  bulkRejectUnmatchedAction,
  simulateImpactAction,
} from "@/app/(dashboard)/training/review/actions";
import { ReviewClusters } from "./review-clusters";

const simulate = vi.mocked(simulateImpactAction);
const bulkApprove = vi.mocked(bulkApproveUnmatchedAction);
const bulkReject = vi.mocked(bulkRejectUnmatchedAction);

const data: UnmatchedClusters = {
  method: "semantic",
  analyzed: 3,
  truncated: false,
  clusters: [
    {
      id: "c1",
      representativeText: "i want to reset my password",
      size: 7,
      memberIds: ["a", "b"],
      members: [
        { id: "a", maskedText: "i want to reset my password", occurrences: 5 },
        { id: "b", maskedText: "forgot my login secret", occurrences: 2 },
      ],
      nearestIntent: { intent: "password", similarity: 0.912 },
      firstSeenAt: "2026-03-01T08:00:00.000Z",
      lastSeenAt: "2026-03-09T18:30:00.000Z",
    },
    {
      id: "c2",
      representativeText: "my card was stolen",
      size: 3,
      memberIds: ["c"],
      members: [{ id: "c", maskedText: "my card was stolen", occurrences: 3 }],
      nearestIntent: null,
      firstSeenAt: "2026-03-02T08:00:00.000Z",
      lastSeenAt: "2026-03-03T08:00:00.000Z",
    },
  ],
};

const impact: ImpactSimulation = {
  intent: "password",
  days: 30,
  selected: 2,
  scope: {
    exact: false,
    basis: "pending-messages-and-stored-examples",
    replayedMessages: 12,
    replayTruncated: false,
    examplesChecked: 40,
    examplesTruncated: false,
    minSimilarity: 0.8,
    ambiguityMargin: 0.05,
  },
  newlyMatched: {
    count: 4,
    selected: 2,
    others: 2,
    occurrences: 9,
    samples: [{ id: "x", maskedText: "cant login", similarity: 0.97, occurrences: 3, selected: false }],
  },
  ambiguous: 1,
  regressions: {
    count: 1,
    samples: [{ maskedText: "invoice question", from: "billing", similarity: 0.9, source: "keyword" }],
  },
};

const bulk = (overrides: Partial<BulkReviewResult> = {}): { ok: true; data: BulkReviewResult } => ({
  ok: true,
  data: { intent: "password", succeeded: 2, failed: 0, results: [], ...overrides },
});

function renderClusters(props: Partial<React.ComponentProps<typeof ReviewClusters>> = {}) {
  return render(
    <ReviewClusters
      data={data}
      intents={["password", "card"]}
      steps={[]}
      tagSuggestions={[]}
      {...props}
    />,
  );
}

const card = (name: RegExp) => screen.getByRole("article", { name });

beforeEach(() => {
  vi.clearAllMocks();
  dialog.props = null;
});

describe("ReviewClusters: listing", () => {
  it("shows the clusters tab as current and one card per cluster with size and nearest intent", () => {
    renderClusters();
    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("aria-current", "page");
    const first = card(/reset my password/);
    expect(within(first).getByText("7 mensajes")).toBeInTheDocument();
    expect(within(first).getByText(/intención más cercana/i)).toHaveTextContent("password");
    expect(within(first).getByText(/91% de similitud/)).toBeInTheDocument();
    expect(within(first).getByText(/2026-03-01 08:00 UTC/)).toBeInTheDocument();
    expect(within(first).getByText(/2026-03-09 18:30 UTC/)).toBeInTheDocument();
    expect(within(card(/card was stolen/)).getByText(/aún no hay una intención similar/i)).toBeInTheDocument();
  });

  it("keeps the order received (largest first)", () => {
    renderClusters();
    const names = screen.getAllByRole("article").map((a) => a.getAttribute("aria-labelledby"));
    expect(names).toEqual(["cluster-c1-title", "cluster-c2-title"]);
  });

  it("explains the grouping method", () => {
    renderClusters();
    expect(screen.getByText(/agrupados por significado/i)).toBeInTheDocument();
  });

  it("labels the lexical fallback and its weaker precision", () => {
    renderClusters({ data: { ...data, method: "lexical" } });
    expect(screen.getByText(/agrupados por palabras compartidas/i)).toBeInTheDocument();
    expect(within(card(/reset my password/)).getByText(/91% de palabras en común/)).toBeInTheDocument();
  });

  it("warns when only the most frequent messages were grouped", () => {
    renderClusters({ data: { ...data, truncated: true, analyzed: 200 } });
    expect(screen.getByText(/200 mensajes pendientes más frecuentes/i)).toBeInTheDocument();
  });

  it("shows an empty state", () => {
    renderClusters({ data: { ...data, clusters: [], analyzed: 0 } });
    expect(screen.getByText(/no hay mensajes pendientes para agrupar/i)).toBeInTheDocument();
  });

  it("expands the member list with occurrences", async () => {
    const user = userEvent.setup();
    renderClusters();
    const first = card(/reset my password/);
    const toggle = within(first).getByRole("button", { name: /mostrar mensajes/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(within(first).getByText("forgot my login secret")).toBeInTheDocument();
    expect(within(first).getByRole("checkbox", { name: /forgot my login secret/ })).toBeChecked();
  });

  it("preselects the nearest intent and keeps actions disabled when there are no intents", () => {
    renderClusters();
    expect(within(card(/reset my password/)).getByRole("combobox", { name: /intención de destino/i })).toHaveValue("password");
    expect(within(card(/card was stolen/)).getByRole("button", { name: /simular impacto/i })).toBeDisabled();
  });

  it("points to creating an intent when none exists", () => {
    renderClusters({ intents: [] });
    expect(screen.getByText(/aún no hay intenciones/i)).toBeInTheDocument();
    expect(within(card(/reset my password/)).getByRole("button", { name: /crear nueva intención/i })).toBeEnabled();
    expect(within(card(/reset my password/)).queryByRole("button", { name: /simular impacto/i })).toBeDisabled();
  });
});

describe("ReviewClusters: impact simulation", () => {
  it("simulates the selected members and shows matches, regressions and the estimate scope", async () => {
    const user = userEvent.setup();
    simulate.mockResolvedValue({ ok: true, data: impact });
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));

    expect(simulate).toHaveBeenCalledWith("password", ["a", "b"]);
    const panel = await within(first).findByRole("region", { name: /impacto estimado/i });
    expect(within(panel).getByText(/estimación, no exacta/i)).toBeInTheDocument();
    expect(within(panel).getByText(/4 mensajes no reconocidos coincidirían ahora/i)).toBeInTheDocument();
    expect(within(panel).getByText("cant login")).toBeInTheDocument();
    expect(within(panel).getByText(/1 posible regresión/i)).toBeInTheDocument();
    expect(within(panel).getByText("invoice question")).toBeInTheDocument();
    expect(within(panel).getByText(/billing/)).toBeInTheDocument();
    expect(within(panel).getByText(/1 mensaje más sería ambiguo/i)).toBeInTheDocument();
    expect(within(panel).getByText(/12 mensajes pendientes de los últimos 30 días y 40 ejemplos almacenados/i)).toBeInTheDocument();
    expect(bulkApprove).not.toHaveBeenCalled();
  });

  it("says when no regressions were found", async () => {
    const user = userEvent.setup();
    simulate.mockResolvedValue({ ok: true, data: { ...impact, regressions: { count: 0, samples: [] } } });
    renderClusters();
    await user.click(within(card(/reset my password/)).getByRole("button", { name: /simular impacto/i }));
    expect(await screen.findByText(/no se encontraron regresiones/i)).toBeInTheDocument();
  });

  it("shows an error and lets the user retry", async () => {
    const user = userEvent.setup();
    simulate.mockResolvedValueOnce({ ok: false, kind: "error", message: "Impact simulation needs semantic matching" });
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));
    expect(await within(first).findByRole("alert")).toHaveTextContent("Impact simulation needs semantic matching");
    simulate.mockResolvedValueOnce({ ok: true, data: impact });
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));
    expect(await within(first).findByRole("region", { name: /impacto estimado/i })).toBeInTheDocument();
  });

  it("drops the simulation when the target intent changes", async () => {
    const user = userEvent.setup();
    simulate.mockResolvedValue({ ok: true, data: impact });
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));
    await within(first).findByRole("region", { name: /impacto estimado/i });
    await user.selectOptions(within(first).getByRole("combobox", { name: /intención de destino/i }), "card");
    expect(within(first).queryByRole("region", { name: /impacto estimado/i })).not.toBeInTheDocument();
  });

  it("simulates only the members that stay checked", async () => {
    const user = userEvent.setup();
    simulate.mockResolvedValue({ ok: true, data: impact });
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /mostrar mensajes/i }));
    await user.click(within(first).getByRole("checkbox", { name: /forgot my login secret/ }));
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));
    expect(simulate).toHaveBeenCalledWith("password", ["a"]);
  });

  it("disables the actions when every member is unchecked", async () => {
    const user = userEvent.setup();
    renderClusters();
    const first = card(/card was stolen/);
    await user.selectOptions(within(first).getByRole("combobox", { name: /intención de destino/i }), "card");
    await user.click(within(first).getByRole("button", { name: /mostrar mensajes/i }));
    await user.click(within(first).getByRole("checkbox", { name: /card was stolen/ }));
    expect(within(first).getByRole("button", { name: /simular impacto/i })).toBeDisabled();
  });
});

describe("ReviewClusters: bulk actions", () => {
  async function simulateFirst(user: ReturnType<typeof userEvent.setup>) {
    simulate.mockResolvedValue({ ok: true, data: impact });
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /simular impacto/i }));
    await within(first).findByRole("region", { name: /impacto estimado/i });
    return first;
  }

  it("only offers the approval after a simulation and removes the cluster when everything is approved", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue(
      bulk({ succeeded: 2, results: [{ id: "a", ok: true, embedded: true }, { id: "b", ok: true, embedded: true }] }),
    );
    renderClusters();
    const first = card(/reset my password/);
    expect(within(first).queryByRole("button", { name: /^aprobar/i })).not.toBeInTheDocument();
    await simulateFirst(user);
    await user.click(within(first).getByRole("button", { name: /aprobar 2 mensajes en password/i }));

    expect(bulkApprove).toHaveBeenCalledWith("password", ["a", "b"]);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/se aprobaron 2 mensajes en "password"/i));
    expect(screen.queryByRole("article", { name: /reset my password/ })).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the failed members after a partial approval and reports them", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue(
      bulk({
        succeeded: 1,
        failed: 1,
        results: [
          { id: "a", ok: true, embedded: true },
          { id: "b", ok: false, status: 500, error: "Unexpected error" },
        ],
      }),
    );
    renderClusters();
    const first = await simulateFirst(user);
    await user.click(within(first).getByRole("button", { name: /aprobar 2 mensajes en password/i }));

    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/1 mensaje no se pudo aprobar/i));
    const remaining = card(/reset my password|forgot my login/);
    expect(within(remaining).getByText("2 mensajes")).toBeInTheDocument();
    await user.click(within(remaining).getByRole("button", { name: /mostrar mensajes/i }));
    expect(within(remaining).queryByRole("checkbox", { name: /i want to reset my password/ })).not.toBeInTheDocument();
    expect(within(remaining).getByRole("checkbox", { name: /forgot my login secret/ })).toBeInTheDocument();
  });

  it("drops members that were already reviewed by someone else (409) from the cluster", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue(
      bulk({
        succeeded: 1,
        failed: 1,
        results: [
          { id: "a", ok: true, embedded: true },
          { id: "b", ok: false, status: 409, error: "Unmatched message was already resolved" },
        ],
      }),
    );
    renderClusters();
    const first = await simulateFirst(user);
    await user.click(within(first).getByRole("button", { name: /aprobar 2 mensajes en password/i }));
    expect(screen.queryByRole("article", { name: /reset my password|forgot my login/ })).not.toBeInTheDocument();
  });

  it("mentions examples that were saved without an embedding", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue(
      bulk({ succeeded: 2, results: [{ id: "a", ok: true, embedded: false }, { id: "b", ok: true, embedded: true }] }),
    );
    renderClusters();
    const first = await simulateFirst(user);
    await user.click(within(first).getByRole("button", { name: /aprobar 2 mensajes en password/i }));
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/1 ejemplo aún no está vectorizado/i));
  });

  it("shows the error and keeps the cluster when the whole request fails", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue({ ok: false, kind: "error", message: "The service is unavailable right now." });
    renderClusters();
    const first = await simulateFirst(user);
    await user.click(within(first).getByRole("button", { name: /aprobar 2 mensajes en password/i }));
    expect(toast.error).toHaveBeenCalledWith("The service is unavailable right now.");
    expect(screen.getByRole("article", { name: /reset my password/ })).toBeInTheDocument();
  });

  it("rejects the selected members after a confirmation", async () => {
    const user = userEvent.setup();
    bulkReject.mockResolvedValue(bulk({ intent: undefined, succeeded: 2, results: [{ id: "a", ok: true }, { id: "b", ok: true }] }));
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /rechazar 2 mensajes/i }));
    expect(bulkReject).not.toHaveBeenCalled();
    await user.click(within(first).getByRole("button", { name: /confirmar rechazo/i }));
    expect(bulkReject).toHaveBeenCalledWith(["a", "b"]);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/se rechazaron 2 mensajes/i));
    expect(screen.queryByRole("article", { name: /reset my password/ })).not.toBeInTheDocument();
  });

  it("lets the user cancel a rejection", async () => {
    const user = userEvent.setup();
    renderClusters();
    const first = card(/reset my password/);
    await user.click(within(first).getByRole("button", { name: /rechazar 2 mensajes/i }));
    await user.click(within(first).getByRole("button", { name: /cancelar/i }));
    expect(within(first).queryByRole("button", { name: /confirmar rechazo/i })).not.toBeInTheDocument();
    expect(bulkReject).not.toHaveBeenCalled();
  });

  it("opens the intent dialog prefilled from the cluster and approves into the new intent once created", async () => {
    const user = userEvent.setup();
    bulkApprove.mockResolvedValue(bulk({ intent: "reset_password", succeeded: 2, results: [{ id: "a", ok: true, embedded: true }, { id: "b", ok: true, embedded: true }] }));
    renderClusters();
    expect(dialog.props?.open).toBe(false);
    await user.click(within(card(/reset my password/)).getByRole("button", { name: /crear nueva intención/i }));
    expect(screen.getByRole("dialog", { name: /new intent dialog/i })).toBeInTheDocument();
    expect(dialog.props?.prefill).toMatchObject({
      name: "reset_password",
      keywords: ["i want to reset my password", "forgot my login secret"],
    });

    await (dialog.props?.onCreated as (name: string) => Promise<void>)("reset_password");
    expect(bulkApprove).toHaveBeenCalledWith("reset_password", ["a", "b"]);
  });
});
