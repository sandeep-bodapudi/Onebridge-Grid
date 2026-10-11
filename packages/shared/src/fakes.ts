export interface Notifier { send(to: string, message: string): Promise<void>; }
export interface OtpSender { sendOtp(phone: string, email?: string, code?: string): Promise<{ channel?: string; success: boolean }>; verifyOtp(phone: string, code: string): Promise<boolean>; }
export interface PaymentGateway { createOrder(amount: number): Promise<string>; verifyPayment(orderId: string): Promise<boolean>; }
export interface GstVerifier { verify(gstin: string): Promise<boolean>; }
export interface Courier { createShipment(address: string): Promise<string>; }
export interface UrlSafetyChecker { isSafe(url: string): Promise<boolean>; }
export interface BotChallenge { verifyToken(token: string): Promise<boolean>; }
export interface KeyService { encrypt(data: string): Promise<string>; decrypt(data: string): Promise<string>; }
export interface EventBus { publish(event: unknown): Promise<void>; }
export interface PlanLimits { getForTenant(tenantId: string): Promise<Record<string, unknown>>; }

export class FakeProvider {
  public calls: Array<{ name: string; args: unknown }> = [];
  public shouldFail = false;
  protected checkFailure() { if (this.shouldFail) throw new Error('Fake failure'); }
  protected record(name: string, args: unknown) { this.calls.push({ name, args }); }
}

export class FakeNotifier extends FakeProvider implements Notifier {
  async send(to: string, message: string) { this.checkFailure(); this.record('send', { to, message }); }
}

export interface OtpDeliveryChannel {
  channel: 'sms' | 'whatsapp' | 'email';
  recipient: string;
  code: string;
}

export class FakeOtpSender extends FakeProvider implements OtpSender {
  public failSms = false;
  public failWhatsapp = false;
  public failEmail = false;
  public sentChannels: OtpDeliveryChannel[] = [];

  async sendOtp(phone: string, email?: string, code = '123456') {
    this.checkFailure();
    this.record('sendOtp', { phone, email, code });
    if (!this.failSms) {
      this.sentChannels.push({ channel: 'sms', recipient: phone, code });
      return { channel: 'sms', success: true };
    }
    if (!this.failWhatsapp) {
      this.sentChannels.push({ channel: 'whatsapp', recipient: phone, code });
      return { channel: 'whatsapp', success: true };
    }
    if (email && !this.failEmail) {
      this.sentChannels.push({ channel: 'email', recipient: email, code });
      return { channel: 'email', success: true };
    }
    throw new Error('All OTP delivery channels failed');
  }

  async verifyOtp(phone: string, code: string) {
    this.checkFailure();
    this.record('verifyOtp', { phone, code });
    return code === '123456';
  }
}

export class FakePaymentGateway extends FakeProvider implements PaymentGateway {
  async createOrder(amount: number) { this.checkFailure(); this.record('createOrder', { amount }); return 'order_123'; }
  async verifyPayment(orderId: string) { this.checkFailure(); this.record('verifyPayment', { orderId }); return true; }
}

export class FakeGstVerifier extends FakeProvider implements GstVerifier {
  async verify(gstin: string) { this.checkFailure(); this.record('verify', { gstin }); return gstin.length > 5; }
}

export class FakeCourier extends FakeProvider implements Courier {
  async createShipment(address: string) { this.checkFailure(); this.record('createShipment', { address }); return 'ship_123'; }
}

export class FakeUrlSafetyChecker extends FakeProvider implements UrlSafetyChecker {
  async isSafe(url: string) { this.checkFailure(); this.record('isSafe', { url }); return !url.includes('bad'); }
}

export class FakeBotChallenge extends FakeProvider implements BotChallenge {
  async verifyToken(token: string) { this.checkFailure(); this.record('verifyToken', { token }); return token === 'valid'; }
}

export class FakeKeyService extends FakeProvider implements KeyService {
  async encrypt(data: string) { this.checkFailure(); this.record('encrypt', { data }); return `enc_${data}`; }
  async decrypt(data: string) { this.checkFailure(); this.record('decrypt', { data }); return data.replace('enc_', ''); }
}

export class FakeEventBus extends FakeProvider implements EventBus {
  async publish(event: unknown) { this.checkFailure(); this.record('publish', { event }); }
}

export class FakePlanLimits extends FakeProvider implements PlanLimits {
  public config: Record<string, Record<string, unknown>> = {};
  async getForTenant(tenantId: string) { 
    this.checkFailure(); 
    this.record('getForTenant', { tenantId }); 
    return this.config[tenantId] || { plan: 'Business' }; 
  }
}
