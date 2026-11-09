"use client";

import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KeywordInput } from "@/components/keyword-input";
import { createIntentAction, updateIntentAction } from "@/app/(dashboard)/knowledge/custom/actions";
import type { Intent, Step } from "@/lib/gateway/schemas";
import { intentFormSchema, zodFieldErrors, MAX_INTENT_NAME_LENGTH, type FieldErrors } from "@/lib/intents/schema";

interface IntentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Intent being edited; undefined creates a new one. */
  intent?: Intent;
  /** Null when the steps catalog could not be loaded. */
  steps: Step[] | null;
  /** Tags already used in the catalog, offered as autocomplete. */
  tagSuggestions?: string[];
  /** Initial values when creating (ignored when editing). */
  prefill?: { name: string; keywords: string[]; description?: string };
  /** Called with the saved name after a NEW intent was created. */
  onCreated?: (name: string) => void;
}

function stepLabel(step: Step): string {
  return step.name === step.path ? step.path : `${step.name} (${step.path})`;
}

export function IntentFormDialog({
  open,
  onOpenChange,
  intent,
  steps,
  tagSuggestions,
  prefill,
  onCreated,
}: IntentFormDialogProps) {
  // Remount the form whenever the dialog opens or the target changes so state starts fresh.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <IntentForm
          key={intent?.intent ?? "new"}
          intent={intent}
          steps={steps}
          tagSuggestions={tagSuggestions}
          prefill={prefill}
          onCreated={onCreated}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function IntentForm({
  intent,
  steps,
  tagSuggestions,
  prefill,
  onCreated,
  onClose,
}: {
  intent?: Intent;
  steps: Step[] | null;
  tagSuggestions?: string[];
  prefill?: IntentFormDialogProps["prefill"];
  onCreated?: (name: string) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const editing = intent !== undefined;
  const [name, setName] = useState(intent?.intent ?? prefill?.name ?? "");
  const [initialStep, setInitialStep] = useState(intent?.initialStep ?? "");
  const [keywords, setKeywords] = useState<string[]>(intent?.keywords ?? prefill?.keywords ?? []);
  const [tags, setTags] = useState<string[]>(intent?.tags ?? []);
  const [description, setDescription] = useState(intent?.description ?? prefill?.description ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const options = useMemo(() => {
    const items = (steps ?? []).map((step) => ({ value: step.path, label: stepLabel(step) }));
    // Keep a stored step selectable even if the catalog no longer lists it.
    if (initialStep && !items.some((item) => item.value === initialStep)) {
      items.unshift({ value: initialStep, label: initialStep });
    }
    return items;
  }, [steps, initialStep]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const values = { intent: name, initialStep, keywords, tags, description };
    const parsed = intentFormSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = editing
        ? await updateIntentAction(intent.intent, values)
        : await createIntentAction(values);
      if (result.ok) {
        toast.success(editing ? "Intención actualizada" : "Intención creada");
        onClose();
        if (!editing) onCreated?.(parsed.data.intent);
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setFormError(Object.keys(result.fieldErrors ?? {}).length > 0 ? null : result.message);
    });
  }

  const describe = (field: keyof FieldErrors) => (errors[field] ? `${uid}-${field}-error` : undefined);

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar intención" : "Nueva intención"}</DialogTitle>
          <DialogDescription>
            Una intención asocia lo que dicen los usuarios (palabras clave) con el paso de Node-RED que lo atiende.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-name`}>Nombre</Label>
          <Input
            id={`${uid}-name`}
            value={name}
            maxLength={MAX_INTENT_NAME_LENGTH}
            disabled={editing || pending}
            aria-invalid={!!errors.intent}
            aria-describedby={describe("intent")}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
          {editing ? (
            <p className="text-xs text-muted-foreground">El nombre no se puede cambiar después de la creación.</p>
          ) : null}
          <FieldError id={`${uid}-intent-error`} message={errors.intent} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-step`}>Paso inicial</Label>
          <Select
            value={initialStep}
            items={options}
            onValueChange={(value) => setInitialStep(typeof value === "string" ? value : "")}
            disabled={pending}
          >
            <SelectTrigger
              id={`${uid}-step`}
              className="w-full"
              aria-invalid={!!errors.initialStep}
              aria-describedby={describe("initialStep")}
            >
              <SelectValue placeholder={steps === null ? "Pasos no disponibles" : "Seleccione un paso"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {steps === null ? (
            <p role="status" className="text-xs text-destructive">
              No se pudo cargar el catálogo de pasos. Recargue la página para intentarlo de nuevo.
            </p>
          ) : null}
          <FieldError id={`${uid}-initialStep-error`} message={errors.initialStep} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-keywords`}>Palabras clave</Label>
          <KeywordInput
            id={`${uid}-keywords`}
            value={keywords}
            onChange={setKeywords}
            invalid={!!errors.keywords}
            describedBy={describe("keywords")}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Presione Enter o coma para agregar cada palabra clave.</p>
          <FieldError id={`${uid}-keywords-error`} message={errors.keywords} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-tags`}>Etiquetas (opcional)</Label>
          <KeywordInput
            id={`${uid}-tags`}
            itemName="etiqueta"
            value={tags}
            onChange={setTags}
            suggestions={tagSuggestions}
            invalid={!!errors.tags}
            describedBy={describe("tags")}
            disabled={pending}
          />
          <p className="text-xs text-muted-foreground">Agrupe las intenciones con hasta 10 etiquetas. Presione Enter o coma para agregar cada una.</p>
          <FieldError id={`${uid}-tags-error`} message={errors.tags} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-description`}>Descripción (opcional)</Label>
          <Textarea
            id={`${uid}-description`}
            value={description}
            rows={3}
            disabled={pending}
            aria-describedby={describe("description")}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FieldError id={`${uid}-description-error`} message={errors.description} />
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : editing ? "Guardar cambios" : "Crear intención"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}
