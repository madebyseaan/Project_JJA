import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { employeeIdToEmail } from '@/lib/staff-identity';

config({ path: '.env.test.local' });

type TestEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

function getTestEnv(): TestEnv {
  const url = process.env.TEST_SUPABASE_URL;
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      'Database tests need TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, and TEST_SUPABASE_SERVICE_ROLE_KEY. Add them to .env.test.local. Never use production keys.',
    );
  }

  return { url, anonKey, serviceRoleKey };
}

export function getServiceClient(): SupabaseClient {
  const { url, serviceRoleKey } = getTestEnv();

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getAnonClient(): SupabaseClient {
  const { url, anonKey } = getTestEnv();

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type CreateStaffUserInput = {
  employeeId: string;
  password: string;
  displayName: string;
  role: 'owner' | 'mechanic';
};

export async function createStaffUser(input: CreateStaffUserInput): Promise<{
  id: string;
  employeeId: string;
  email: string;
  password: string;
}> {
  const service = getServiceClient();
  const email = employeeIdToEmail(input.employeeId);

  const { data, error } = await service.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  });

  if (error) {
    throw error;
  }

  if (input.role === 'owner') {
    const { error: updateError } = await service
      .from('profiles')
      .update({ role: 'owner' })
      .eq('id', data.user.id);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    id: data.user.id,
    employeeId: input.employeeId,
    email,
    password: input.password,
  };
}

export async function deleteUser(id: string): Promise<void> {
  const service = getServiceClient();
  const { error } = await service.auth.admin.deleteUser(id);

  if (error) {
    throw error;
  }
}

export async function signInAs(user: { email: string; password: string }): Promise<SupabaseClient> {
  const client = getAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw error;
  }

  return client;
}
