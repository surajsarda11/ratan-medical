'use client';

import { useActionState } from 'react';
import { inviteStaffAction, toggleStaffAccessAction, type ActionState } from '@/lib/actions';

export type StaffMember = {
  id: string;
  member_user_id: string;
  display_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

export default function StaffManagement({ staff, migrationReady }: { staff: StaffMember[]; migrationReady: boolean }) {
  const [state, action, pending] = useActionState(inviteStaffAction, {} as ActionState);

  return <div className="stack">
    {!migrationReady && <div className="notice notice-amber">
      <strong>One-time database update required.</strong>
      <p>Run <code>supabase/migrations/202610180002_staff_quick_booking.sql</code> in Supabase SQL Editor, then refresh this page.</p>
    </div>}

    <section className="card card-pad">
      <div className="card-title">Invite a staff member</div>
      <p className="card-description">An invitation email lets each team member create their own password. Never share the owner login.</p>
      <form action={action} className="stack" style={{ gap: 13, marginTop: 16 }}>
        <div className="form-grid">
          <div className="field"><label htmlFor="staff_display_name">Staff name *</label><input className="input" id="staff_display_name" name="display_name" placeholder="e.g. Rahul" maxLength={100} required disabled={!migrationReady} /></div>
          <div className="field"><label htmlFor="staff_email">Email address *</label><input className="input" id="staff_email" name="email" type="email" placeholder="staff@example.com" maxLength={254} required disabled={!migrationReady} /></div>
        </div>
        {state.error && <div className="error-text">{state.error}</div>}
        {state.success && <div className="notice notice-green">{state.success}</div>}
        <div><button className="btn btn-primary" type="submit" disabled={pending || !migrationReady}>{pending ? 'Sending invitation…' : 'Send staff invitation →'}</button></div>
      </form>
      <div className="tiny muted" style={{ marginTop: 13 }}>Invitations depend on Supabase email delivery and the allowed redirect URL being configured.</div>
    </section>

    <section className="card">
      <div className="card-header"><div><div className="card-title">Staff access</div><div className="card-description">{staff.length} member{staff.length === 1 ? '' : 's'} linked to this shop</div></div></div>
      {staff.length === 0 ? <div className="empty-state">No staff members added yet. Invite the first staff member above.</div> : <div className="table-wrap"><table><thead><tr><th>Staff member</th><th>Email</th><th>Status</th><th>Access</th></tr></thead><tbody>
        {staff.map((member) => <tr key={member.id}>
          <td><div className="table-primary">{member.display_name}</div><div className="table-secondary">Added {new Date(member.created_at).toLocaleDateString('en-IN')}</div></td>
          <td>{member.email}</td>
          <td><span className={member.is_active ? 'status status-green' : 'status status-amber'}>{member.is_active ? 'Active' : 'Disabled'}</span></td>
          <td><form action={toggleStaffAccessAction}><input type="hidden" name="staff_user_id" value={member.member_user_id} /><input type="hidden" name="next_active" value={member.is_active ? 'false' : 'true'} /><button type="submit" className={member.is_active ? 'btn btn-danger btn-small' : 'btn btn-secondary btn-small'}>{member.is_active ? 'Disable' : 'Re-enable'}</button></form></td>
        </tr>)}
      </tbody></table></div>}
    </section>

    <section className="card card-pad">
      <div className="card-title">Staff permissions</div>
      <div className="stack" style={{ gap: 10, marginTop: 13 }}>
        <div className="check-line"><span>✓</span><span>Create medicine bookings and record any advance actually received.</span></div>
        <div className="check-line"><span>✓</span><span>See only bookings that they personally created.</span></div>
        <div className="check-line"><span>—</span><span>Cannot access supplier imports, stock allocations, verified MRP, settlements, refunds, shop settings or staff management.</span></div>
      </div>
    </section>
  </div>;
}
