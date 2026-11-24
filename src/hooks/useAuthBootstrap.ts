import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

/**
 * Keeps the zustand auth store in step with the Supabase session.
 * Mount this exactly once, at the top of the app.
 */
export function useAuthBootstrap(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const setProfile = useAuthStore((state) => state.setProfile);

  useEffect(() => {
    let mounted = true;
    const markReady = () => useAuthStore.setState({ initialised: true });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (!session) {
        setProfile(null);
        markReady();
        return;
      }

      // Deferred: calling Supabase from inside the auth callback can deadlock.
      setTimeout(() => {
        if (mounted) void fetchProfile(session.user.id);
      }, 0);
      markReady();
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        void fetchProfile(data.session.user.id);
      }
      markReady();
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile, setProfile, setSession]);
}
