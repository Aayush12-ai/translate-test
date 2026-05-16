import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import { Lock, LogIn } from "lucide-react";

export function AdminLoginPage() {
  const [, navigate] = useLocation();
  const { adminLogin, isLoading, isSessionReady, user } = useAuthStore();
  const { toast } = useToast();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!isSessionReady || !user?.isAdmin) {
      return;
    }

    navigate("/admin/dashboard");
  }, [isSessionReady, navigate, user]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminLogin(key);
      toast({
        title: "Success",
        description: "Admin login successful",
      });
      navigate("/admin/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid admin key",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-700 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-2">
            <div className="bg-red-100 p-3 rounded-full">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Enter your admin key to access the dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Admin Key
              </label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="Enter your admin key"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700"
              disabled={isLoading || !key}
            >
              <LogIn className="w-4 h-4 mr-2" />
              {isLoading ? "Logging in..." : "Login as Admin"}
            </Button>
          </form>

          <div className="text-center text-sm text-gray-600">
            Not an admin?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-indigo-600 hover:underline font-medium"
            >
              User login
            </button>
          </div>

          <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              <strong>Note:</strong> Only authorized administrators can access this area.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
