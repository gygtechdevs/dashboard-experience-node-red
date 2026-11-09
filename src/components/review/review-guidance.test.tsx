// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { ReviewGuidance, ReviewNotice } from "./review-guidance";

describe("ReviewGuidance", () => {
  it("explains approve, reject, create-first and the retention purge", () => {
    render(<ReviewGuidance />);
    expect(screen.getByText(/^aprobar$/i, { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/^rechazar$/i, { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /conocimiento/i })).toHaveAttribute("href", "/knowledge/custom");
    expect(screen.getByText(/se eliminan automáticamente/i)).toBeInTheDocument();
  });
});

describe("ReviewNotice", () => {
  it("renders the capture-disabled notice with the env var", () => {
    render(<ReviewNotice kind="disabled" />);
    expect(screen.getByText("La captura de mensajes no reconocidos está deshabilitada")).toBeInTheDocument();
    expect(screen.getByText(/UNMATCHED_CAPTURE_ENABLED=true/)).toBeInTheDocument();
  });

  it("renders the admin-required notice", () => {
    render(<ReviewNotice kind="forbidden" />);
    expect(screen.getByText(/Se requiere permiso ADMIN/)).toBeInTheDocument();
  });

  it("renders an error notice with a message", () => {
    render(<ReviewNotice kind="error" message="Boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
  });
});
