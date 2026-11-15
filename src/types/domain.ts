export type Role = 'owner' | 'mechanic';

export type Profile = {
  id: string;
  employeeId: string;
  displayName: string;
  role: Role;
};

export type AuthState =
  | { status: 'loading'; profile: null }
  | { status: 'signed-out'; profile: null }
  | { status: 'signed-in'; profile: Profile };
