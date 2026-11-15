import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppError } from '@/lib/errors';
import { FullPageLoading } from '@/components/FullPageLoading';

import { loginSchema, type LoginValues } from './schemas';
import { useAuth } from './use-auth';

export function LoginPage() {
  const { status, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (status === 'signed-in') {
      navigate('/', { replace: true });
    }
  }, [status, navigate]);

  if (status === 'loading' || status === 'signed-in') {
    return <FullPageLoading />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signIn(values.email, values.password);
    } catch (error) {
      if (error instanceof AppError) {
        setFormError(error.message);
        return;
      }

      setFormError('Could not sign in. Try again.');
    }
  });

  const message = formError ?? authError;

  return (
    <main className="bg-paper min-h-screen md:grid md:grid-cols-[1.1fr_1fr]">
      <section className="bg-ink text-paper hidden flex-col justify-between p-10 md:flex">
        <BrandMark className="text-paper size-12" title="Motor Works" />

        <div>
          <p className="border-safety text-paper/70 mb-4 border-l-4 pl-3 text-sm">Staff access</p>
          <h1 className="font-display text-paper text-6xl leading-[0.95] font-bold tracking-tight">
            The bay,
            <br />
            in order.
          </h1>
          <p className="text-paper/70 mt-5 max-w-sm">
            Tickets, stock, and receipts for the shop. One ledger, no loose ends.
          </p>
        </div>

        <p className="text-paper/50 text-xs">Motor Works POS · Philippines</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:min-h-0">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <BrandMark className="size-12" title="Motor Works" />
            <p className="font-display mt-4 text-2xl font-bold tracking-tight">Motor Works POS</p>
          </div>

          <h2 className="font-display text-3xl font-bold tracking-tight">Sign in</h2>
          <p className="text-ink-soft mt-1 text-sm">Staff access only.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email?.message ? (
                <p id="email-error" className="text-danger text-sm">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              {errors.password?.message ? (
                <p id="password-error" className="text-danger text-sm">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            {message ? (
              <p
                role="alert"
                className="border-danger/30 bg-danger/10 text-danger border px-3 py-2 text-sm"
              >
                {message}
              </p>
            ) : null}

            <Button className="w-full" size="touch" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-steel mt-6 text-xs">
            Accounts are created by the shop owner. If you need access, ask the owner.
          </p>
        </div>
      </section>
    </main>
  );
}
