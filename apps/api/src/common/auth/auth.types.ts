import type { StaffRole } from '@prisma/client';
import type { Request } from 'express';

export interface CustomerJwtPayload {
  sub: string;
  typ: 'customer';
}

export interface StaffJwtPayload {
  sub: string;
  typ: 'staff';
  role: StaffRole;
}

export interface AuthCustomer {
  id: string;
}

export interface AuthStaff {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

export interface AppRequest extends Request {
  customer?: AuthCustomer;
  staff?: AuthStaff;
}
