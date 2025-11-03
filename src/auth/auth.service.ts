import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateUser(email: string, clave: string) {
    console.log('Buscando usuario:', email, clave);

    const user = await this.prisma.usuario.findFirst({
      where: { email, clave },
    });

    if (!user) {
      console.log('Usuario o clave incorrectos');
      throw new UnauthorizedException('Credenciales inválidas');
    }

    console.log('Usuario encontrado:', user);
    return user;
  }
}