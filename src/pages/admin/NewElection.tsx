import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell, PageHeading } from "@/components/layout/AppShell";
import { ElectionForm } from "@/components/admin/ElectionForm";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { ElectionDraft } from "@/types";

export default function NewElection() {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.session?.user.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (draft: ElectionDraft) => {
    setSubmitting(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("elections")
      .insert({
        title: draft.title,
        position: draft.position,
        description: draft.description || null,
        status: draft.status,
        results_public: draft.results_public,
        eligible_gender: draft.eligible_gender,
        starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
        ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    navigate(`/admin/elections/${data.id}`, { replace: true });
  };

  return (
    <AppShell>
      <div className="container max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
          Officer panel
        </Link>

        <div className="mt-6">
          <PageHeading
            eyebrow="New election"
            title="Create an election"
            description="Set up the contest, then add candidates on the next screen."
          />
        </div>

        <div className="mt-8 rounded-[28px] border border-outline-variant bg-surface-container-low p-6 shadow-elev-2 sm:p-8">
          <ElectionForm
            submitLabel="Create election"
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onCancel={() => navigate("/admin")}
          />
        </div>
      </div>
    </AppShell>
  );
}
