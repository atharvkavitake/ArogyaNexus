import type { Role } from '@prisma/client';

export const permissions = {
  PATIENT: ['profile:read', 'profile:write', 'appointments:manage', 'records:manage', 'consent:manage'],
  DOCTOR: ['appointments:manage', 'patient:read:consented', 'records:write:consented'],
  NURSE: ['appointments:read:facility', 'patient:read:consented', 'vitals:write:consented'],
  LAB_TECH: ['patient:read:consented', 'records:write:consented'],
  RECEPTIONIST: ['appointments:manage:facility', 'patient:read:demographics'],
  ADMIN: ['users:manage', 'doctors:verify', 'facilities:manage', 'audit:read'],
} as const satisfies Record<Role, readonly string[]>;

export type Permission = (typeof permissions)[Role][number];

export function roleHasPermission(role: Role, permission: string): boolean {
  return (permissions[role] as readonly string[]).includes(permission);
}
