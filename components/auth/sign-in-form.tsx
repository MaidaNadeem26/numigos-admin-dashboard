'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './sign-in-form.module.css';

export default function SignInForm({ permissionDenied = false, configurationMissing = false }: { permissionDenied?: boolean; configurationMissing?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError(signInError?.message ?? 'Unable to sign in. Please try again.');
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      setError('Your profile could not be loaded. Please contact the administrator.');
      setIsLoading(false);
      return;
    }

    if (profile.role !== 'osa_admin') {
      await supabase.auth.signOut();
      setError('This dashboard is restricted to OSA administrators only.');
      setIsLoading(false);
      return;
    }

    router.push('/overview');
    router.refresh();
  };

  return (
    <section className={styles.card} aria-labelledby="sign-in-title">
      <header className={styles.heading}>
        <div className={styles.brandMark} aria-hidden="true">N</div>
        <h1 id="sign-in-title" className={styles.title}>NUMIGOS</h1>
        <p className={styles.subtitle}>OSA Admin Dashboard</p>
        <p className={styles.description}>Sign in to manage societies, events, and students.</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.fieldGroup}>
          <label htmlFor="email" className={styles.label}>
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
            placeholder="osa.admin@nutech.edu.pk"
            required
          />
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={styles.input}
            placeholder="••••••••"
            required
          />
        </div>

        {error || permissionDenied || configurationMissing ? (
          <div className={`${styles.message} ${configurationMissing && !error ? styles.warning : ''}`} role={configurationMissing && !error ? 'status' : 'alert'} aria-live="polite">
            {error || (permissionDenied
              ? 'Access denied. This dashboard is restricted to OSA administrators. Your session was signed out.'
              : 'Supabase is not configured. Add the two public Supabase values to `.env.local` and restart the app.')}
          </div>
        ) : null}

        <button type="submit" disabled={isLoading} className={styles.submit}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}
