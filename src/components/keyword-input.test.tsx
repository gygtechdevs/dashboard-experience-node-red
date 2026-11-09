// @vitest-environment jsdom
import { useState, type ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KeywordInput } from "./keyword-input";

function Harness({
  initial = [] as string[],
  ...rest
}: { initial?: string[] } & Partial<Omit<ComponentProps<typeof KeywordInput>, "value" | "onChange">>) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <KeywordInput id="kw" value={value} onChange={setValue} {...rest} />
      <output data-testid="state">{JSON.stringify(value)}</output>
    </>
  );
}

const state = () => JSON.parse(screen.getByTestId("state").textContent ?? "[]") as string[];

describe("KeywordInput", () => {
  it("adds a keyword on Enter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("textbox"), "refund{Enter}");
    expect(state()).toEqual(["refund"]);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("adds keywords on comma and ignores duplicates", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["order"]} />);
    await user.type(screen.getByRole("textbox"), "Order,track,");
    expect(state()).toEqual(["order", "track"]);
  });

  it("commits pending text on blur", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole("textbox"), "pending");
    await user.tab();
    expect(state()).toEqual(["pending"]);
  });

  it("removes the last keyword with Backspace on an empty input", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["a", "b"]} />);
    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Backspace}");
    expect(state()).toEqual(["a"]);
  });

  it("supports a custom item name for placeholder and remove labels", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["sales"]} itemName="etiqueta" />);
    await user.click(screen.getByRole("button", { name: "Quitar etiqueta sales" }));
    expect(state()).toEqual([]);
    expect(screen.getByPlaceholderText("Escriba una etiqueta y presione Enter")).toBeInTheDocument();
  });

  it("offers suggestions that are not already selected", () => {
    const { container } = render(<Harness initial={["sales"]} suggestions={["Sales", "support", "billing"]} />);
    const options = [...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"));
    expect(options).toEqual(["support", "billing"]);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("removes a keyword via its accessible remove button", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["a", "b"]} />);
    await user.click(screen.getByRole("button", { name: "Quitar palabra clave a" }));
    expect(state()).toEqual(["b"]);
  });
});
