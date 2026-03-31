import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PushService, PushFilters, WebPushSubscription } from './push.service';
import { Public } from '../auth/public.decorator';

class SubscribeDto {
  subscription: WebPushSubscription;
  mode: 'class' | 'professor';
  classId?: string;
  subjects?: string[];
  groups?: { name: string; group: number }[];
  professorId?: string;
}

class UnsubscribeDto {
  endpoint: string;
}

@ApiTags('Push')
@Public()
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register or update a push subscription' })
  async subscribe(@Body() body: SubscribeDto) {
    const filters: PushFilters = {
      mode: body.mode,
      classId: body.classId ? parseInt(body.classId, 10) : undefined,
      subjects: body.subjects,
      groups: body.groups,
      professorId: body.professorId ? parseInt(body.professorId, 10) : undefined,
    };
    await this.pushService.subscribe(body.subscription, filters);
    return { ok: true };
  }

  @Delete('unsubscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove a push subscription' })
  async unsubscribe(@Body() body: UnsubscribeDto) {
    await this.pushService.unsubscribe(body.endpoint);
    return { ok: true };
  }
}
