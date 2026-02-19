import { useState, useEffect } from 'react';
import { Check, Crown, Loader2, Clock, Coins, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { STRIPE_PLANS, CREDIT_COSTS } from '@/config/stripe-plans';
import { CREDIT_PACKAGES, CREDIT_PACKAGE_IDS } from '@/config/credit-packages';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCredits } from '@/hooks/useCredits';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { BuyCreditsModal } from '@/components/credits/BuyCreditsModal';

export default function Pricing() {
  const { user } = useAuth();
  const { credits, subscription, isPro, isInGracePeriod } = useCredits(user?.id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [buyCreditsOpen, setBuyCreditsOpen] = useState(false);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout === 'canceled') {
      toast.info('Checkout cancelado');
    } else if (checkout === 'success') {
      toast.success('Assinatura realizada com sucesso!');
    }
  }, [searchParams]);

  const handleSubscribe = async () => {
    if (!user) {
      toast.error('Faça login para assinar');
      navigate('/auth');
      return;
    }

    const plan = STRIPE_PLANS.pro;
    const priceId = isYearly ? plan.yearly.price_id : plan.monthly.price_id;

    setLoadingPlan('pro');

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Portal error:', error);
      toast.error('Erro ao abrir portal. Tente novamente.');
    }
  };

  const isCurrentPlan = (planKey: string) => {
    if (planKey === 'free' && (!subscription?.isActive || subscription?.plan === 'free')) return true;
    return subscription?.plan === planKey && subscription?.isActive && !subscription?.downgradedAt;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const userIsPro = isPro();
  const userInGrace = isInGracePeriod();

  return (
    <div className="min-h-screen bg-studio-mesh">
      <Header credits={credits.available} totalCredits={credits.total} user={user} />

      <main className="container px-4 py-16 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-secondary/50 border border-border">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Planos & Preços</span>
          </div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            <span className="text-gradient-lime">ABRAhub</span> Realism
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Geração de imagens cinematográficas com qualidade de filme
          </p>
        </div>

        {/* Grace Period Notice */}
        {userInGrace && subscription?.graceUntil && (
          <div className="mt-8 max-w-2xl mx-auto p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-200">
                  Seus créditos restantes estão disponíveis até {formatDate(subscription.graceUntil)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Você ainda tem {credits.available} créditos para usar. Após esta data, eles expiram.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Credits Section - Highlighted at Top */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="relative rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 backdrop-blur-sm overflow-hidden">
            {/* Background glow effect */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-primary/20 border border-primary/30">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-primary">CRÉDITOS AVULSOS</span>
                </div>
                <h2 className="font-display text-2xl font-bold md:text-3xl">
                  Precisa de mais créditos?
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Compre pacotes extras sem precisar mudar de plano
                </p>
              </div>

              {/* Credit Packages Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {CREDIT_PACKAGE_IDS.map((pkgId) => {
                  const pkg = CREDIT_PACKAGES[pkgId];
                  return (
                    <div 
                      key={pkg.id}
                      className={`relative p-4 rounded-xl border transition-all duration-200 ${
                        pkg.popular 
                          ? 'border-primary bg-primary/10 shadow-lime' 
                          : 'border-border/50 bg-card/50 hover:border-primary/50'
                      }`}
                    >
                      {pkg.popular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground whitespace-nowrap">
                            MELHOR OFERTA
                          </span>
                        </div>
                      )}
                      <div className="text-center pt-1">
                        <div className="flex items-center justify-center gap-1 mb-2">
                          <Coins className="h-4 w-4 text-primary" />
                          <span className="font-display text-2xl font-bold">{pkg.credits}</span>
                        </div>
                        <p className="font-semibold text-foreground">{pkg.priceDisplay}</p>
                        <p className="text-xs text-muted-foreground">{pkg.pricePerCredit}/crédito</p>
                        {pkg.discount && (
                          <p className="mt-1 text-xs font-medium text-primary">{pkg.discount}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center">
                <Button 
                  size="lg" 
                  className="gap-2 glow-lime px-8"
                  onClick={() => setBuyCreditsOpen(true)}
                >
                  <Coins className="h-5 w-5" />
                  Comprar Créditos Agora
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mt-12 max-w-4xl mx-auto flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">OU ASSINE PRO</span>
          <Separator className="flex-1" />
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mt-10">
          <Label 
            htmlFor="billing-toggle" 
            className={`text-sm font-medium cursor-pointer ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Mensal
          </Label>
          <Switch 
            id="billing-toggle" 
            checked={isYearly} 
            onCheckedChange={setIsYearly}
          />
          <Label 
            htmlFor="billing-toggle" 
            className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Anual
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">
              2 meses grátis
            </span>
          </Label>
        </div>

        {/* Plans Grid */}
        <div className="mt-12 flex justify-center max-w-4xl mx-auto">
          {/* Pro Plan */}
          <div className={`relative flex flex-col rounded-2xl border-2 border-primary bg-card/50 backdrop-blur-sm p-8 transition-all duration-300 shadow-lime w-full max-w-md`}>
            {userIsPro && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">
                  Seu Plano
                </span>
              </div>
            )}
            {!userIsPro && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary px-4 py-1 text-sm font-bold text-primary-foreground">
                  Mais Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-2xl font-bold">{STRIPE_PLANS.pro.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{STRIPE_PLANS.pro.description}</p>
            </div>

            <div className="mb-6">
              <span className="font-display text-4xl font-bold">
                {formatPrice(isYearly ? STRIPE_PLANS.pro.yearly.price : STRIPE_PLANS.pro.monthly.price)}
              </span>
              <span className="text-muted-foreground">/{isYearly ? 'ano' : 'mês'}</span>
              {isYearly && (
                <p className="text-xs text-muted-foreground mt-1">
                  = {formatPrice(STRIPE_PLANS.pro.yearly.price / 12)}/mês
                </p>
              )}
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {STRIPE_PLANS.pro.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>

            {userIsPro ? (
              <Button 
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={handleManageSubscription}
              >
                Gerenciar Assinatura
              </Button>
            ) : (
              <Button 
                size="lg"
                className="w-full glow-lime"
                onClick={handleSubscribe}
                disabled={loadingPlan === 'pro'}
              >
                {loadingPlan === 'pro' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Assinar PRO'
                )}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          Todos os preços em Reais (BRL). Cancele a qualquer momento.
        </p>
      </main>

      <BuyCreditsModal 
        open={buyCreditsOpen} 
        onOpenChange={setBuyCreditsOpen} 
      />
    </div>
  );
}
