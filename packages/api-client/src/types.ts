import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';

import type { AppRouter } from './trpc';

/** Inferred types from the API router — use these in screens for typed data. */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

// Convenience aliases for common shapes
export type DealSummary = RouterOutputs['deals']['list'][number];
export type DealDetail = RouterOutputs['deals']['byId'];
export type DealVariant = DealDetail['variants'][number];
export type DealPhoto = DealDetail['photos'][number];
export type DealVideo = DealDetail['videos'][number];
export type DealProvider = DealDetail['providers'][number];
export type Vendor = RouterOutputs['vendors']['byId'];
export type Claim = RouterOutputs['claims']['list'][number];
export type Review = RouterOutputs['reviews']['listForVendor'][number];
export type Me = RouterOutputs['me']['whoami'];
