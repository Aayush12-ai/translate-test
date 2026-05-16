import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "../stores/authStore";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  fallbackPath?: string;
}

/**
 * ProtectedRoute component that guards pages requiring authentication.
 * - Redirects unauthenticated users to login
 * - Optionally requires admin status
 * - Shows loading state while session initializes
 *
 * Usage:
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 *
 * For admin pages:
 * <ProtectedRoute requireAdmin>
 *   <AdminDashboardPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
  fallbackPath = "/login",
}: ProtectedRouteProps) {
  const [, navigate] = useLocation();
  const { user, isSessionReady } = useAuthStore();

  // Show loading state while session initializes
  if (!isSessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          <p className="text-gray-500 font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    void navigate(fallbackPath);
    return null;
  }

  // Redirect if admin is required but user is not admin
  if (requireAdmin && !user.isAdmin) {
    void navigate("/");
    return null;
  }

  return <>{children}</>;
}
