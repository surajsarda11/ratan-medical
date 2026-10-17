'use client';

import { useState, type FormEvent } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function SetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('Use at least 10 characters for your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error('Authentication is not configured. Contact the shop owner.');

      const supabase = createBrowserClient(url, key);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      router.replace('/staff-booking');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The password could not be saved. Open the invitation link again or ask the owner to resend it.');
    } finally {
      setSaving(false);
    }
  }

  return <form className="stack" style={{ gap: 15 }} onSubmit={submit}>
    <div className="field">
      <label htmlFor="new_password">New password</label>
      <input className="input" id="new_password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required />
    </div>
    <div className="field">
      <label htmlFor="confirm_password">Confirm password</label>
      <input className="input" id="confirm_password" type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
    </div>
    {error && <div className="error-text">{error}</div>}
    <button className="btn btn-primary" style={{ width: '100%' }} disabled={saving} type="submit">{saving ? 'Saving password…' : 'Set password and continue →'}</button>
  </form>;
}
