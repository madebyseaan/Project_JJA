import { z } from 'zod';

import { isValidEmployeeId } from '@/lib/staff-identity';

export const loginSchema = z.object({
  employeeId: z
    .string()
    .trim()
    .min(1, 'Enter your employee ID.')
    .refine(isValidEmployeeId, 'Enter a valid employee ID (e.g., JJA-001).'),
  password: z.string().min(1, 'Enter your password.'),
});

export type LoginValues = z.infer<typeof loginSchema>;
