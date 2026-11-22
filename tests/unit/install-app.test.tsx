import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { InstallAppDialog } from '@/features/pwa/InstallAppDialog';
import { isAndroidUserAgent, isIosUserAgent } from '@/features/pwa/use-install-prompt';

describe('install platform detection', () => {
  test('detects iPhone, iPad, and Android user agents', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(false);
    expect(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(true);
    expect(isAndroidUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
  });
});

function renderDialog(overrides: Partial<ComponentProps<typeof InstallAppDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onInstall = vi.fn(async () => true);

  render(
    <InstallAppDialog
      open
      onOpenChange={onOpenChange}
      canPrompt={false}
      installed={false}
      isIos={false}
      isAndroid={false}
      onInstall={onInstall}
      {...overrides}
    />,
  );

  return { onOpenChange, onInstall };
}

describe('InstallAppDialog', () => {
  test('shows iPhone Share instructions when the prompt is unavailable', () => {
    renderDialog({ isIos: true });

    expect(screen.getByText('Install J.J.A')).toBeInTheDocument();
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument();
  });

  test('shows the install button when the browser prompt is available', async () => {
    const user = userEvent.setup();
    const { onInstall } = renderDialog({ canPrompt: true });

    await user.click(screen.getByRole('button', { name: 'Install app' }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  test('shows an installed confirmation', () => {
    renderDialog({ installed: true });
    expect(screen.getByText('Already installed')).toBeInTheDocument();
  });
});
