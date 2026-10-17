import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let user: { id: string; email?: string } | null = null;
  let authFailure = false;\n  let supabaseClient: Awaited<ReturnType<typeof createClient>> | undefined;

  try {
    const supabase = await createClient();
    const result = await supabase.auth.getUser();
    if (result.error) {
      // A missing/expired session should go back to login. Other auth errors
      // are rendered below rather than bubbling into a generic Vercel 500.
      if (!result.data.user) {
        if (/missing authorization|session missing|jwt expired|invalid token/i.test(result.error.message)) {
          redirect('/login');
        }
        authFailure = true;
      } else {
        user = result.data.user;
      }
    } else {
      user = result.data.user;
    }
  } catch (error) {
    // Next.js redirect() throws by design; let redirects pass through.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
    ) {
      throw error;
    }
    authFailure = true;
  }

  if (authFailure) {
    return (
      <div className="login-form-side" style={{ minHeight: '100vh' }}>
        <div className="login-form-card">
          <div className="brand-mark" style={{ background: '#edf7f1', color: '#123b28' }}>✚</div>
          <h2 style={{ marginTop: 16 }}>Unable to verify your session</h2>
          <p>Supabase Auth could not be reached or did not return a valid response. Check the Supabase project status and Vercel environment variables, then reload this page.</p>
          <div className="notice notice-amber">
            Confirm <b>NEXT_PUBLIC_SUPABASE_URL</b> and <b>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</b> in Vercel, and verify the database migration has been applied in Supabase SQL Editor.
          </div>
          <a className="btn btn-primary" href="/login">Back to sign in</a>
        </div>
      </div>
    );
  }

  if (!user) redirect('/login');

  let role: 'owner' | 'staff' = 'owner';
  let label = user.email || 'Authorized shopkeeper';
  if (supabaseClient) {
    try {
      const { data: membership, error: membershipError } = await supabaseClient
        .from('staff_memberships')
        .select('display_name, is_active')
        .eq('member_user_id', user.id)
        .maybeSingle();
      if (!membershipError && membership) {
        if (!membership.is_active) {
          await supabaseClient.auth.signOut();
          redirect('/login?access=disabled');
        }
        role = 'staff';
        label = membership.display_name || user.email || 'Staff member';
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')) {
        throw error;
      }
      // Ignore staff-table lookup failures until the optional staff migration is applied.
    }
  }

  return <AppShell email={label} role={role}>{children}</AppShell>;
}
