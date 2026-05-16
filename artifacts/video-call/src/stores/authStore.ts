import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  isAdmin: boolean;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface MeResponse {
  user: User;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSessionReady: boolean;
  signup: (email: string, name: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (key: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
  setToken: (token: string) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "/api";

async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data = await response.json() as { error?: string };
    return data.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Zustand store is persisted; keep initial state stable
      user: null,
      token: null,
      isLoading: false,
      isSessionReady: false,

      signup: async (email: string, name: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/signup`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              name,
              password,
            }),
          });

          if (!response.ok) {
            throw new Error(await getErrorMessage(response, "Sign up failed"));
          }

          const data = await response.json() as AuthResponse;
          set({
            user: data.user,
            token: data.token,
            isLoading: false,
            isSessionReady: true,
          });
        } catch (error) {
          set({ isLoading: false, isSessionReady: true });
          throw error;
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          });

          if (!response.ok) {
            throw new Error(await getErrorMessage(response, "Login failed"));
          }

          const data = await response.json() as AuthResponse;
          set({
            user: data.user,
            token: data.token,
            isLoading: false,
            isSessionReady: true,
          });
        } catch (error) {
          set({ isLoading: false, isSessionReady: true });
          throw error;
        }
      },

      adminLogin: async (key: string) => {
        set({ isLoading: true });
        try {
          const response = await fetch(`${API_URL}/auth/admin/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ key }),
          });

          if (!response.ok) {
            throw new Error(
              await getErrorMessage(response, "Admin login failed"),
            );
          }

          const data = await response.json() as AuthResponse;
          set({
            user: data.user,
            token: data.token,
            isLoading: false,
            isSessionReady: true,
          });
        } catch (error) {
          set({ isLoading: false, isSessionReady: true });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isSessionReady: true,
        });
      },

      refreshSession: async () => {
        const token = get().token;

        if (!token) {
          set({
            user: null,
            token: null,
            isLoading: false,
            isSessionReady: true,
          });
          return;
        }

        set({ isLoading: true });

        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            set({
              user: null,
              token: null,
              isLoading: false,
              isSessionReady: true,
            });
            return;
          }

          const data = await response.json() as MeResponse;
          set({
            user: data.user,
            isLoading: false,
            isSessionReady: true,
          });
        } catch {
          set({
            user: null,
            token: null,
            isLoading: false,
            isSessionReady: true,
          });
        }
      },

      setToken: (token: string) => {
        set({
          token,
          isSessionReady: false,
        });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
      }),
      onRehydrateStorage: () => (state) => {
        void state?.refreshSession();
      },
    },
  ),
);
