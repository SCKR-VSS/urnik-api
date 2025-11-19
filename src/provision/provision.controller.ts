import { Controller, Post, Body } from '@nestjs/common';
import { ProvisionService } from './provision.service';
import { Public } from 'src/auth/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Provisioning')
@Controller('provision')
export class ProvisionController {
  constructor(private readonly provisionService: ProvisionService) {}

  @Public()
  @Post('key')
  @ApiOperation({ summary: 'Provision a new API key for a device.' })
  @ApiResponse({
    status: 201,
    description: 'The new API key.',
    schema: { properties: { apiKey: { type: 'string' } } },
  })
  async provisionKey(
    @Body('description') description?: string,
  ): Promise<{ apiKey: string }> {
    return this.provisionService.provisionApiKey(description);
  }
}