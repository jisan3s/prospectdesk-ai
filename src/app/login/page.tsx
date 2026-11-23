"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Brand, Alert } from "@/components/ui/primitives";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ConfirmationNotice() {
  const searchParams = useSearchParams();
  return searchParams.get("error") === "confirmation_failed"
    ? <Alert tone="error">The email confirmation link is invalid or expired. Open the latest confirmation email or try signing in.</Alert>
    : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setFeedbackTone("info");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        setFeedbackTone(error ? "error" : "success");
        setMessage(
          error
            ? error.message
            : "Check your email to confirm your account."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setFeedbackTone("error");
          setMessage(error.message);
        } else {
          router.replace("/");
          router.refresh();
        }
      }
    } catch {
      setFeedbackTone("error");
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8"><Brand /></div>
      <form
        onSubmit={handleSubmit}
        className="panel w-full max-w-md space-y-6 sm:p-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Welcome back." : "Your next chapter starts here."}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "login"
              ? "Sign in to your workspace"
              : "Create your workspace account"}
          </p>
        </div>

        <Suspense fallback={null}><ConfirmationNotice /></Suspense>

        <label className="block text-sm text-slate-700">
          Email
          <input
            disabled={loading}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
          />
        </label>

        <label className="block text-sm text-slate-700">
          Password
          <input
            disabled={loading}
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
          />
        </label>

        <button
          disabled={loading}
          className="button-primary w-full"
        >
          {loading
            ? "Processing..."
            : mode === "login"
              ? "Sign In"
              : "Create Account"}<ArrowRight size={17} aria-hidden="true"/>
        </button>

        {message && (
          <Alert tone={feedbackTone}>{message}</Alert>
        )}

        <button
          disabled={loading}
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMessage("");
          }}
          className="min-h-11 w-full text-sm font-medium text-indigo-700 disabled:opacity-50"
        >
          {mode === "login"
            ? "Create a new account"
            : "Already have an account? Sign in"}
        </button>
      </form>
      <p className="mt-7 flex items-center gap-2 text-xs text-slate-500"><Sparkles size={14} aria-hidden="true"/> Research with Scout. Connect with confidence.</p>
    </main>
  );
}
