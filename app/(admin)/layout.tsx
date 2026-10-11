import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { getServerAdminProfile } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getServerAdminProfile();

  if (!admin) {
    redirect('/sign-in');
  }

  return (
    <AdminShell adminName={admin.profile.full_name || admin.profile.email || 'OSA Admin'}>{children}</AdminShell>
  );
}
