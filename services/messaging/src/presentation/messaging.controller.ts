import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { AuthenticationError, RequestAuthenticator } from '@onebridge/shared';
import { MessagingService, SendInput, StartInput } from '../application/messaging.service.js';
import type { Scope } from '../application/realtime-hub.js';

export const REQUEST_AUTHENTICATOR = 'REQUEST_AUTHENTICATOR';

interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
}

const header = (req: RequestLike, name: string) => {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : v) || undefined;
};

/** N08 messaging endpoints. X-Act-As-Company switches to the company inbox. */
@Controller()
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    @Inject(REQUEST_AUTHENTICATOR) private readonly authenticator: RequestAuthenticator
  ) {}

  private async scope(req: RequestLike): Promise<Scope> {
    const company = header(req, 'x-act-as-company');
    const headers = { ...req.headers };
    delete headers['x-tenant-id'];
    if (company) headers['x-tenant-id'] = company;
    try {
      const caller = await this.authenticator.authenticate(headers);
      if (!caller.personId || caller.personId === 'system') throw new AuthenticationError('Sign in required');
      return this.messaging.scopeFor(caller.personId, company, caller.role);
    } catch (err) {
      if (err instanceof AuthenticationError) {
        throw new UnauthorizedException({ type: 'https://tools.ietf.org/html/rfc7807', title: 'Unauthorized', status: 401, detail: 'Sign in to continue.' });
      }
      throw err;
    }
  }

  @Get('conversations')
  async list(@Req() req: RequestLike, @Query('folder') folder?: string, @Query('assigned') assigned?: string, @Query('q') q?: string, @Query('cursor') cursor?: string) {
    return this.messaging.list(await this.scope(req), { folder, assigned, q, cursor });
  }

  @Post('conversations')
  async start(@Req() req: RequestLike, @Body() body: StartInput) {
    return this.messaging.start(await this.scope(req), body ?? {});
  }

  @Get('conversations/:id')
  async get(@Req() req: RequestLike, @Param('id') id: string) {
    return this.messaging.get(await this.scope(req), id);
  }

  @Get('conversations/:id/messages')
  async messages(@Req() req: RequestLike, @Param('id') id: string, @Query('cursor') cursor?: string) {
    return this.messaging.messagesPage(await this.scope(req), id, cursor);
  }

  @Post('conversations/:id/messages')
  async send(@Req() req: RequestLike, @Param('id') id: string, @Body() body: SendInput) {
    return this.messaging.send(await this.scope(req), id, body ?? {});
  }

  @Patch('messages/:id')
  async edit(@Req() req: RequestLike, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.messaging.edit(await this.scope(req), id, body?.text);
  }

  @Delete('messages/:id')
  async unsend(@Req() req: RequestLike, @Param('id') id: string) {
    return this.messaging.unsend(await this.scope(req), id);
  }

  @Post('conversations/:id/accept')
  @HttpCode(200)
  async accept(@Req() req: RequestLike, @Param('id') id: string) {
    return this.messaging.accept(await this.scope(req), id);
  }

  @Post('conversations/:id/ignore')
  @HttpCode(200)
  async ignore(@Req() req: RequestLike, @Param('id') id: string) {
    return this.messaging.ignore(await this.scope(req), id);
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  async read(@Req() req: RequestLike, @Param('id') id: string, @Body() body: { upToMessageId?: string }) {
    await this.messaging.read(await this.scope(req), id, body?.upToMessageId);
  }

  @Post('conversations/:id/status')
  @HttpCode(200)
  async status(@Req() req: RequestLike, @Param('id') id: string, @Body() body: { status?: string }) {
    return this.messaging.setStatus(await this.scope(req), id, body?.status);
  }

  @Post('conversations/:id/assign')
  @HttpCode(200)
  async assign(@Req() req: RequestLike, @Param('id') id: string, @Body() body: { seatId?: string }) {
    return this.messaging.assign(await this.scope(req), id, body?.seatId);
  }

  @Get('conversations/:id/notes')
  async notes(@Req() req: RequestLike, @Param('id') id: string) {
    return this.messaging.listNotes(await this.scope(req), id);
  }

  @Post('conversations/:id/notes')
  async addNote(@Req() req: RequestLike, @Param('id') id: string, @Body() body: { text?: string }) {
    return this.messaging.addNote(await this.scope(req), id, body?.text);
  }

  /** Short-lived ticket so the access token never travels in the WebSocket URL. */
  @Post('realtime/ticket')
  @HttpCode(200)
  async ticket(@Req() req: RequestLike) {
    return this.messaging.hub.issueTicket(await this.scope(req));
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
