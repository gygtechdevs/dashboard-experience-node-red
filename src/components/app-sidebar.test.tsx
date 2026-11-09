// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/analytics" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AppSidebar } from "./app-sidebar";

function renderSidebar() {
  return render(<AppSidebar email="admin@example.com" logout={async () => {}} />);
}

beforeEach(() => {
  pathname.value = "/analytics";
});

describe("AppSidebar", () => {
  it("nests the review queue under the training group and removes it from the top level", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    const training = within(nav).getByText("Entrenamiento").closest("li") as HTMLElement;
    expect(within(training).getByRole("link", { name: "Cola de revisión" })).toHaveAttribute("href", "/training/review");
    expect(within(nav).getAllByRole("link", { name: "Cola de revisión" })).toHaveLength(1);
  });

  it("renders the training entry as a group heading, not as a disabled placeholder", () => {
    renderSidebar();
    const training = screen.getByText("Entrenamiento");
    expect(training).not.toHaveAttribute("aria-disabled");
    expect(within(training.closest("li") as HTMLElement).queryByText("Próximamente")).not.toBeInTheDocument();
  });

  it.each(["/training/review", "/training/review/"])("marks the nested item as current on %s", (path) => {
    pathname.value = path;
    renderSidebar();
    expect(screen.getByRole("link", { name: "Cola de revisión" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Analítica" })).not.toHaveAttribute("aria-current");
  });

  it("does not mark it as current elsewhere, nor treat sibling prefixes as a match", () => {
    pathname.value = "/training/review-archive";
    renderSidebar();
    expect(screen.getByRole("link", { name: "Cola de revisión" })).not.toHaveAttribute("aria-current");
  });

  it("still highlights top-level and Knowledge entries", () => {
    pathname.value = "/knowledge/custom";
    renderSidebar();
    expect(screen.getByRole("link", { name: "Personalizado" })).toHaveAttribute("aria-current", "page");
  });
});
