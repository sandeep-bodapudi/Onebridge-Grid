/**
 * Refuses to start production with a stand-in adapter (a class named Fake* or Console*).
 * Call it wherever a module picks an adapter (D-AUTH-EMAIL, VPS plan B1).
 */
export function assertNotFakeInProduction(name: string, adapter: unknown, nodeEnv: string): void {
  if (nodeEnv !== 'production') return;
  const className = (adapter as { constructor?: { name?: string } } | null)?.constructor?.name ?? '';
  if (/^(Fake|Console)/.test(className)) {
    throw new Error(`${name} uses ${className}, a development stand-in that is not allowed in production`);
  }
}
