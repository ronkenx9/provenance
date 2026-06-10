export interface VenueSnapshot {
  venueId: string;      // Unique venue identifier, e.g. "aave-meth"
  protocol: string;     // e.g. "Aave V3"
  asset: string;        // e.g. "mETH"
  apy: number;          // Annual percentage yield (e.g. 4.25 for 4.25%)
  tvlUsd: number;       // Pool/lending depth in USD
  timestamp: number;    // UTC unix timestamp
  rawOnChainData?: any; // Additional data returned from RPC
}
