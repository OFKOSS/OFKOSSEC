import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRoundPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert, EmptyState, Spinner } from "@/components/ui/Feedback";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, Input, TextArea } from "@/components/ui/Field";
import { CandidateAvatar } from "@/components/ui/CandidateAvatar";
import {
  PHOTO_ACCEPT,
  photoValidationError,
  uploadCandidatePhoto,
} from "@/lib/storage";
import type { Candidate, CandidateDraft } from "@/types";

const EMPTY_DRAFT: CandidateDraft = {
  name: "",
  class_name: "",
  slogan: "",
  manifesto: "",
  photo_url: "",
};

/** Builds a placeholder portrait so a candidate without a photo still looks finished. */
function buildPortraitUrl(name: string): string {
  const prompt = `${name} school student portrait, friendly neutral studio lighting, plain light background, head and shoulders, square crop, realistic photograph`;
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=square`;
}

export function CandidateManager({ electionId }: { electionId: string }) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CandidateDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("candidates")
      .select("*")
      .eq("election_id", electionId)
      .order("sort_order", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setCandidates([]);
    } else {
      setError(null);
      setCandidates((data as Candidate[]) ?? []);
    }
    setLoading(false);
  }, [electionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("A candidate needs a name.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      election_id: electionId,
      name: draft.name.trim(),
      class_name: draft.class_name.trim() || null,
      slogan: draft.slogan.trim() || null,
      manifesto: draft.manifesto.trim() || null,
      photo_url: draft.photo_url.trim() || null,
    };

    const { error: writeError } = draft.id
      ? await supabase.from("candidates").update(payload).eq("id", draft.id)
      : await supabase
          .from("candidates")
          .insert({ ...payload, sort_order: candidates.length + 1 });

    if (writeError) {
      setError(writeError.message);
      setSaving(false);
      return;
    }

    setDraft(null);
    setSaving(false);
    await load();
  };

  const removeCandidate = async (candidate: Candidate) => {
    setBusyId(candidate.id);
    const { error: deleteError } = await supabase.from("candidates").delete().eq("id", candidate.id);
    if (deleteError) setError(deleteError.message);
    setBusyId(null);
    await load();
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= candidates.length) return;

    const current = candidates[index];
    const neighbour = candidates[target];
    setBusyId(current.id);
    setError(null);

    // Swap the two sort_order values with plain updates. An upsert of just
    // { id, sort_order } would be an INSERT … ON CONFLICT DO UPDATE, and the
    // insert half fails because election_id and name are NOT NULL with no
    // default — which is why the arrows did nothing. There is no unique
    // constraint on (election_id, sort_order), so both rows can hold the same
    // value for the moment between the two writes.
    const [first, second] = await Promise.all([
      supabase.from("candidates").update({ sort_order: neighbour.sort_order }).eq("id", current.id),
      supabase.from("candidates").update({ sort_order: current.sort_order }).eq("id", neighbour.id),
    ]);

    const moveError = first.error ?? second.error;
    if (moveError) setError(moveError.message);
    setBusyId(null);
    await load();
  };

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    current: CandidateDraft,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again
    if (!file) return;

    const invalid = photoValidationError(file);
    if (invalid) {
      setError(invalid);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const url = await uploadCandidatePhoto(file, electionId);
      setDraft({ ...current, photo_url: url });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-normal text-on-surface">Candidates</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {candidates.length === 0
                ? "No candidates yet."
                : `${candidates.length} on the ballot, in display order.`}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setDraft(draft ? null : { ...EMPTY_DRAFT })}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={2.6} />}
          >
            Add
          </Button>
        </div>

        {error && (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-outline-variant px-4 py-10 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
            <Spinner /> Loading candidates
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={<UserRoundPlus className="h-6 w-6" strokeWidth={2.2} />}
            title="No candidates yet"
            description="Add at least two candidates before you open voting."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {candidates.map((candidate, index) => (
              <li
                key={candidate.id}
                className="flex items-start gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4 shadow-elev-1"
              >
                <CandidateAvatar
                  name={candidate.name}
                  photoUrl={candidate.photo_url}
                  className="h-14 w-14 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-normal text-on-surface leading-tight">{candidate.name}</p>
                  {candidate.class_name && (
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                      {candidate.class_name}
                    </p>
                  )}
                  {candidate.slogan && (
                    <p className="mt-1 line-clamp-1 text-sm italic text-primary">“{candidate.slogan}”</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <IconAction
                    label="Move up"
                    disabled={index === 0 || busyId === candidate.id}
                    onClick={() => void move(index, -1)}
                    icon={<ArrowUp className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  />
                  <IconAction
                    label="Move down"
                    disabled={index === candidates.length - 1 || busyId === candidate.id}
                    onClick={() => void move(index, 1)}
                    icon={<ArrowDown className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  />
                  <IconAction
                    label="Edit"
                    onClick={() =>
                      setDraft({
                        id: candidate.id,
                        name: candidate.name,
                        class_name: candidate.class_name ?? "",
                        slogan: candidate.slogan ?? "",
                        manifesto: candidate.manifesto ?? "",
                        photo_url: candidate.photo_url ?? "",
                      })
                    }
                    icon={<Pencil className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  />
                  <IconAction
                    label="Remove"
                    danger
                    disabled={busyId === candidate.id}
                    onClick={() => void removeCandidate(candidate)}
                    icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-5 shadow-elev-2">
          <h3 className="text-xl font-normal text-on-surface">
            {draft?.id ? "Edit candidate" : draft ? "New candidate" : "Candidate details"}
          </h3>

          {!draft ? (
            <p className="mt-3 text-sm text-on-surface-variant">
              Select a candidate to edit, or add a new one to the ballot. Candidates appear on the ballot
              in the order listed on the left.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <Field label="Full name" htmlFor="cand-name" required>
                <Input
                  id="cand-name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder="Ama Serwaa"
                  maxLength={80}
                />
              </Field>

              <Field label="Class" htmlFor="cand-class">
                <Input
                  id="cand-class"
                  value={draft.class_name}
                  onChange={(event) => setDraft({ ...draft, class_name: event.target.value })}
                  placeholder="Form 3 — Science"
                  maxLength={60}
                />
              </Field>

              <Field label="Slogan" htmlFor="cand-slogan">
                <Input
                  id="cand-slogan"
                  value={draft.slogan}
                  onChange={(event) => setDraft({ ...draft, slogan: event.target.value })}
                  placeholder="Every voice, every day."
                  maxLength={140}
                />
              </Field>

              <Field label="Manifesto" htmlFor="cand-manifesto" hint="Shown in full on the ballot.">
                <TextArea
                  id="cand-manifesto"
                  rows={5}
                  value={draft.manifesto}
                  onChange={(event) => setDraft({ ...draft, manifesto: event.target.value })}
                  placeholder="What will they actually do if elected?"
                  maxLength={1200}
                />
              </Field>

              <Field
                label="Photo"
                htmlFor="cand-photo"
                hint="Upload a picture, paste a link, or generate a placeholder."
              >
                <div className="flex items-start gap-3">
                  <CandidateAvatar
                    name={draft.name || "?"}
                    photoUrl={draft.photo_url || null}
                    className="h-20 w-20 shrink-0"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={buttonClasses(
                          "outline",
                          "sm",
                          uploading ? "pointer-events-none opacity-50" : "cursor-pointer",
                        )}
                      >
                        <Upload className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {uploading ? "Uploading…" : "Upload photo"}
                        <input
                          type="file"
                          accept={PHOTO_ACCEPT}
                          onChange={(event) => void handlePhotoUpload(event, draft)}
                          className="sr-only"
                        />
                      </label>

                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!draft.name.trim() || uploading}
                        onClick={() => setDraft({ ...draft, photo_url: buildPortraitUrl(draft.name.trim()) })}
                        icon={<ImagePlus className="h-3.5 w-3.5" strokeWidth={2.4} />}
                      >
                        Generate
                      </Button>

                      {draft.photo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="border border-outline-variant"
                          disabled={uploading}
                          onClick={() => setDraft({ ...draft, photo_url: "" })}
                          icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={2.4} />}
                        >
                          Remove
                        </Button>
                      )}
                    </div>

                    <Input
                      id="cand-photo"
                      value={draft.photo_url}
                      onChange={(event) => setDraft({ ...draft, photo_url: event.target.value })}
                      placeholder="https://… (or upload a file above)"
                    />
                  </div>
                </div>
              </Field>

              <div className="mt-1 flex items-center gap-3 border-t border-dashed border-outline-variant pt-4">
                <Button size="md" onClick={() => void saveDraft()} disabled={saving || uploading}>
                  {saving ? "Saving…" : draft.id ? "Save changes" : "Add candidate"}
                </Button>
                <Button variant="ghost" size="md" className="border border-outline-variant" onClick={() => setDraft(null)} disabled={saving || uploading}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function IconAction({
  label,
  icon,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        "flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-low transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
        (danger ? "hover:bg-primary hover:text-on-primary" : "hover:bg-surface-container")
      }
    >
      {icon}
    </button>
  );
}
