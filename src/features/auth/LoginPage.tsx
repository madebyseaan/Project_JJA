import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { BrandMark } from '@/components/BrandMark';
import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AppError } from '@/lib/errors';

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
    <main className="bg-paper min-h-screen md:grid md:grid-cols-[1.05fr_0.95fr]">
      <section className="bg-ink text-paper hidden p-8 md:flex xl:p-12">
        <div className="mx-auto grid h-full w-full max-w-[40rem] grid-rows-[auto_1fr_auto]">
          <BrandMark className="text-paper size-12 xl:size-14" title="Motor Works" />

          <div className="flex flex-col justify-center py-10">
            <p className="border-safety text-paper/70 mb-5 border-l-4 pl-3 text-sm md:text-base">
              Staff access
            </p>
            <h1 className="font-display text-paper text-[clamp(3.25rem,6vw,7rem)] leading-[0.9] font-bold tracking-tight">
              The bay,
              <br />
              in order.
            </h1>
            <p className="text-paper/70 mt-6 max-w-[26rem] text-base md:text-lg xl:text-xl">
              Tickets, stock, and receipts for the shop.{' '}
              <span className="xl:block">One ledger, no loose ends.</span>
            </p>
          </div>

          <p className="text-paper/50 text-xs">Motor Works POS · Philippines</p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:min-h-0 md:px-8 xl:px-12">
        <div className="w-full max-w-md xl:max-w-lg">
          <div className="mb-8 md:hidden">
            <BrandMark className="size-12" title="Motor Works" />
            <p className="font-display mt-4 text-2xl font-bold tracking-tight">Motor Works POS</p>
          </div>

          <h2 className="font-display text-4xl font-bold tracking-tight xl:text-5xl">Sign in</h2>
          <p className="text-ink-soft mt-2 text-base">Staff access only.</p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email
              </Label>
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
              <Label htmlFor="password" className="text-base">
                Password
              </Label>
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

            <Button
              className="h-14 w-full text-base"
              size="touch"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-steel mt-8 text-sm">
            Accounts are created by the shop owner. If you need access, ask the owner.
          </p>
        </div>
      </section>
    </main>
  );
}
