import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../prisma/generated/client';

export interface PushFilters {
    mode: 'class' | 'professor';
    classId?: number;
    subjects?: string[];
    groups?: { name: string; group: number }[];
    professorId?: number;
}

export interface WebPushSubscriptionKeys {
    p256dh: string;
    auth: string;
}

export interface WebPushSubscription {
    endpoint: string;
    keys: WebPushSubscriptionKeys;
}

@Injectable()
export class PushService {
    private readonly logger = new Logger(PushService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
        const mailto = this.configService.get<string>('VAPID_MAILTO');

        if (publicKey && privateKey && mailto) {
            webpush.setVapidDetails(`mailto:${mailto}`, publicKey, privateKey);
        } else {
            this.logger.warn(
                'VAPID keys or VAPID_MAILTO are not configured. Push notifications will not work.',
            );
        }
    }

    private hashEndpoint(endpoint: string): string {
        return crypto.createHash('sha256').update(endpoint).digest('hex');
    }

    async subscribe(sub: WebPushSubscription, filters: PushFilters): Promise<void> {
        const endpointHash = this.hashEndpoint(sub.endpoint);

        await this.prisma.pushSubscription.upsert({
            where: { endpointHash },
            create: {
                endpoint: sub.endpoint,
                endpointHash,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                mode: filters.mode,
                classId: filters.classId ?? undefined,
                professorId: filters.professorId ?? undefined,
                subjects: filters.subjects ?? Prisma.DbNull,
                groups: filters.groups ?? Prisma.DbNull,
            },
            update: {
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                mode: filters.mode,
                classId: filters.classId ?? undefined,
                professorId: filters.professorId ?? undefined,
                subjects: filters.subjects ?? Prisma.DbNull,
                groups: filters.groups ?? Prisma.DbNull,
            },
        });
    }

    async unsubscribe(endpoint: string): Promise<void> {
        const endpointHash = this.hashEndpoint(endpoint);
        await this.prisma.pushSubscription.deleteMany({ where: { endpointHash } });
    }


    async notifyClass(
        classId: number,
        className: string,
        changedDays: string[],
        changedClasses: { subject: string; group: number | null }[],
    ): Promise<void> {
        const subs = await this.prisma.pushSubscription.findMany({
            where: { mode: 'class', classId },
        });

        for (const sub of subs) {
            const subjects = (sub.subjects as string[] | null) ?? [];
            const groups = (sub.groups as { name: string; group: number }[] | null) ?? [];

            const isRelevant =
                subjects.length === 0 ||
                changedClasses.some((cls) => {
                    const subjectMatch =
                        subjects.length === 0 || subjects.includes(cls.subject.split(' ')[0]);
                    if (!subjectMatch) return false;
                    if (groups.length === 0) return true;
                    const groupPref = groups.find((g) => g.name === cls.subject.split(' ')[0]);
                    return !groupPref || groupPref.group === 0 || groupPref.group === cls.group;
                });

            if (!isRelevant) continue;

            await this.sendNotification(sub, {
                title: `Sprememba urnika - ${className}`,
                body: `Urnik za ${changedDays.join(', ')} se je spremenil.`,
                url: '/',
            });
        }
    }

    async notifyProfessor(
        professorId: number,
        professorName: string,
        changedDays: string[],
    ): Promise<void> {
        const subs = await this.prisma.pushSubscription.findMany({
            where: { mode: 'professor', professorId },
        });

        for (const sub of subs) {
            const dayStr = changedDays.length === 1 ? changedDays[0] : changedDays.join(', ');
            await this.sendNotification(sub, {
                title: `Sprememba urnika – ${professorName}`,
                body: `Urnik za ${dayStr} se je spremenil.`,
                url: '/',
            });
        }
    }

    private async sendNotification(
        sub: { endpoint: string; p256dh: string; auth: string; endpointHash: string },
        payload: { title: string; body: string; url: string },
    ): Promise<void> {
        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                JSON.stringify(payload),
            );
        } catch (err: any) {
            if (err.statusCode === 410 || err.statusCode === 404) {
                // Subscription expired — remove it
                this.logger.log(`Removing stale push subscription: ${sub.endpointHash}`);
                await this.prisma.pushSubscription.deleteMany({
                    where: { endpointHash: sub.endpointHash },
                });
            } else {
                this.logger.error(`Failed to send push notification: ${err.message}`);
            }
        }
    }
}
