/**
 * Base URL of the cards service (services/cards, port 4003 by default).
 * Read at call time, not module load, so CARDS_SERVICE_URL set by the
 * host (or a test) always applies. Previously each route hard-coded a
 * fallback of :4002, which is the organization service.
 */
export function cardsServiceUrl(): string {
  return process.env.CARDS_SERVICE_URL || 'http://localhost:4003';
}
