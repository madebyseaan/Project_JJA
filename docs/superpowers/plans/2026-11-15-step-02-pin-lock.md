# Step 02 — PIN Lock and Idle Lock

> **Delivery order:** `docs/roadmap.md`. Work only on this step until Sean approves.
> **Spec:** `docs/spec.md` sections 5, 13.2.
> **Design:** `docs/design.md` sections 4, 7, 8.

**Goal:** After a real sign-in, the staff member sets a 4-digit PIN. The app locks after 5 minutes idle or on demand. Five wrong PINs clear the PIN and sign the user out. No PIN is ever sent to the server.

---

## Files

```text
src/
  features/auth/
    pin.ts
    pin-lock-context.ts
    use-pin-lock.ts
    PinLockProvider.tsx
    PinPad.tsx
    LockPage.tsx
    BrandPanel.tsx
    MobileBrandHeader.tsx
  hooks/
    use-idle-lock.ts
  app/
    RequireUnlocked.tsx
    router.tsx
    StaffHomePage.tsx
    AuthProvider.tsx
tests/
  unit/
    pin.test.ts
    idle-lock.test.ts
    pin-pad.test.tsx
    lock-page.test.tsx
    require-unlocked.test.tsx
    pin-lock-provider.test.tsx
    staff-home.test.tsx
    auth-provider.test.tsx
```

---

## Interfaces

```ts
type PinRecord = { salt: string; hash: string; attempts: number };

getPinRecord(userId: string): PinRecord | null;

savePin(userId: string, pin: string): Promise<void>;

verifyPin(pin: string, record: PinRecord): Promise<boolean>;

clearPin(userId: string): void;

recordFailedAttempt(userId: string): number;

resetAttempts(userId: string): void;

type UnlockResult =
  | { ok: true }
  | { ok: false; attemptsLeft: number; lockedOut: boolean };

type PinLockContextValue = {
  unlocked: boolean;
  hasPin: boolean;
  lock: () => void;
  setPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<UnlockResult>;
  clearPinAndSignOut: () => Promise<void>;
};
```

---

## Task 1 — PIN storage

- [x] Store a record in `localStorage` under `jja.pin.<userId>`.
- [x] Salt: 16 random bytes as hex. Hash: SHA-256 of `salt + ':' + pin`, hex.
- [x] `savePin` validates `^\d{4}$` and resets attempts.
- [x] `verifyPin` uses a constant-time-ish comparison.
- [x] `recordFailedAttempt` increments and returns the new count.
- [x] Tests: round-trip, wrong PIN, two salts produce different hashes, attempts increment, reset clears attempts.

## Task 2 — Idle lock hook

- [x] `useIdleLock(timeoutMs, onLock, enabled)`.
- [x] Resets on `pointerdown`, `keydown`, `touchstart`, `mousemove`, `scroll`.
- [x] Clears on unmount or when disabled.
- [x] Tests with fake timers: fires after the timeout, activity resets it, disabled does nothing.

## Task 3 — PIN pad

- [x] Four dots for entered digits.
- [x] Buttons 1–9, 0, and a backspace; 64px tall.
- [x] Disabled state; accessible labels.
- [x] Calls `onComplete(pin)` at four digits.
- [x] Tests: typing, backspace, completion, disabled.

## Task 4 — Lock provider

- [x] `PinLockProvider` inside the router, using `useAuth` and `useNavigate`.
- [x] `unlocked` starts false in memory, so a refresh requires the PIN again.
- [x] `hasPin` read from `localStorage` for the current profile.
- [x] `lock()` sets unlocked false and goes to `/lock`.
- [x] `setPin` saves and unlocks.
- [x] `unlock` verifies; on failure increments attempts. At 5, clear the PIN, sign out, show a toast, and go to `/login`.
- [x] `clearPinAndSignOut` clears the PIN and signs out (forgot-PIN recovery).
- [x] Idle lock runs only while signed in and unlocked.
- [x] Tests: 5 attempts locks out, success resets attempts, setPin marks hasPin/unlocked.

## Task 5 — Lock screen

- [x] Setup flow: “Set a 4-digit PIN”, then confirm; mismatch resets.
- [x] Unlock flow: staff name, employee ID, Manila clock, PIN pad, attempts message.
- [x] “Forgot PIN? Sign in with password” clears the PIN and signs out.
- [x] Loading and signed-out states.
- [x] Tests for setup, mismatch, wrong PIN, correct PIN, forgot PIN.

## Task 6 — Routing and staff home

- [x] Wrap routes in `PinLockProvider`.
- [x] `RequireUnlocked` redirects signed-in-but-locked users to `/lock`.
- [x] `/lock` is reachable while signed in; signed-out users go to `/login`.
- [x] Add a Lock button to the staff home.
- [x] Tests: locked redirect, unlocked render, manual lock.

## Task 7 — Session expiry

- [x] AuthProvider distinguishes a natural `SIGNED_OUT` from a manual sign-out.
- [x] Natural expiry shows “Your session expired. Sign in again.” on the login page.
- [x] Test the message.

## Task 8 — Verify and demo

- [x] `npm run check`.
- [x] Screenshots at 390px, 768px, and 1920px for setup, unlock, and error in `docs/screenshots/step-02-pin-*.png`.
- [x] Setup, unlock, wrong PIN, and correct PIN exercised in the browser. The idle lock is covered by the fake-timer test; the live 5-minute wait belongs to Sean's review.
- [x] Update the roadmap to **In review**.
- [x] Stop for Sean's polish. Do not start Step 03.

---

## Verification

- `npm run check`: typecheck, lint, format, size check, 56 unit tests (15 files), and the production build pass.
- Database tests and E2E were not run because Docker is unavailable on this machine. No database touched this step.
- Browser checks used temporary PIN records. Sean's record was backed up and restored untouched.

## Review fix — cross-tab PIN state

A tab opened before the PIN was set kept showing **Set your PIN** from its own stale state. Entering any PIN twice there saved it and unlocked, which looks like a wrong PIN being accepted. The provider now re-reads the PIN record on `storage`, `focus`, and `visibilitychange`, and the lock page resets its setup stage when the PIN appears or disappears. A missing PIN at unlock time signs the tab out with a clear message instead of falling into setup. The setup write also refuses to overwrite a PIN that appeared in another tab.

Regression tests:

- a PIN set in another tab flips `hasPin` without a reload,
- a PIN removed before unlock signs out,
- a stale setup tab cannot overwrite an existing PIN,
- the real provider + lock page reject a wrong PIN and stay on `/lock`.

**Gate:** Sean must say **approved** before Step 03.
