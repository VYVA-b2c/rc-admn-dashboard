import { useState } from "react";
import { Navigate } from "react-router-dom";
import vyvaLogo from "@/assets/logo-with-bg.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const { user, signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Login failed", { description: error.message });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast.error("Failed to send reset email", { description: error.message });
    } else {
      toast.success("Password reset email sent", { description: "Check your inbox for the reset link." });
      setShowForgot(false);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src={vyvaLogo} alt="VYVA" className="mx-auto mb-4 h-20 w-auto rounded-2xl shadow-lg" />
          <p className="text-muted-foreground mt-1">Super Admin Dashboard</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle className="font-display">
              {showForgot ? "Reset Password" : "Sign In"}
            </CardTitle>
            <CardDescription>
              {showForgot
                ? "Enter your email to receive a password reset link."
                : "Enter your credentials to access the dashboard."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={showForgot ? handleForgotPassword : handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@vyva.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {!showForgot && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loading..." : showForgot ? "Send Reset Link" : "Sign In"}
              </Button>
            </form>
            <button
              onClick={() => setShowForgot(!showForgot)}
              className="mt-4 block w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {showForgot ? "Back to Sign In" : "Forgot password?"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
