import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import StaffManagement, { type StaffMember } from '@/components/staff-management';

export default async function StaffPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownMembership } = await supabase
    .from('staff_memberships')
    .select('id, is_active')
    .eq('member_user_id', user.id)
    .maybeSingle();

  if (ownMembership?.is_active) redirect('/staff-booking');
  if (ownMembership && !ownMembership.is_active) {
    await supabase.auth.signOut();
    redirect('/login?access=disabled');
  }

  const { data, error } = await supabase
    .from('staff_memberships')
    .select('id, member_user_id, display_name, email, is_active, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return <>
    <div className="page-heading"><div><div className="kicker">TEAM ACCESS</div><h1>Staff members</h1><p>Invite staff with their own secure login. Staff can register bookings quickly without access to settlement or stock controls.</p></div></div>
    <StaffManagement staff={(data || []) as StaffMember[]} migrationReady={!error} />
  </>;
}
