import SignInForm from '@/components/auth/sign-in-form';

export default function SignInPage({ searchParams }: { searchParams?: { error?: string } }) {
  const permissionDenied = searchParams?.error === 'permission';
  const configurationMissing = searchParams?.error === 'config';

  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas p-4">
      <SignInForm permissionDenied={permissionDenied} configurationMissing={configurationMissing} />
    </main>
  );
}
