import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StaffRole } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import type { CustomerJwtPayload, StaffJwtPayload } from './auth.types';

@Injectable()
export class TokenService {
  private readonly cfg: AppConfig['jwt'];

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.cfg = config.get('jwt', { infer: true });
  }

  signCustomer(customerId: string): string {
    const payload: CustomerJwtPayload = { sub: customerId, typ: 'customer' };
    return this.jwt.sign(payload, {
      secret: this.cfg.customerSecret,
      expiresIn: this.cfg.customerExpiresIn as never,
    });
  }

  signStaff(staffId: string, role: StaffRole): string {
    const payload: StaffJwtPayload = { sub: staffId, typ: 'staff', role };
    return this.jwt.sign(payload, {
      secret: this.cfg.staffSecret,
      expiresIn: this.cfg.staffExpiresIn as never,
    });
  }

  verifyCustomer(token: string): CustomerJwtPayload | null {
    try {
      const payload = this.jwt.verify<CustomerJwtPayload>(token, { secret: this.cfg.customerSecret });
      return payload.typ === 'customer' ? payload : null;
    } catch {
      return null;
    }
  }

  verifyStaff(token: string): StaffJwtPayload | null {
    try {
      const payload = this.jwt.verify<StaffJwtPayload>(token, { secret: this.cfg.staffSecret });
      return payload.typ === 'staff' ? payload : null;
    } catch {
      return null;
    }
  }
}

export function extractBearer(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' && token ? token : null;
}
