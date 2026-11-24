import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  /** True once the first session check has completed. */
  initialised: boolean;
  /** True while the profile row for the signed-in user is being loaded. */
  profileLoading: boolean;
  setSession: (session: Session | null) => void;
  fetchProfile: (userId: string) => Promise<void>;
  setProfile: (profile: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  initialised: false,
  profileLoading: false,

  setSession: (session) => set({ session }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId) => {
    set({ profileLoading: true });
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Could not load profile", error.message);
      set({ profile: null, profileLoading: false });
      return;
    }
    set({ profile: (data as Profile) ?? null, profileLoading: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));

export function useIsAdmin(): boolean {
  return useAuthStore((state) => state.profile?.role === "admin");
}

export function useCurrentUserId(): string | null {
  return useAuthStore((state) => state.session?.user.id ?? null);
}
