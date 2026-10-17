'use client';
import { useActionState } from 'react';
import { loginAction, type ActionState } from '@/lib/actions';

const initialState: ActionState = {};
export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return <div className="login-shell">
    <section className="login-panel">
      <div>
        <div className="brand"><div className="brand-mark">✚</div><div><div className="brand-title">Ratan Medical Hall</div><div className="brand-subtitle">Booking & Settlement Manager</div></div></div>
        <div className="kicker" style={{color:'#a7d2b6',marginTop:48}}>A calmer way to manage orders</div>
        <h1>Every booking.<br />Every balance.<br /><span style={{color:'#9bd0aa'}}>Taken care of.</span></h1>
        <p>A private workspace for medicine bookings, supplier invoice matching, customer reminders and transparent settlements.</p>
        <div className="login-features">
          <div className="login-feature"><span className="login-feature-mark">✓</span>Track medicine arrivals and pickups</div>
          <div className="login-feature"><span className="login-feature-mark">₹</span>Keep advances and balances clear</div>
          <div className="login-feature"><span className="login-feature-mark">⇧</span>Reconcile purchase invoice CSVs</div>
          <div className="login-feature"><span className="login-feature-mark">↗</span>Prepare WhatsApp updates quickly</div>
        </div>
      </div>
      <div className="tiny" style={{color:'#a4c2af'}}>Private shopkeeper access · Customer data stays shop-scoped</div>
    </section>
    <section className="login-form-side">
      <div style={{width:'100%',maxWidth:430}}>
        <div className="mobile-brand"><div className="brand-mark" style={{background:'#edf7f1',color:'#123b28'}}>✚</div><div><div className="brand-title">Ratan Medical Hall</div><div className="brand-subtitle" style={{color:'#738279'}}>Booking & Settlement Manager</div></div></div>
        <div className="login-form-card">
          <div className="kicker">WELCOME BACK</div><h2>Sign in to your workspace</h2><p>Use the authorized shopkeeper account created in Supabase Authentication.</p>
          <form action={action} className="stack" style={{gap:15}}>
            <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" type="email" name="email" autoComplete="username" placeholder="shopkeeper@example.com" required /></div>
            <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required /></div>
            {state.error && <div className="error-text">{state.error}</div>}
            <button className="btn btn-primary" style={{width:'100%',padding:'12px 14px',marginTop:4}} disabled={pending} type="submit">{pending ? 'Signing in…' : 'Sign in securely'} <span>→</span></button>
          </form>
          <div className="divider" />
          <p className="tiny" style={{margin:0}}>Not configured yet? Follow the README to add your Supabase project and create an authorized user. Public sign-up is intentionally disabled.</p>
        </div>
        <div className="tiny muted" style={{textAlign:'center',marginTop:18}}>Medicine inventory support only. No diagnosis or substitution recommendations.</div>
      </div>
    </section>
  </div>;
}
