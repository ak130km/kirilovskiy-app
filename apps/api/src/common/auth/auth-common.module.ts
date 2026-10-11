import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CustomerAuthGuard, OptionalCustomerAuthGuard, StaffAuthGuard } from './guards';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [TokenService, CustomerAuthGuard, OptionalCustomerAuthGuard, StaffAuthGuard],
  exports: [TokenService, CustomerAuthGuard, OptionalCustomerAuthGuard, StaffAuthGuard],
})
export class AuthCommonModule {}
