// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import type { AnalyticsChannel, AnalyticsDay, AnalyticsSummary, AnalyticsTag } from "@/lib/gateway/schemas";
import { AnalyticsView } from "./analytics-view";

beforeAll(() => {
  // Recharts' ResponsiveContainer observes its parent; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const summary: AnalyticsSummary = {
  totalMessages: 1234,
  uniqueConversations: 321,
  matchedRate: 0.7,
  errorRate: 0.025,
  previousPeriod: { totalMessages: 1000, deltaPct: 23.4 },
};
const channels: AnalyticsChannel[] = [
  { channel: "whatsapp", channelName: "Support line", messages: 900, conversations: 250 },
  { channel: "web", channelName: null, messages: 334, conversations: 71 },
];
const tags: AnalyticsTag[] = [
  { tag: "Sales", count: 500, pct: 40.5 },
  { tag: "Support", count: 300, pct: 24.3 },
];
const daily: AnalyticsDay[] = [
  { date: "2026-05-10", byChannel: { whatsapp: 5, web: 2 }, total: 7 },
  { date: "2026-05-11", byChannel: { whatsapp: 0, web: 1 }, total: 1 },
];
const query = { from: "2026-05-01", to: "2026-05-31" };
const presets = [
  { days: 7, href: "/analytics?from=2026-05-25&to=2026-05-31", active: false },
  { days: 30, href: "/analytics?from=2026-05-02&to=2026-05-31", active: true },
];

function renderView(overrides: Partial<React.ComponentProps<typeof AnalyticsView>> = {}) {
  return render(
    <AnalyticsView query={query} presets={presets} summary={summary} channels={channels} tags={tags} daily={daily} {...overrides} />,
  );
}

describe("AnalyticsView", () => {
  it("shows the KPI cards with formatted values and the period comparison", () => {
    renderView();
    const kpis = screen.getByRole("region", { name: "Métricas clave" });
    expect(within(kpis).getByText("Total de mensajes")).toBeInTheDocument();
    expect(within(kpis).getByText("1234")).toBeInTheDocument();
    expect(within(kpis).getByText("321")).toBeInTheDocument();
    expect(within(kpis).getByText("70,0%")).toBeInTheDocument();
    expect(within(kpis).getByText("2,5%")).toBeInTheDocument();
    expect(within(kpis).getByText(/\+23,4% frente al período anterior/)).toBeInTheDocument();
  });

  it("describes a missing previous period in words", () => {
    renderView({ summary: { ...summary, previousPeriod: { totalMessages: 0, deltaPct: null } } });
    expect(screen.getByText(/no hubo mensajes en el período anterior/i)).toBeInTheDocument();
  });

  it("is explicit about metrics that are not tracked", () => {
    renderView();
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(/aún sin seguimiento/i);
    expect(note).toHaveTextContent(/satisfacción/i);
    expect(note).toHaveTextContent(/transferencias/i);
  });

  it("lists channels in the summary table with their share of messages", () => {
    renderView();
    const table = screen.getByRole("table", { name: "Resumen por canal" });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2
    expect(within(rows[1]).getByText("Support line")).toBeInTheDocument();
    expect(within(rows[1]).getByText("900")).toBeInTheDocument();
    expect(within(rows[1]).getByText("72,9%")).toBeInTheDocument(); // 900 / 1234
    expect(within(rows[2]).getByText("web")).toBeInTheDocument(); // falls back to the key
  });

  it("gives every chart an accessible name and a data-table fallback", () => {
    renderView();
    expect(screen.getByRole("figure", { name: /mensajes por canal/i })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: /etiquetas principales/i })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: /mensajes por día/i })).toBeInTheDocument();

    const tagTable = screen.getByRole("table", { name: "Datos de etiquetas principales" });
    expect(within(tagTable).getByText("Sales")).toBeInTheDocument();
    expect(within(tagTable).getByText("40,5%")).toBeInTheDocument();

    const dailyTable = screen.getByRole("table", { name: "Datos de mensajes por día" });
    expect(within(dailyTable).getByText("10 may")).toBeInTheDocument();
    expect(within(dailyTable).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Día",
      "web",
      "Support line",
      "Total",
    ]);
  });

  it("explains an empty tag list instead of drawing an empty chart", () => {
    renderView({ tags: [] });
    expect(screen.getByText(/no hubo coincidencias con intenciones etiquetadas/i)).toBeInTheDocument();
  });

  it("renders the filters bound to the URL params", () => {
    renderView({ query: { ...query, channel: "web" } });
    const form = screen.getByRole("form", { name: "Filtros de analítica" });
    expect(form).toHaveAttribute("method", "get");
    expect(within(form).getByLabelText("Desde")).toHaveValue("2026-05-01");
    expect(within(form).getByLabelText("Hasta")).toHaveValue("2026-05-31");
    const select = within(form).getByLabelText("Canal") as HTMLSelectElement;
    expect(select.value).toBe("web");
    expect([...select.options].map((o) => o.text)).toEqual(["Todos los canales", "Support line", "web"]);
    expect(screen.getByRole("link", { name: "Últimos 30 días" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Últimos 7 días" })).toHaveAttribute("href", presets[0].href);
  });

  it("shows an empty state, keeping the filters, when there are no messages", () => {
    renderView({
      summary: { ...summary, totalMessages: 0, uniqueConversations: 0, previousPeriod: { totalMessages: 0, deltaPct: null } },
      channels: [],
      tags: [],
      daily: [],
    });
    expect(screen.getByRole("status")).toHaveTextContent(/no hay mensajes en este período/i);
    expect(screen.getByRole("form", { name: "Filtros de analítica" })).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
});
