import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/mysql';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { Mail } from 'src/database/entities/mail.entity';
import { Profmail } from 'src/database/entities/profmail.entity';
import { SchoolClass } from 'src/database/entities/school-class.entity';
import { Professor } from 'src/database/entities/professor.entity';

@Injectable()
export class MailingService {
  constructor(private em: EntityManager) {}

  async saveMail(
    email: string,
    classId: number,
    subjects: string[],
    groups: { [key: string]: number },
  ) {
    const existing = await this.em.findOne(Mail, { email, schoolClass: classId });

    if (existing) {
      throw new ForbiddenException(
        'Ta poštni naslov je že uporabljen za ta razred.',
      );
    }

    const emailHash = crypto
      .createHash('sha256')
      .update(email + classId)
      .digest('hex');

    const mail = this.em.create(Mail, {
      email,
      schoolClass: classId,
      subjects,
      groups,
      hash: emailHash,
    });
    await this.em.persist(mail).flush();

    const className = await this.em.findOne(SchoolClass, { id: classId });

    const emailTemplate = fs.readFileSync(
      'src/mailing/mails/subscribed.html',
      'utf-8',
    );
    const subject = `Naročnina na spremembe urnika za razred ${className?.name} je potrjena`;

    const finalHtml = emailTemplate
      .replace('{{class_name}}', className?.name || '')
      .replace(
        '{{unsubscribe_link}}',
        `${process.env.API_DOMAIN}/mailing/remove?email=${encodeURIComponent(emailHash)}`,
      );

    await this.sendEmail(email, subject, finalHtml);

    return 'Mail saved and confirmation email sent successfully';
  }

  async saveProfessorMail(email: string, profId: number) {
    const existing = await this.em.findOne(Profmail, { email, professor: profId });

    if (existing) {
      throw new ForbiddenException(
        'Ta poštni naslov je že uporabljen za tega profesorja.',
      );
    }

    const emailHash = crypto
      .createHash('sha256')
      .update(email + profId)
      .digest('hex');

    const profmail = this.em.create(Profmail, {
      email,
      professor: profId,
      hash: emailHash,
    });
    await this.em.persist(profmail).flush();

    const professor = await this.em.findOne(Professor, { id: profId });

    const emailTemplate = fs.readFileSync(
      'src/mailing/mails/prof_subscribed.html',
      'utf-8',
    );
    const subject = `Naročnina na spremembe urnika za profesorja ${professor?.name} je potrjena`;

    const finalHtml = emailTemplate
      .replace('{{professor_name}}', professor?.name || '')
      .replace(
        '{{unsubscribe_link}}',
        `${process.env.API_DOMAIN}/mailing/remove?email=${encodeURIComponent(emailHash)}`,
      );

    await this.sendEmail(email, subject, finalHtml);

    return 'Professor mail saved and confirmation email sent successfully';
  }

  async removeMail(hash: string) {
    const deleted = await this.em.nativeDelete(Mail, { hash });

    if (deleted === 0) {
      const profDeleted = await this.em.nativeDelete(Profmail, { hash });
      if (profDeleted === 0) {
        throw new ForbiddenException('Ni bilo mogoče najti vnosa za izbris.');
      }
      return 'Professor mail removed successfully';
    }
    return 'Mail removed successfully';
  }

  async getEmailsByClass(classId: number) {
    return this.em.find(Mail, { schoolClass: classId });
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (process.env.NODE_ENV === 'development') return 'Email sending skipped in development mode';

    const transporter = nodemailer.createTransport({
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

    return 'Email sent successfully';
  }

  async getEmailsByProfessor(professorId: number) {
    return this.em.find(Profmail, { professor: professorId });
  }
}
