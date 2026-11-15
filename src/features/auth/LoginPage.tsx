import { zodResolver } from '@hookform/resolvers/zod';
import {
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Package,
  Receipt,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { BrandMark } from '@/components/BrandMark';
import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useManilaClock } from '@/hooks/use-manila-clock';
import { AppError } from '@/lib/errors';

import { loginSchema, type LoginValues } from './schemas';
import { useAuth } from './use-auth';

export function LoginPage() {
  const { status, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const manilaTime = useManilaClock();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      <section className="bg-ink text-paper relative hidden overflow-hidden p-8 md:flex xl:p-12">
        <div aria-hidden="true" className="blueprint-grid pointer-events-none absolute inset-0" />

        <div className="relative mx-auto grid h-full w-full max-w-[40rem] grid-rows-[auto_1fr_auto]">
          <BrandMark
            className="size-16 xl:size-24"
            title="J.J.A Motor Accessories and Motorcycle Repair"
          />

          <div className="flex flex-col justify-center py-10">
            <p className="border-safety text-paper/70 mb-5 border-l-4 pl-3 text-sm md:text-base">
              Staff access
            </p>
            <h1 className="font-display text-paper text-[clamp(3.25rem,6vw,7rem)] leading-[0.9] font-bold tracking-tight">
              <span className="bg-safety text-ink inline-block px-2 py-0.5">The bay,</span>
              <br />
              in order.
            </h1>
            <p className="text-paper/70 mt-6 max-w-[26rem] text-base md:text-lg xl:text-xl">
              Tickets, stock, and receipts for the shop.{' '}
              <span className="xl:block">One ledger, no loose ends.</span>
            </p>

            <div className="text-paper/60 mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm xl:text-base">
              <span className="inline-flex items-center gap-2">
                <Wrench className="text-brand-red size-4" aria-hidden="true" />
                Bay
              </span>
              <span className="inline-flex items-center gap-2">
                <Package className="text-brand-blue size-4" aria-hidden="true" />
                Stock
              </span>
              <span className="inline-flex items-center gap-2">
                <Receipt className="text-brand-gold size-4" aria-hidden="true" />
                Receipts
              </span>
            </div>
          </div>

          <div className="border-paper/10 text-paper/50 flex items-center justify-between gap-4 border-t pt-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex h-1 w-9 overflow-hidden" aria-hidden="true">
                <span className="bg-brand-red h-full w-1/3" />
                <span className="bg-brand-blue h-full w-1/3" />
                <span className="bg-brand-gold h-full w-1/3" />
              </span>
              <span>J.J.A · Est. 2023</span>
            </div>
            <span className="font-mono text-[11px]">Manila · {manilaTime}</span>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:min-h-0 md:px-6 xl:px-12">
        <div className="w-full max-w-md xl:max-w-lg">
          <div className="mb-8 flex items-start justify-between gap-4 md:hidden">
            <div className="flex items-start gap-3">
              <BrandMark
                className="size-14"
                title="J.J.A Motor Accessories and Motorcycle Repair"
              />
              <div>
                <p className="font-display text-2xl leading-tight font-bold tracking-tight">
                  J.J.A
                </p>
                <p className="text-steel text-xs">Motor Accessories &amp; Repair</p>
              </div>
            </div>
            <span className="text-steel font-mono text-xs">Manila · {manilaTime}</span>
          </div>

          <div className="border-line bg-paper border p-5 md:p-6 xl:p-8">
            <div className="border-line flex items-center gap-3 border-b pb-5">
              <span className="border-line bg-soft text-safety flex size-10 items-center justify-center border">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Staff portal</p>
                <p className="text-steel text-xs">Sign in with your shop account.</p>
              </div>
            </div>

            <h2 className="font-display mt-6 text-4xl font-bold tracking-tight xl:text-5xl">
              Sign in
            </h2>
            <p className="text-ink-soft mt-1 text-base">Staff access only.</p>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-base">
                  Email
                </Label>
                <div className="relative">
                  <Mail
                    className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    {...register('email')}
                  />
                </div>
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
                <div className="relative">
                  <LockKeyhole
                    className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="pr-12 pl-10"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    {...register('password')}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-steel absolute top-1 right-1 size-10"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
                {errors.password?.message ? (
                  <p id="password-error" className="text-danger text-sm">
                    {errors.password.message}
                  </p>
                ) : null}
              </div>

              {message ? (
                <p
                  role="alert"
                  className="border-danger/30 bg-danger/10 text-danger flex items-start gap-2 border px-3 py-2 text-sm"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{message}</span>
                </p>
              ) : null}

              <Button
                className="h-14 w-full text-base"
                size="touch"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="border-line text-steel mt-6 border-t pt-4 text-xs">
              Need access? Ask the shop owner.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
