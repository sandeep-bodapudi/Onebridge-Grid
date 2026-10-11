import { describe, it, expect } from 'vitest';
import { 
  FakeNotifier, FakeOtpSender, FakePaymentGateway, FakeGstVerifier, 
  FakeCourier, FakeUrlSafetyChecker, FakeBotChallenge, FakeKeyService, 
  FakeEventBus, FakePlanLimits 
} from '../src/fakes';

describe('AC-16 & AC-17: Fake Adapters', () => {
  it('fake notifier should record calls and simulate failure', async () => {
    const notifier = new FakeNotifier();
    await notifier.send('user@example.com', 'Hello');
    expect(notifier.calls).toHaveLength(1);
    expect(notifier.calls[0]).toEqual({ name: 'send', args: { to: 'user@example.com', message: 'Hello' } });

    notifier.shouldFail = true;
    await expect(notifier.send('user2@example.com', 'Fail')).rejects.toThrow('Fake failure');
  });

  it('fake plan limits should return configurable limits per tenant', async () => {
    const planLimits = new FakePlanLimits();
    planLimits.config['tenant-starter'] = { plan: 'Starter' };
    
    expect(await planLimits.getForTenant('tenant-starter')).toEqual({ plan: 'Starter' });
    expect(await planLimits.getForTenant('unknown')).toEqual({ plan: 'Business' });
    expect(planLimits.calls).toHaveLength(2);
  });

  it('other fakes should implement methods', async () => {
    const otp = new FakeOtpSender();
    await otp.sendOtp('123');
    expect(otp.calls).toHaveLength(1);

    const pg = new FakePaymentGateway();
    expect(await pg.createOrder(100)).toBe('order_123');

    const gst = new FakeGstVerifier();
    expect(await gst.verify('GST123')).toBe(true);

    const courier = new FakeCourier();
    expect(await courier.createShipment('Address')).toBe('ship_123');

    const safety = new FakeUrlSafetyChecker();
    expect(await safety.isSafe('http://good.com')).toBe(true);

    const bot = new FakeBotChallenge();
    expect(await bot.verifyToken('valid')).toBe(true);

    const key = new FakeKeyService();
    expect(await key.encrypt('data')).toBe('enc_data');

    const bus = new FakeEventBus();
    await bus.publish({ type: 'Test' });
    expect(bus.calls).toHaveLength(1);
  });
});
