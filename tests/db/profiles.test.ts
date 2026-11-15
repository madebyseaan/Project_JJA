import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createStaffUser, deleteUser, getAnonClient, getServiceClient } from '../setup/db';

const password = 'test-password-123';

type TestUser = {
  id: string;
  email: string;
  password: string;
};

let dad: TestUser;
let uncle: TestUser;

beforeAll(async () => {
  const stamp = Date.now();

  dad = await createStaffUser({
    email: `dad-${stamp}@example.com`,
    password,
    displayName: 'Dad Test',
    role: 'owner',
  });

  uncle = await createStaffUser({
    email: `uncle-${stamp}@example.com`,
    password,
    displayName: 'Uncle Test',
    role: 'mechanic',
  });
});

afterAll(async () => {
  if (dad) await deleteUser(dad.id);
  if (uncle) await deleteUser(uncle.id);
});

describe('profiles', () => {
  it('creates a profile from the auth user and keeps the default mechanic role', async () => {
    const { data, error } = await getServiceClient()
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', uncle.id)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: uncle.id,
      display_name: 'Uncle Test',
      role: 'mechanic',
    });
  });

  it('stores the owner role when the service role sets it', async () => {
    const { data, error } = await getServiceClient()
      .from('profiles')
      .select('role')
      .eq('id', dad.id)
      .single();

    expect(error).toBeNull();
    expect(data?.role).toBe('owner');
  });

  it('hides profiles from the anon role', async () => {
    const { data, error } = await getAnonClient().from('profiles').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets signed-in staff read profiles', async () => {
    const client = getAnonClient();
    const { error: signInError } = await client.auth.signInWithPassword({
      email: uncle.email,
      password,
    });

    expect(signInError).toBeNull();

    const { data, error } = await client.from('profiles').select('id').order('id');

    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(2);
  });

  it('does not let a signed-in client change roles', async () => {
    const client = getAnonClient();
    await client.auth.signInWithPassword({ email: uncle.email, password });

    const { data, error } = await client
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', uncle.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: after } = await getServiceClient()
      .from('profiles')
      .select('role')
      .eq('id', uncle.id)
      .single();

    expect(after?.role).toBe('mechanic');
  });
});
