import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // STARTTLS
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        ciphers: 'TLSv1.2',
      },
    });
  }

  async sendContactEmail(name: string, email: string, message: string) {
    const mailOptions = {
      from: `"${name}" <${process.env.MAIL_USER}>`,
      to: 'arminfierro@live.cl',
      subject: 'Nuevo mensaje desde Landing Page',
      html: `
        <h3>Nuevo mensaje de contacto</h3>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong><br/>${message}</p>
      `,
    };

    return this.transporter.sendMail(mailOptions);
  }
}
