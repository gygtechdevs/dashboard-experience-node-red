"use client";

import { useState, type KeyboardEvent } from "react";
import { XIcon } from "lucide-react";
import { addKeywords } from "@/lib/intents/schema";
import { cn } from "@/lib/utils";

interface KeywordInputProps {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** Singular noun used in labels and the placeholder (default "palabra clave"; feminine, as the placeholder uses "una"). */
  itemName?: string;
  /** Existing values offered as autocomplete; already-selected ones are skipped. */
  suggestions?: string[];
}

/** Chip input: Enter or comma commits, Backspace on an empty field removes the last chip. */
export function KeywordInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  disabled,
  itemName = "palabra clave",
  suggestions,
}: KeywordInputProps) {
  const [draft, setDraft] = useState("");
  const chosen = new Set(value.map((item) => item.toLowerCase()));
  const available = (suggestions ?? []).filter((item) => !chosen.has(item.toLowerCase()));
  const listId = `${id}-suggestions`;

  function commit(text: string) {
    const next = addKeywords(value, text);
    if (next !== value) onChange(next);
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-8 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        invalid && "border-destructive ring-3 ring-destructive/20",
        disabled && "opacity-50",
      )}
    >
      {value.map((keyword) => (
        <span
          key={keyword}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {keyword}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Quitar ${itemName} ${keyword}`}
            className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => onChange(value.filter((k) => k !== keyword))}
          >
            <XIcon className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={value.length === 0 ? `Escriba una ${itemName} y presione Enter` : ""}
        list={available.length > 0 ? listId : undefined}
        className="min-w-32 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => {
          const text = event.target.value;
          if (text.includes(",")) commit(text);
          else setDraft(text);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
      />
      {available.length > 0 ? (
        <datalist id={listId}>
          {available.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}
    </div>
  );
}
