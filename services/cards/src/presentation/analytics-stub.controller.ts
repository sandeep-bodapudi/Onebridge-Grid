import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('analytics')
export class AnalyticsStubController {
  @Post('events')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvents(@Body() events: unknown[]) {
    // High-volume analytics ingestion path per ADR-0003.
    // In local development / tests, acknowledges with 202 Accepted.
    // In Step 8 (F23 Analytics), persists to ClickHouse/events queue.
    return {
      status: 'accepted',
      count: Array.isArray(events) ? events.length : 1,
    };
  }
}
