// ABRAhub Realism Stripe Plan Configuration
// Credit system: costs vary by action type

export const CREDIT_COSTS = {
  imageGeneration: 1,        // Cost per image in campaign pipeline
  imageRegeneration: 0.25,   // Cost to regenerate an existing image
  imageStudio: 10,           // Cost per image in Image Studio
  videoRapido: 25,           // Cost per video in Video Studio (Luma/Draft mode)
  videoCinema: 50,           // Cost per video in Video Studio (Kling/Cinema mode)
} as const;

// Average images per campaign duration (for estimation)
export const IMAGES_PER_DURATION: Record<number, number> = {
  15: 4,   // ~4 images for 15s
  30: 8,   // ~8 images for 30s
  60: 12,  // ~12 images for 1min
  90: 16,  // ~16 images for 1.5min
  120: 20, // ~20 images for 2min
  180: 28, // ~28 images for 3min
};

export function estimateCampaignCost(durationSeconds: number): number {
  const images = IMAGES_PER_DURATION[durationSeconds] || Math.ceil(durationSeconds / 4);
  return images * CREDIT_COSTS.imageGeneration;
}

// ABRAhub Realism Plans
// Note: PRO (10 credits) is Circle-only and not shown in UI
export const STRIPE_PLANS = {
  pro: {
    name: 'ABRAhub PRO+',
    monthly: {
      product_id: 'prod_TpIHKP5Wui6WKh',
      price_id: 'price_1SrdgbLkjsnhi7Nm3KkX5EVz',
      price: 197.00,
    },
    yearly: {
      product_id: 'prod_TpIHedJFtZLeYL',
      price_id: 'price_1SrdgpLkjsnhi7NmVbUPjIPj',
      price: 1970.00, // ~2 meses grátis
    },
    credits: 100,
    description: 'Acesso completo à plataforma de geração cinematográfica',
    features: [
      '100 créditos /mês',
      'Acesso a todos presets de lentes e câmeras',
      'Qualidade 2K e 4K',
      'Suporte prioritário',
    ],
    popular: true,
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS | 'free' | null;

export function getPlanByProductId(productId: string): PlanType {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (
      plan.monthly.product_id === productId ||
      plan.yearly.product_id === productId
    ) {
      return key as PlanType;
    }
  }
  return null;
}

export function getPlanCredits(planType: PlanType): number {
  if (!planType || planType === 'free') return 0;
  return STRIPE_PLANS[planType as keyof typeof STRIPE_PLANS]?.credits ?? 0;
}
