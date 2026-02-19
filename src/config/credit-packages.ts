// ABRAhub Credit Packages - One-off purchases
// Cost per credit: R$ 1.40 (R$ 14.00 per 10 generations)

export const CREDIT_PACKAGES = {
  pack_10: {
    id: 'pack_10',
    credits: 10,
    price: 3900, // centavos
    priceDisplay: 'R$ 39,00',
    pricePerCredit: 'R$ 3,90',
    discount: null,
    stripe_price_id: 'price_1Sxs1HLkjsnhi7Nm9ISzvNnw',
    popular: false,
  },
  pack_30: {
    id: 'pack_30',
    credits: 30,
    price: 9900,
    priceDisplay: 'R$ 99,00',
    pricePerCredit: 'R$ 3,30',
    discount: '15% de economia',
    stripe_price_id: 'price_1Sxs1ULkjsnhi7Nm80s9ZVV1',
    popular: false,
  },
  pack_50: {
    id: 'pack_50',
    credits: 50,
    price: 14900,
    priceDisplay: 'R$ 149,00',
    pricePerCredit: 'R$ 2,98',
    discount: '24% de economia',
    stripe_price_id: 'price_1Sxs1gLkjsnhi7Nmex8TTV57',
    popular: true,
  },
  pack_100: {
    id: 'pack_100',
    credits: 100,
    price: 24900,
    priceDisplay: 'R$ 249,00',
    pricePerCredit: 'R$ 2,49',
    discount: '36% de economia',
    stripe_price_id: 'price_1Sxs1rLkjsnhi7NmmYQm8L9z',
    popular: false,
  },
} as const;

export type CreditPackageId = keyof typeof CREDIT_PACKAGES;
export type CreditPackage = typeof CREDIT_PACKAGES[CreditPackageId];

// Get package by Stripe price ID
export function getPackageByPriceId(priceId: string): CreditPackage | null {
  for (const pkg of Object.values(CREDIT_PACKAGES)) {
    if (pkg.stripe_price_id === priceId) {
      return pkg;
    }
  }
  return null;
}

// Get package by ID
export function getPackageById(packageId: CreditPackageId): CreditPackage {
  return CREDIT_PACKAGES[packageId];
}

// All package IDs as array for iteration
export const CREDIT_PACKAGE_IDS = Object.keys(CREDIT_PACKAGES) as CreditPackageId[];

// All credit package price IDs for validation
export const CREDIT_PACKAGE_PRICE_IDS = Object.values(CREDIT_PACKAGES).map(p => p.stripe_price_id);
