import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getServerAdminProfile() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'osa_admin') {
    return null;
  }

  return {
    user,
    profile: {
      ...profile,
      full_name: profile.full_name || profile.email || 'OSA Admin',
    },
  };
}
