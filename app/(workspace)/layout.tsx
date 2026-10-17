import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { createClient } from '@/lib/supabase/server';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let supabase;
  try { supabase = await createClient(); }
  catch (error) {
    return <div className="login-form-side" style={{minHeight:'100vh'}}><div className="login-form-card"><div className="brand-mark" style={{background:'#edf7f1',color:'#123b28'}}>✚</div><h2 style={{marginTop:16}}>Finish Supabase setup</h2><p>This project is ready to run, but its database connection is not configured yet.</p><div className="notice notice-amber">Add <b>NEXT_PUBLIC_SUPABASE_URL</b> and <b>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</b> to <code>.env.local</code> (or Vercel Environment Variables), run the SQL migration in <code>supabase/migrations</code>, then reload this page.</div><p className="tiny" style={{marginTop:16}}>Setup detail: {error instanceof Error ? error.message : 'Supabase credentials are missing.'}</p><a className="btn btn-primary" href="/login">Open sign in</a></div></div>;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <AppShell email={user.email || 'Authorized shopkeeper'}>{children}</AppShell>;
}
