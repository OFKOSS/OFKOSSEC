import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { useAuthStore, useIsAdmin } from "@/store/authStore";
import { PageLoader } from "@/components/ui/Feedback";
import { buttonClasses } from "@/components/ui/Button";
import { AppShell } from "@/components/layout/AppShell";
import { Link } from "react-router-dom";

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const initialised = useAuthStore((state) => state.initialised);
  const location = useLocation();

  if (!initialised) {
    return (
      <AppShell>
        <PageLoader label="Checking your session" />
      </AppShell>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const initialised = useAuthStore((state) => state.initialised);
  const profileLoading = useAuthStore((state) => state.profileLoading);
  const isAdmin = useIsAdmin();

  if (!initialised) {
    return (
      <AppShell>
        <PageLoader label="Checking your session" />
      </AppShell>
    );
  }
  if (!session) return <Navigate to="/officer/login" replace state={{ from: "/admin" }} />;
  if (profileLoading && !profile) {
    return (
      <AppShell>
        <PageLoader label="Loading your account" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="container max-w-2xl px-4 py-24 sm:px-6">
          <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-8 text-center shadow-elev-1">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-error-container text-on-error-container">
              <ShieldAlert className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <h1 className="text-2xl font-medium text-on-surface">Officers only</h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              This area is reserved for Electoral Officers. Ask your school administrator to upgrade your
              account if you should have access.
            </p>
            <div className="mt-6 flex justify-center">
              <Link to="/elections" className={buttonClasses("outline", "md")}>
                <Lock className="h-4 w-4" strokeWidth={2.2} />
                Back to elections
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
