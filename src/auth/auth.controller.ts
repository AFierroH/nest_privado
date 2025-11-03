import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any) {
    const { email, clave } = body;
    const user = await this.authService.validateUser(email, clave);

    return {
      token: 'demo-token',
      user,
    };
  }
}
