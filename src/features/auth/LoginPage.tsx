import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, Loader2, LockKeyhole, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { FullPageLoading } from '@/components/FullPageLoading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useManilaClock } from '@/hooks/use-manila-clock';
import { AppError } from '@/lib/errors';
import { formatEmployeeIdInput } from '@/lib/staff-identity';

import { BrandPanel } from './BrandPanel';
import { MobileBrandHeader } from './MobileBrandHeader';
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
    defaultValues: { employeeId: '', password: '' },
  });

  const employeeIdField = register('employeeId');

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
      await signIn(values.employeeId, values.password);
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
      <BrandPanel
        manilaTime={manilaTime}
        eyebrow="Staff access"
        title={
          <>
            <span className="bg-safety text-ink inline-block px-2 py-0.5">The bay,</span>
            <br />
            in order.
          </>
        }
        description={
          <>
            Tickets, stock, and receipts for the shop.{' '}
            <span className="xl:block">One ledger, no loose ends.</span>
          </>
        }
      />

      <section className="flex min-h-screen items-center justify-center px-5 py-10 md:min-h-0 md:px-6 xl:px-12">
        <div className="w-full max-w-md xl:max-w-lg">
          <MobileBrandHeader manilaTime={manilaTime} />

          <div className="border-line bg-paper border p-5 md:p-6 xl:p-8">
            <div className="border-line flex items-center gap-3 border-b pb-5">
              <span className="border-line bg-soft text-safety flex size-10 items-center justify-center border">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">Staff portal</p>
                <p className="text-steel text-xs">Sign in with your employee ID.</p>
              </div>
            </div>

            <h1 className="font-display mt-6 text-4xl font-bold tracking-tight xl:text-5xl">
              Sign in
            </h1>
            <p className="text-ink-soft mt-1 text-base">Staff access only.</p>

            <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="employee-id" className="text-base">
                  Employee ID
                </Label>
                <div className="relative">
                  <UserRound
                    className="text-steel pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    id="employee-id"
                    type="text"
                    autoComplete="username"
                    inputMode="text"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="JJA-001"
                    maxLength={20}
                    className="pl-10 uppercase"
                    aria-invalid={errors.employeeId ? true : undefined}
                    aria-describedby={errors.employeeId ? 'employee-id-error' : undefined}
                    {...employeeIdField}
                    onChange={(event) => {
                      event.target.value = formatEmployeeIdInput(event.target.value);
                      void employeeIdField.onChange(event);
                    }}
                  />
                </div>
                {errors.employeeId?.message ? (
                  <p id="employee-id-error" className="text-danger text-sm">
                    {errors.employeeId.message}
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
