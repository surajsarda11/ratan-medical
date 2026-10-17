import SetPasswordForm from '@/components/set-password-form';

export default function SetPasswordPage() {
  return <div className="login-form-side" style={{ minHeight: '100vh' }}>
    <div className="login-form-card" style={{ width: '100%', maxWidth: 430 }}>
      <div className="brand-mark" style={{ background: '#edf7f1', color: '#123b28' }}>✚</div>
      <div className="kicker" style={{ marginTop: 18 }}>RATAN MEDICAL HALL</div>
      <h2 style={{ marginTop: 8 }}>Set your staff password</h2>
      <p>Choose a private password for your staff login. Do not share it with other team members.</p>
      <SetPasswordForm />
    </div>
  </div>;
}
