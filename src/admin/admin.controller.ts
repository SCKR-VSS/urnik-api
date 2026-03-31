import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiSecurity,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { Public } from '../auth/public.decorator';
import { ConfigService } from '@nestjs/config';

class CreateApiKeyDto {
  label?: string;
  type?: number;
}

class LoginDto {
  key: string;
}

@ApiTags('Admin')
@Public()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Verify an admin key' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['key'],
      properties: {
        key: { type: 'string', description: 'The admin secret key' },
      },
    },
  })
  login(@Body() body: LoginDto) {
    const adminSecret = this.configService.get<string>('ADMIN_SECRET');
    console.log('Admin login attempt with key:', body.key);
    if (!adminSecret || body.key !== adminSecret) {
      throw new UnauthorizedException('Invalid admin key.');
    }
    return { valid: true };
  }

  @Get('keys')
  @ApiSecurity('adminKey')
  @ApiOperation({ summary: 'List all API keys with usage counts' })
  @UseGuards(AdminGuard)
  listApiKeys() {
    return this.adminService.listApiKeys();
  }

  @Post('keys')
  @ApiSecurity('adminKey')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Human-readable label / assignee name' },
        type: { type: 'integer', description: '0 = general, 1 = mobile', default: 0 },
      },
    },
  })
  @UseGuards(AdminGuard)
  createApiKey(@Body() body: CreateApiKeyDto) {
    return this.adminService.createApiKey(body.label, body.type);
  }

  @Patch('keys/:id/revoke')
  @ApiSecurity('adminKey')
  @ApiOperation({ summary: 'Revoke an API key (keeps it in the database, marks as revoked)' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(AdminGuard)
  revokeApiKey(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.revokeApiKey(id);
  }

  @Delete('keys/:id')
  @ApiSecurity('adminKey')
  @ApiOperation({ summary: 'Permanently delete an API key' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(AdminGuard)
  deleteApiKey(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteApiKey(id);
  }
}

