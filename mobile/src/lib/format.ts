import type { Listing } from './types';

const CURRENCY = process.env.EXPO_PUBLIC_CURRENCY ?? 'CAD';
const money = new Intl.NumberFormat(CURRENCY === 'CAD' ? 'en-CA' : 'en-US', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

export const formatPrice = (price: number) => money.format(price);

/** "3 bd · 2 ba · 1,850 sq ft", skipping anything unknown. */
export function formatFacts(l: Listing): string {
  const parts: string[] = [];
  if (l.bedrooms != null) parts.push(`${l.bedrooms} bd`);
  if (l.bathrooms != null) parts.push(`${l.bathrooms} ba`);
  if (l.sqft != null) parts.push(`${l.sqft.toLocaleString('en-US')} sq ft`);
  return parts.join(' · ');
}

/** The listing's own page when the feed provides one, otherwise the address on Zillow (US only). */
export function listingUrl(l: Listing): string {
  if (l.url) return l.url;
  const slug = l.address.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}
