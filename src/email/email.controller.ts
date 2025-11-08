import { Body, Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('contact')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Post()
  async send(@Body() body: { name: string; email: string; message: string }) {
    await this.emailService.sendContactEmail(body.name, body.email, body.message);
    return { ok: true, message: 'Enviado' };
  }
}
