import { useState, type ReactNode } from "react";
import { CalendarRange, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, TextArea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { useHouses } from "@/hooks/useHouses";
import { toDateTimeLocal } from "@/utils/format";
import type { ElectionDraft, ElectionStatus, EligibleGender } from "@/types";

interface ElectionFormProps {
  initial?: Partial<ElectionDraft>;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (draft: ElectionDraft) => void | Promise<void>;
  onCancel?: () => void;
  footerExtra?: ReactNode;
}

const EMPTY: ElectionDraft = {
  title: "",
  position: "",
  description: "",
  status: "draft",
  results_public: false,
  eligible_gender: "any",
  eligible_house: "",
  starts_at: "",
  ends_at: "",
};

export function ElectionForm({
  initial,
  submitLabel,
  submitting,
  error,
  onSubmit,
  onCancel,
  footerExtra,
}: ElectionFormProps) {
  const [draft, setDraft] = useState<ElectionDraft>({
    ...EMPTY,
    ...initial,
    starts_at: toDateTimeLocal(initial?.starts_at ?? null),
    ends_at: toDateTimeLocal(initial?.ends_at ?? null),
  });
  const [validation, setValidation] = useState<string | null>(null);
  const { houses } = useHouses();

  const set = <K extends keyof ElectionDraft>(key: K, value: ElectionDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setValidation(null);

    if (!draft.title.trim()) {
      setValidation("Give the election a title.");
      return;
    }
    if (!draft.position.trim()) {
      setValidation("Name the position being contested.");
      return;
    }
    if (draft.starts_at && draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) {
      setValidation("The closing time must be after the opening time.");
      return;
    }

    void onSubmit({
      ...draft,
      title: draft.title.trim(),
      position: draft.position.trim(),
      description: draft.description.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {(validation || error) && <Alert>{validation ?? error}</Alert>}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Election title" htmlFor="title" required>
          <Input
            id="title"
            value={draft.title}
            onChange={(event) => set("title", event.target.value)}
            placeholder="Head Prefect Election"
            maxLength={120}
          />
        </Field>

        <Field label="Position contested" htmlFor="position" required>
          <Input
            id="position"
            value={draft.position}
            onChange={(event) => set("position", event.target.value)}
            placeholder="Head Prefect"
            maxLength={80}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="description"
        hint="Shown on the election card and its detail page."
      >
        <TextArea
          id="description"
          rows={3}
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="What is this election for, and what will the winner do?"
          maxLength={600}
        />
      </Field>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Status" htmlFor="status">
          <Select
            id="status"
            value={draft.status}
            onChange={(event) => set("status", event.target.value as ElectionStatus)}
          >
            <option value="draft">Draft — hidden from students</option>
            <option value="active">Voting live</option>
            <option value="closed">Voting closed</option>
          </Select>
        </Field>

        <Field label="Gender" htmlFor="eligible_gender" hint="Restrict this ballot to one gender.">
          <Select
            id="eligible_gender"
            value={draft.eligible_gender}
            onChange={(event) => set("eligible_gender", event.target.value as EligibleGender)}
          >
            <option value="any">All students</option>
            <option value="male">Male students only</option>
            <option value="female">Female students only</option>
          </Select>
        </Field>

        <Field
          label="House"
          htmlFor="eligible_house"
          hint="Restrict this ballot to one house. A student with no house cannot vote in it."
        >
          <Select
            id="eligible_house"
            value={draft.eligible_house}
            onChange={(event) => set("eligible_house", event.target.value)}
          >
            <option value="">All houses</option>
            {houses.map((option) => (
              <option key={option} value={option}>
                {option} only
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Voting opens" htmlFor="starts_at">
          <Input
            id="starts_at"
            type="datetime-local"
            value={draft.starts_at}
            onChange={(event) => set("starts_at", event.target.value)}
          />
        </Field>

        <Field label="Voting closes" htmlFor="ends_at">
          <Input
            id="ends_at"
            type="datetime-local"
            value={draft.ends_at}
            onChange={(event) => set("ends_at", event.target.value)}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3.5">
        <input
          type="checkbox"
          checked={draft.results_public}
          onChange={(event) => set("results_public", event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-tertiary"
        />
        <span>
          <span className="block text-[11px] font-medium uppercase tracking-[0.1em]">Publish results</span>
          <span className="mt-1 block text-xs text-on-surface-variant">
            When on, students can see the running tally. Leave off to keep ballots sealed until you are
            ready to announce.
          </span>
        </span>
      </label>

      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
        Students can only vote while the status is “Voting live”.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-outline-variant pt-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
          <CalendarRange className="h-3.5 w-3.5" strokeWidth={2.2} />
          Times are saved in your local timezone
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {footerExtra}
          {onCancel && (
            <Button variant="ghost" size="md" className="border border-outline-variant" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="md" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
