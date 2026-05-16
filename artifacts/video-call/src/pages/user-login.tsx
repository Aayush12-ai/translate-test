import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Lock, LogIn, Mail, User as UserIcon } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";

type AuthMode = "login" | "signup";

const API_URL = import.meta.env.VITE_API_URL || "/api";

function getOauthErrorMessage(reason: string | null): string {
  switch (reason) {
    case "google_not_configured":
      return "Google OAuth is not configured yet. Add Google credentials on the server to enable it.";
    case "google_auth_failed":
      return "Google sign-in failed. Please try again.";
    default:
      return "OAuth sign-in failed. Please try again.";
  }
}

export function UserLoginPage() {
  const [, navigate] = useLocation();
  const {
    login,
    signup,
    user,
    isLoading,
    isSessionReady,
    setToken,
    refreshSession,
  } = useAuthStore();
  const { toast } = useToast();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  useEffect(() => {
    if (!isSessionReady || !user) {
      return;
    }

    navigate(user.isAdmin ? "/admin/dashboard" : "/dashboard");
  }, [isSessionReady, navigate, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const oauthStatus = params.get("oauth");
    const reason = params.get("reason");

    if (!token && oauthStatus !== "error") {
      return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);

    if (token && oauthStatus === "success") {
      const completeOauthLogin = async () => {
        try {
          setToken(token);
          // Give the store a moment to update before refreshing session
          await new Promise(resolve => setTimeout(resolve, 0));
          await refreshSession();
          toast({
            title: "Success",
            description: "Signed in with Google successfully",
          });
        } catch (error) {
          toast({
            title: "Error",
            description:
              error instanceof Error
                ? error.message
                : "Failed to complete Google sign-in",
            variant: "destructive",
          });
        }
      };

      void completeOauthLogin();
      return;
    }

    if (oauthStatus === "error") {
      toast({
        title: "Error",
        description: getOauthErrorMessage(reason),
        variant: "destructive",
      });
    }
  }, [refreshSession, setToken, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === "signup") {
        await signup(email, name, password);
      } else {
        await login(email, password);
      }

      toast({
        title: "Success",
        description:
          mode === "signup"
            ? "Your account has been created"
            : "You have been logged in successfully",
      });
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Authentication failed",
        variant: "destructive",
      });
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleRedirecting(true);
    window.location.href = `${API_URL}/auth/google`;
  };

  const isSubmitDisabled =
    mode === "signup"
      ? isLoading || !email || !name || password.length < 8
      : isLoading || !email || !password;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-600"
              }`}
            >
              Sign Up
            </button>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold text-center">
              {mode === "signup" ? "Create Account" : "User Login"}
            </CardTitle>
            <CardDescription className="text-center">
              {mode === "signup"
                ? "Use email/password or Google OAuth to create your account"
                : "Sign in with email/password or continue with Google"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Full Name
                </label>
                <Input
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </label>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <Input
                type="password"
                placeholder={
                  mode === "signup" ? "Create a password" : "Enter your password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {mode === "signup" && (
                <p className="text-xs text-gray-500">Use at least 8 characters.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitDisabled}>
              <LogIn className="w-4 h-4 mr-2" />
              {isLoading
                ? mode === "signup"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "signup"
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isGoogleRedirecting}
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isGoogleRedirecting
              ? "Redirecting to Google..."
              : "Continue with Google"}
          </Button>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Google OAuth works after you set
            {" "}
            <code>GOOGLE_CLIENT_ID</code>
            ,
            {" "}
            <code>GOOGLE_CLIENT_SECRET</code>
            , and
            {" "}
            <code>GOOGLE_CALLBACK_URL</code>
            {" "}
            on the API server.
          </div>

          <div className="text-center text-sm text-gray-600">
            Are you an admin?{" "}
            <button
              onClick={() => navigate("/admin/login")}
              className="text-indigo-600 hover:underline font-medium"
            >
              Login here
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
