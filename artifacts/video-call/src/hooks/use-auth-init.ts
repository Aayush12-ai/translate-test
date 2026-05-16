import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

/**
 * Hook to initialize authentication on app startup.
 * Ensures the session is checked before rendering protected routes.
 */
export function useAuthInit() {
  const { isSessionReady, refreshSession } = useAuthStore();

  useEffect(() => {
    if (!isSessionReady) {
      void refreshSession();
    }
  }, [isSessionReady, refreshSession]);

  return isSessionReady;
}
