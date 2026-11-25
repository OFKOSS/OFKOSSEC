import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-outline-variant bg-surface-container-low">
      <div className="container flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-display text-2xl font-medium leading-none text-on-surface">OFKOSSEC</p>
          <p className="mt-3 max-w-md text-sm text-on-surface-variant">
            Student council and prefect elections for Senior High Schools. One verified student, one
            vote, results you can actually trust.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-on-surface-variant">
          <Link to="/elections" className="transition-colors hover:text-primary">
            Elections
          </Link>
          <Link to="/login" className="transition-colors hover:text-primary">
            Sign in to vote
          </Link>
          <Link to="/officer/login" className="transition-colors hover:text-primary">
            Officer sign in
          </Link>
        </div>
      </div>
      <div className="border-t border-outline-variant px-4 py-4 text-center text-xs tracking-[0.12em] text-on-surface-variant sm:px-6">
        Built for SHS student elections · ballots are secret and immutable · by @silas1h
      </div>
    </footer>
  );
}
