import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import * as crypto from 'crypto';
import { EntityManager } from '@mikro-orm/mysql';
import { ConfigService } from '@nestjs/config';
import { PushSubscription } from 'src/database/entities/push-subscription.entity';

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
        private readonly em: EntityManager,
        private readonly configService: ConfigService,
    ) {
        const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
        const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

        if (publicKey && privateKey) {
            webpush.setVapidDetails(`mailto:${this.configService.get<string>("VAPID_MAILTO") ?? "nejc.zivic@vss.sckr.si"}`, publicKey, privateKey);
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

        let subscription = await this.em.findOne(PushSubscription, { endpointHash });

        if (subscription) {
            subscription.p256dh = sub.keys.p256dh;
            subscription.auth = sub.keys.auth;
            subscription.mode = filters.mode;
            subscription.classId = filters.classId ?? null;
            subscription.professorId = filters.professorId ?? null;
            subscription.subjects = filters.subjects ?? null;
            subscription.groups = filters.groups ?? null;
        } else {
            subscription = this.em.create(PushSubscription, {
                endpoint: sub.endpoint,
                endpointHash,
                p256dh: sub.keys.p256dh,
                auth: sub.keys.auth,
                mode: filters.mode,
                classId: filters.classId ?? null,
                professorId: filters.professorId ?? null,
                subjects: filters.subjects ?? null,
                groups: filters.groups ?? null,
            });
            this.em.persist(subscription);
        }

        await this.em.flush();
    }

    async unsubscribe(endpoint: string): Promise<void> {
        const endpointHash = this.hashEndpoint(endpoint);
        await this.em.nativeDelete(PushSubscription, { endpointHash });
    }

    async notifyClass(
        classId: number,
        className: string,
        changeLines: string[],
    ): Promise<void> {
        if (changeLines.length === 0) return;

        const subs = await this.em.find(PushSubscription, { mode: 'class', classId });

        for (const sub of subs) {
            const subjects = (sub.subjects as string[] | null) ?? [];
            const groups = (sub.groups as { name: string; group: number }[] | null) ?? [];

            const relevant = changeLines.filter((line) => {
                if (subjects.length === 0) return true;
                const subjectCode = line.split(' ')[0];
                if (!subjects.includes(subjectCode)) return false;
                const groupPref = groups.find((g) => g.name === subjectCode);
                return !groupPref || groupPref.group === 0;
            });

            await this.sendNotification(sub, this.summarize(`Sprememba urnika · ${className}`, relevant));
        }
    }

    async notifyProfessor(
        professorId: number,
        professorName: string,
        changeLines: string[],
    ): Promise<void> {
        if (changeLines.length === 0) return;

        const subs = await this.em.find(PushSubscription, { mode: 'professor', professorId });

        const payload = this.summarize(`Sprememba urnika · ${professorName}`, changeLines);
        for (const sub of subs) {
            await this.sendNotification(sub, payload);
        }
    }

    private summarize(title: string, lines: string[]) {
        const MAX = 4;
        const extra = lines.length - MAX;
        const body = lines.slice(0, MAX).join('\n') + (extra > 0 ? `\n…in še ${extra} sprememb` : '');
        return { title, body, url: '/' };
    }

    private async sendNotification(
        sub: { endpoint: string; p256dh: string; auth: string; endpointHash: string },
        payload: { title: string; body: string; url: string },
    ): Promise<void> {
        if (!payload.body) return;
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
                this.logger.log(`Removing stale push subscription: ${sub.endpointHash}`);
                await this.em.nativeDelete(PushSubscription, { endpointHash: sub.endpointHash });
            } else {
                this.logger.error(`Failed to send push notification: ${err.message}`);
            }
        }
    }
}
