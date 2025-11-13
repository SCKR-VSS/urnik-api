import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class MailingService {
  constructor(private prisma: PrismaService) {}

  async saveMail(
    email: string,
    classId: number,
    subjects: string[],
    groups: { [key: string]: number },
  ) {
    const existing = await this.prisma.mail.findFirst({
      where: {
        email,
        classId: classId,
      },
    });

    if (existing) {
      throw new ForbiddenException(
        'Ta poštni naslov je že uporabljen za ta razred.',
      );
    }

    const emailHash = crypto
      .createHash('sha256')
      .update(email + classId)
      .digest('hex');

    this.prisma.mail
      .create({
        data: {
          email,
          classId,
          subjects,
          groups,
          hash: emailHash,
        },
      })
      .then((save) => {
        if (save.id) {
          return 'Mail saved successfully';
        } else {
          throw new InternalServerErrorException();
        }
      });

    const className = await this.prisma.class.findUnique({
      where: {
        id: classId,
      },
    });

    const emailTemplate = fs.readFileSync(
      'src/mailing/mails/subscribed.html',
      'utf-8',
    );
    const subject = `Naročnina na spremembe urnika za razred ${className?.name} je potrjena`;

    let finalHtml = emailTemplate
      .replace('{{class_name}}', className?.name || '')
      .replace(
        '{{unsubscribe_link}}',
        `${process.env.API_DOMAIN}/mailing/remove?email=${encodeURIComponent(emailHash)}`,
      );

    await this.sendEmail(email, subject, finalHtml);

    return 'Mail saved and confirmation email sent successfully';
  }

  async removeMail(hash: string) {
    const deleted = await this.prisma.mail.deleteMany({
      where: {
        hash,
      },
    });

    if (deleted.count === 0) {
      throw new ForbiddenException('Ni bilo mogoče najti vnosa za izbris.');
    }
    return 'Mail removed successfully';
  }

  async getEmailsByClass(classId: number) {
    return this.prisma.mail.findMany({
      where: {
        classId,
      },
    });
  }

  async sendEmail(to: string, subject: string, html: string) {
    return 'Email sent';

    /*const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: 'VSŠ Kranj Urnik',
      to: to,
      subject: subject,
      html: html,
    });

    if (!info.messageId) {
      throw new InternalServerErrorException('Failed to send email');
    }

    return 'Email sent successfully';*/
  }

  async getEmailsByProfessor(professorId: number) {
    return this.prisma.profmail.findMany({
      where: {
        profId: professorId,
      },
    });
  }
}
