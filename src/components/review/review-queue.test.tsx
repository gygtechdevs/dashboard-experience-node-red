// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UnmatchedItem } from "@/lib/gateway/schemas";

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
  approveUnmatchedAction: vi.fn(),
  rejectUnmatchedAction: vi.fn(),
  loadMoreUnmatchedAction: vi.fn(),
}));

import { approveUnmatchedAction, loadMoreUnmatchedAction, rejectUnmatchedAction } from "@/app/(dashboard)/training/review/actions";
import { ReviewQueue } from "./review-queue";

const approve = vi.mocked(approveUnmatchedAction);
const reject = vi.mocked(rejectUnmatchedAction);
const loadMore = vi.mocked(loadMoreUnmatchedAction);

const make = (id: string, text: string, occurrences = 2): UnmatchedItem => ({
  id,
  maskedText: text,
  occurrences,
  status: "pending",
  firstSeenAt: "2026-05-01T10:00:00.000Z",
  lastSeenAt: "2026-05-03T12:30:00.000Z",
});

const items = [make("a", "i want my money back", 5), make("b", "hello [EMAIL]")];

function renderQueue(props: Partial<React.ComponentProps<typeof ReviewQueue>> = {}) {
  return render(
    <ReviewQueue items={items} nextCursor={null} status="pending" intents={["refund", "greeting"]} {...props} />,
  );
}

async function chooseAndApprove(user: ReturnType<typeof userEvent.setup>) {
  const row = screen.getByRole("row", { name: /i want my money/ });
  await user.selectOptions(within(row).getByRole("combobox", { name: /intención/i }), "refund");
  await user.click(within(row).getByRole("button", { name: "Aprobar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReviewQueue", () => {
  it("lists masked text, occurrences and seen dates", () => {
    renderQueue();
    const row = screen.getByRole("row", { name: /i want my money/ });
    expect(within(row).getByText("5")).toBeInTheDocument();
    expect(within(row).getByText(/2026-05-01 10:00 UTC/)).toBeInTheDocument();
    expect(within(row).getByText(/2026-05-03 12:30 UTC/)).toBeInTheDocument();
    expect(screen.getByText("hello [EMAIL]")).toBeInTheDocument();
  });

  it("shows status tabs with the active one marked", () => {
    renderQueue({ status: "approved", items: [] });
    expect(screen.getByRole("link", { name: "Grupos" })).toHaveAttribute("href", "/training/review");
    expect(screen.getByRole("link", { name: "Pendientes" })).toHaveAttribute("href", "/training/review?status=pending");
    expect(screen.getByRole("link", { name: "Aprobados" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Rechazados" })).toHaveAttribute("href", "/training/review?status=rejected");
  });

  it("shows an empty state", () => {
    renderQueue({ items: [] });
    expect(screen.getByText(/la cola está vacía/i)).toBeInTheDocument();
  });

  it("keeps Approve disabled until an intent is chosen, then approves and reports the embedding", async () => {
    const user = userEvent.setup();
    approve.mockResolvedValue({ ok: true, data: { id: "a", status: "approved", intent: "refund", embedded: true } });
    renderQueue();
    const row = screen.getByRole("row", { name: /i want my money/ });
    expect(within(row).getByRole("button", { name: "Aprobar" })).toBeDisabled();
    await chooseAndApprove(user);
    expect(approve).toHaveBeenCalledWith("a", "refund");
    expect(await screen.findByText(/aprobado como/i)).toBeInTheDocument();
    expect(screen.queryByText(/sin vectorizar/i)).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalled();
  });

  it("hints at a re-embed when the example was not embedded", async () => {
    const user = userEvent.setup();
    approve.mockResolvedValue({ ok: true, data: { id: "a", status: "approved", intent: "refund", embedded: false } });
    renderQueue();
    await chooseAndApprove(user);
    expect(await screen.findByText(/aún sin vectorizar/i)).toBeInTheDocument();
  });

  it("shows the explanation on approve failure and keeps the row", async () => {
    const user = userEvent.setup();
    approve.mockResolvedValue({ ok: false, kind: "error", message: "Semantic matching is disabled" });
    renderQueue();
    await chooseAndApprove(user);
    expect(toast.error).toHaveBeenCalledWith("Semantic matching is disabled");
    expect(screen.getByRole("row", { name: /i want my money/ })).toBeInTheDocument();
  });

  it("removes the row and refreshes when the item is stale (404/409)", async () => {
    const user = userEvent.setup();
    approve.mockResolvedValue({ ok: false, kind: "stale", message: "already reviewed" });
    renderQueue();
    await chooseAndApprove(user);
    expect(toast.error).toHaveBeenCalledWith("already reviewed");
    expect(screen.queryByText("i want my money back")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("rejects a message and removes it", async () => {
    const user = userEvent.setup();
    reject.mockResolvedValue({ ok: true, data: undefined });
    renderQueue();
    const row = screen.getByRole("row", { name: /hello/ });
    await user.click(within(row).getByRole("button", { name: "Rechazar" }));
    expect(reject).toHaveBeenCalledWith("b");
    expect(screen.queryByText("hello [EMAIL]")).not.toBeInTheDocument();
  });

  it("loads more with the cursor and appends the rows", async () => {
    const user = userEvent.setup();
    loadMore.mockResolvedValue({ ok: true, data: { items: [make("c", "another question")], nextCursor: null } });
    renderQueue({ nextCursor: "cur1" });
    await user.click(screen.getByRole("button", { name: /cargar más/i }));
    expect(loadMore).toHaveBeenCalledWith("pending", "cur1");
    expect(await screen.findByText("another question")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("hides actions on resolved tabs and shows the resolved intent", () => {
    renderQueue({
      status: "approved",
      items: [{ ...make("z", "already resolved"), status: "approved", resolvedIntent: "refund" }],
    });
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.getByText("refund")).toBeInTheDocument();
  });

  it("points to Knowledge when there are no intents to approve into", () => {
    renderQueue({ intents: [] });
    expect(screen.getByText(/aún no hay intenciones/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
  });
});
