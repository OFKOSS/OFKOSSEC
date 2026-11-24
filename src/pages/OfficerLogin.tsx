import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, ShieldCheck, UserCog } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { officerEmailFromUsername } from "@/lib/voterAuth";

export default function OfficerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useAuthStore((state) => state.session);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/admin";

  // Already signed in? Skip straight past the form.
  useEffect(() => {
    if (session) navigate(redirectTo, { replace: true });
  }, [session, navigate, redirectTo]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setSubmitting(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: officerEmailFromUsername(username),
      password,
    });

    if (signInError) {
      setError(signInError.message);
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
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-tertiary">
              Electoral Officer
            </p>
            <h1 className="mt-3 text-4xl font-normal leading-tight text-on-surface">Officer sign in</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
              Officers manage the voter register, create elections and publish results. Use the account
              issued by the school.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5">
              {error && <Alert>{error}</Alert>}

              <Field label="Username" htmlFor="officer-username" required>
                <Input
                  id="officer-username"
                  name="officer-username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Admin"
                />
              </Field>

              <Field label="Password" htmlFor="officer-password" required>
                <Input
                  id="officer-password"
                  name="officer-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
                {submitting ? "Signing in…" : "Sign in"}
                {!submitting && <ArrowRight className="h-4 w-4" strokeWidth={2.4} />}
              </Button>
            </form>

            <p className="mt-6 text-sm text-on-surface-variant">
              A student?{" "}
              <Link to="/login" className="link-underline">
                Use the student sign in
              </Link>{" "}
              with your index number and class.
            </p>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-[28px] bg-tertiary p-7 text-on-tertiary shadow-elev-2">
              <div className="halftone-cobalt pointer-events-none absolute inset-0 opacity-15" aria-hidden />
              <div className="relative">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-on-tertiary/15 text-on-tertiary">
                  <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
                </span>
                <h2 className="mt-5 text-2xl font-normal leading-tight">
                  Running the election
                </h2>
                <ul className="mt-5 flex flex-col gap-3 text-sm text-on-tertiary/85">
                  {[
                    {
                      icon: <UserCog className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />,
                      text: "Add or remove voters on the register.",
                    },
                    {
                      icon: <KeyRound className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />,
                      text: "Create elections, add candidates and set the schedule.",
                    },
                    {
                      icon: <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />,
                      text: "Publish tamper-proof results when polls close.",
                    },
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
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-on-surface-variant">
                Officer access
              </p>
              <p className="mt-2 text-sm text-on-surface-variant">
                Officer accounts are issued by the school. If you have lost your details, contact the
                administrator who set up the election.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
