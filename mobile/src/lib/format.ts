import type { Listing } from './types';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const formatPrice = (price: number) => usd.format(price);

/** "3 bd · 2 ba · 1,850 sq ft", skipping anything unknown. */
export function formatFacts(l: Listing): string {
  const parts: string[] = [];
  if (l.bedrooms != null) parts.push(`${l.bedrooms} bd`);
  if (l.bathrooms != null) parts.push(`${l.bathrooms} ba`);
  if (l.sqft != null) parts.push(`${l.sqft.toLocaleString('en-US')} sq ft`);
  return parts.join(' · ');
}

/** Opens the address on Zillow. A plain link needs no data license. */
export function listingUrl(l: Listing): string {
  const slug = l.address.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}
