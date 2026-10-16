import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Service health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is operational' })
  async check() {
    const isDbConnected = await this.prisma.isHealthy();
    return {
      status: 'ok',
      service: 'clinicqueue-api',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      database: isDbConnected ? 'connected' : 'disconnected',
    };
  }
}
