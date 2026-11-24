import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, GraduationCap, IdCard, Lock, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { CLASS_OPTIONS } from "@/lib/constants";
import { isUsableIndexNumber, voterEmailFromIndex } from "@/lib/voterAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  const [indexNumber, setIndexNumber] = useState("");
  const [className, setClassName] = useState(CLASS_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/elections";

  // Already signed in? Skip straight past the form.
  useEffect(() => {
    if (session) navigate(redirectTo, { replace: true });
  }, [session, navigate, redirectTo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!indexNumber.trim()) {
      setError("Enter your index number.");
      return;
    }
    if (!isUsableIndexNumber(indexNumber)) {
      setError("That index number does not look right. Check it against your admission letter.");
      return;
    }

    setSubmitting(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: voterEmailFromIndex(indexNumber),
      password: className,
    });

    if (signInError) {
      setError(
        "We could not find a voter with that index number and class. Check both and try again, or ask your Electoral Officer to add you.",
      );
      setSubmitting(false);
      return;
    }

    if (data.user) await fetchProfile(data.user.id);
    setSubmitting(false);
    navigate(redirectTo, { replace: true });
  };

  return (
    <AppShell>
      <div className="container max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid items-stretch gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-7 shadow-elev-2 sm:p-10">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Welcome back</p>
            <h1 className="mt-3 text-4xl font-normal leading-tight text-on-surface">Sign in to vote</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
              Your Electoral Officer issues your login. Use the index number on your admission letter and
              the class you are in.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
              {error && <Alert>{error}</Alert>}

              <Field label="Index number" htmlFor="index-number" required hint="Example: SHS/2026/0148">
                <Input
                  id="index-number"
                  name="index-number"
                  value={indexNumber}
                  onChange={(event) => setIndexNumber(event.target.value)}
                  placeholder="SHS/2026/0148"
                  autoComplete="username"
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </Field>

              <Field label="Class" htmlFor="class-name" required hint="Your class is your password.">
                <Select
                  id="class-name"
                  name="class-name"
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                >
                  {CLASS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>

              <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" strokeWidth={2.4} />}
              </Button>
            </form>

            <p className="mt-6 text-sm text-on-surface-variant">
              Not on the register yet?{" "}
              <Link to="/elections" className="link-underline">
                See the elections
              </Link>{" "}
              and ask your Electoral Officer to add you.
            </p>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-[28px] bg-primary p-7 text-on-primary shadow-elev-2">
              <div className="halftone-poppy pointer-events-none absolute inset-0 opacity-15" aria-hidden />
              <div className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-on-primary/15 text-on-primary">
                  <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <h2 className="mt-5 text-2xl font-normal leading-tight">
                  Your vote stays secret
                </h2>
                <ul className="mt-5 flex flex-col gap-3 text-sm text-on-primary/85">
                  {[
                    { icon: <Lock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />, text: "Ballots are never linked back to your name." },
                    { icon: <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />, text: "One vote per election, enforced by the database." },
                    { icon: <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />, text: "Only students on the register can sign in." },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-2.5">
                      {item.icon}
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container p-5">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                <IdCard className="h-4 w-4" strokeWidth={2.2} />
                How to sign in
              </p>
              <ol className="mt-3 flex flex-col gap-2 text-sm text-on-surface-variant">
                <li>1. Type your index number exactly as it appears on your admission letter.</li>
                <li>2. Choose your class from the list.</li>
                <li>3. Tap sign in, then pick your candidate on the ballot.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 shadow-elev-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                Electoral Officer?
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Officers sign in with the account issued by the school.
              </p>
              <Link
                to="/officer/login"
                className="mt-3 inline-flex items-center gap-2 text-[13px] font-medium text-primary transition-colors hover:underline"
              >
                Officer sign in
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
