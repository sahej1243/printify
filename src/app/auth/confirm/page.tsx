"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthState = "loading" | "ready" | "invalid";

export default function ConfirmShopInvitePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function establishSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) {
            setError("This invitation link has expired or has already been used. Ask the Printify admin to send a new invite.");
            setAuthState("invalid");
          }
          return;
        }
      } else {
        const hash = new URLSearchParams(url.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            if (active) {
              setError("This invitation link has expired or has already been used. Ask the Printify admin to send a new invite.");
              setAuthState("invalid");
            }
            return;
          }
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError || !data.session) {
        setError("We couldn't verify this invitation link. Ask the Printify admin to send a new invite.");
        setAuthState("invalid");
        return;
      }

      // Remove one-time auth values from the address bar after Supabase stores the session.
      window.history.replaceState(null, "", window.location.pathname);
      setAuthState("ready");
    }

    establishSession().catch(() => {
      if (active) {
        setError("We couldn't verify this invitation link. Ask the Printify admin to send a new invite.");
        setAuthState("invalid");
      }
    });

    return () => { active = false; };
  }, []);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords don't match.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("We couldn't save that password. Please try again.");
      setSaving(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="shop-login-page">
    <header className="shop-login-header"><div className="student-brand"><span className="student-brand-mark"><span /></span>printify<span className="student-brand-dot">.</span></div></header>
    <section className="shop-login-card">
      <span className="student-eyebrow">PRINTIFY FOR SHOPS</span>
      <h1>{authState === "ready" ? "Set your password." : "Accept your invitation."}</h1>
      {authState === "loading" && <p>Verifying your secure invitation…</p>}
      {authState === "invalid" && <>
        <p className="shop-login-error" role="alert">{error}</p>
        <Link className="shop-login-home" href="/shop/login">Return to shop sign in <span>→</span></Link>
      </>}
      {authState === "ready" && <>
        <p>Choose a password for your shop owner account.</p>
        <form onSubmit={setPassword} className="shop-login-form">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={256} />
          <label htmlFor="confirm-password">Confirm password</label>
          <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={256} />
          {error && <p className="shop-login-error" role="alert">{error}</p>}
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Set password"}</button>
        </form>
      </>}
    </section>
    <footer className="shop-login-footer">Printify <span>·</span> Shopkeeper portal</footer>
  </main>;
}
