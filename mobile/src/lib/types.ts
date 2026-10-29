export type Listing = {
  id: string;
  address: string;
  price: number;
  lat: number;
  lng: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  /** The listing's own page (REALTOR.ca for Canadian DDF data). */
  url?: string | null;
  /** Set for listings the user dropped by hand to test alerts. */
  isTest?: boolean;
};

export type Fix = {
  lat: number;
  lng: number;
  /** Degrees clockwise from north, or null when unknown. */
  heading: number | null;
  /** Meters per second, or null when unknown. */
  speed: number | null;
  timestamp: number;
};

export type AlertMode = 'live' | 'saveForLater';

export type DriveLogEntry = {
  listing: Listing;
  passedAt: number;
};
