export interface Plan {
  id: string;
  name: string;
  price: number;
  periodDays: number;
  features: string[];
  isActive: boolean;
}

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface Subscription {
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string;
  robokassaInvoiceId: string;
}

export interface RobokassaResultPayload {
  OutSum: string;
  InvId: string;
  SignatureValue: string;
}
