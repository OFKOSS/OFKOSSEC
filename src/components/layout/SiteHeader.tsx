import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CheckSquare,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useAuthStore, useIsAdmin } from "@/store/authStore";
import { buttonClasses } from "@/components/ui/Button";
import { RoleChip } from "@/components/ui/StatusChip";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-secondary-container text-on-secondary-container"
      : "text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface",
  );

export function SiteHeader() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface/95 backdrop-blur">
      <div className="container flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="OFKOSSEC home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
            <CheckSquare className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="font-display text-xl font-medium leading-none tracking-tight text-on-surface">
            OFKOSSEC
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/elections" className={navLinkClass}>
            Elections
          </NavLink>
          {session && (
            <NavLink to="/profile" className={navLinkClass}>
              My ballot
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Officer panel
            </NavLink>
          )}
          {!session && (
            <NavLink to="/officer/login" className={navLinkClass}>
              Officer
            </NavLink>
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {session ? (
            <>
              <div className="ml-1 flex items-center gap-2.5 border-l border-outline-variant pl-3">
                <span className="text-sm font-medium text-on-surface-variant">
                  {profile?.full_name ?? session.user.email}
                </span>
                <RoleChip role={isAdmin ? "admin" : "student"} />
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10 hover:text-on-surface"
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </>
          ) : (
            <Link to="/login" className={buttonClasses("primary", "sm", "ml-1")}>
              Sign in to vote
            </Link>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10 hover:text-on-surface"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation"
          >
            {menuOpen ? (
              <X className="h-5 w-5" strokeWidth={2.2} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-outline-variant bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            <MobileLink to="/elections" icon={<CheckSquare className="h-4 w-4" strokeWidth={2.2} />}>
              Elections
            </MobileLink>
            {session && (
              <MobileLink to="/profile" icon={<UserRound className="h-4 w-4" strokeWidth={2.2} />}>
                My ballot
              </MobileLink>
            )}
            {isAdmin && (
              <>
                <MobileLink to="/admin" icon={<LayoutDashboard className="h-4 w-4" strokeWidth={2.2} />}>
                  Officer panel
                </MobileLink>
                <MobileLink to="/admin/voters" icon={<Users className="h-4 w-4" strokeWidth={2.2} />}>
                  Voters
                </MobileLink>
              </>
            )}
            {!session && (
              <MobileLink
                to="/officer/login"
                icon={<ShieldCheck className="h-4 w-4" strokeWidth={2.2} />}
              >
                Officer sign in
              </MobileLink>
            )}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-outline-variant pt-4">
            {session ? (
              <button type="button" onClick={handleSignOut} className={buttonClasses("outline", "md")}>
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
                Sign out
              </button>
            ) : (
              <Link to="/login" className={buttonClasses("primary", "md")}>
                Sign in to vote
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function MobileLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-secondary-container text-on-secondary-container"
            : "text-on-surface-variant hover:bg-on-surface/10",
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}
