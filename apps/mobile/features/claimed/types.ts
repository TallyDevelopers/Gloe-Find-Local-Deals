export type ClaimStatus = 'active' | 'redeemed' | 'expired';

export interface ClaimedDeal {
  /** Unique claim id (separate from deal/variant ids). The QR encodes this. */
  id: string;
  dealId: string;
  variantId: string;
  /** Snapshotted at claim time so price doesn't change under the user. */
  snapshot: {
    dealTitle: string;
    vendorName: string;
    vendorId: string;
    variantLabel: string;
    originalPriceCents: number;
    dealPriceCents: number;
  };
  /** Token encoded into the QR. In production this is server-signed. */
  qrPayload: string;
  /** Short human-readable code (e.g. "GLOE-7K2QX") for staff to type if QR fails. */
  humanCode: string;
  status: ClaimStatus;
  createdAt: number;       // ms epoch
  expiresAt: number;       // ms epoch — typically createdAt + 7 days
  redeemedAt: number | null;
}
