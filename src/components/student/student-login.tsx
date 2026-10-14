"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function StudentLogin({ linkError = false }: { linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSending(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/student-callback?next=%2Fstudent%2Faccount`,
          data: { full_name: name.trim() },
        },
      });
      if (authError) throw authError;
      setMessage("Check your email for a secure sign-in link. Open it on this device to see your account.");
    } catch {
      setError("We couldn’t send the sign-in link. Check the email and try again.");
    } finally {
      setSending(false);
    }
  }

  return <section className="student-account-card">
    <span className="student-eyebrow">STUDENT ACCOUNT</span>
    <h1>Keep your print history.</h1>
    <p>Sign in with an email link to save new paid orders to your account and see them again later.</p>
    {linkError && <p className="student-account-error" role="alert">That sign-in link expired or was already used. Request a fresh one below.</p>}
    <form className="student-account-form" onSubmit={submit}>
      <label htmlFor="student-account-name">Your name</label>
      <input id="student-account-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={100} placeholder="Sahej Grover" />
      <label htmlFor="student-account-email">Email address</label>
      <input id="student-account-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} placeholder="you@example.com" />
      {error && <p className="student-account-error" role="alert">{error}</p>}
      {message && <p className="student-account-success" role="status">{message}</p>}
      <button type="submit" disabled={sending}>{sending ? "Sending link…" : "Email me a sign-in link"}<span>→</span></button>
    </form>
    <p className="student-account-footnote">No password to remember. Ordering stays available without an account.</p>
  </section>;
}
