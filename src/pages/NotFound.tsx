import { Link } from "react-router-dom";
import { Compass, Vote } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { buttonClasses } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <AppShell>
      <div className="container max-w-2xl px-4 py-24 sm:px-6">
        <div className="rounded-[28px] border border-outline-variant bg-surface-container-low p-10 text-center shadow-elev-2">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
            <Compass className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">404</p>
          <h1 className="mt-4 text-4xl font-normal leading-tight text-on-surface">
            This page isn&apos;t on the ballot
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
            The page you were looking for does not exist, or it has been moved. Head back to the elections
            sheet to keep going.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/elections" className={buttonClasses("primary", "lg")}>
              <Vote className="h-4 w-4" strokeWidth={2.4} />
              Go to elections
            </Link>
            <Link to="/" className={buttonClasses("outline", "lg")}>
              Back home
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
