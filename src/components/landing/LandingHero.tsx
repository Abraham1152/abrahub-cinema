import { useState, useEffect } from 'react';
import { Zap, Sparkles, Layers, Film, Play, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingHeroProps {
  onCreateCampaign: () => void;
}

export function LandingHero({ onCreateCampaign }: LandingHeroProps) {
  const [demoStep, setDemoStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isAnimating) {
      const steps = [1, 2, 3, 4, 5];
      let currentIndex = 0;
      
      const interval = setInterval(() => {
        if (currentIndex < steps.length) {
          setDemoStep(steps[currentIndex]);
          currentIndex++;
        } else {
          setIsAnimating(false);
          setTimeout(() => setDemoStep(0), 3000);
        }
      }, 800);

      return () => clearInterval(interval);
    }
  }, [isAnimating]);

  const startDemo = () => {
    setDemoStep(0);
    setIsAnimating(true);
  };

  return (
    <div className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-studio-mesh" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-yellow-glow/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(hsl(0 0% 50%) 1px, transparent 1px),
                          linear-gradient(90deg, hsl(0 0% 50%) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-secondary/50 border border-border backdrop-blur-sm animate-fade-in">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">ABRAhub Realism • AI Cinema Studio</span>
        </div>

        {/* Main Heading */}
        <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 animate-slide-up">
          <span className="text-foreground">Crie campanhas</span>
          <br />
          <span className="text-gradient-yellow">cinematográficas</span>
          <br />
          <span className="text-foreground">em minutos</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          Não gere imagens isoladas. Construa um{' '}
          <span className="text-foreground font-medium">storyboard profissional</span> com 
          consistência visual extrema, pronto para virar vídeo.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <Button 
            size="lg" 
            onClick={onCreateCampaign}
            className="gap-3 min-w-[240px] h-14 text-lg shadow-yellow glow-yellow-soft"
          >
            <Sparkles className="h-5 w-5" />
            Gerar Campanha Visual
          </Button>
          <Button 
            variant="secondary" 
            size="lg" 
            onClick={startDemo}
            className="gap-3 min-w-[240px] h-14 text-lg"
          >
            <Play className="h-5 w-5" />
            Ver Demo
          </Button>
        </div>

        {/* Demo Animation / Mockup */}
        <div className="relative max-w-4xl mx-auto animate-slide-up" style={{ animationDelay: '300ms' }}>
          <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/50 backdrop-blur-sm shadow-studio-lg">
            {/* Browser Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-secondary/30 border-b border-border/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/60" />
                <div className="w-3 h-3 rounded-full bg-warning/60" />
                <div className="w-3 h-3 rounded-full bg-success/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded bg-secondary/50 text-xs text-muted-foreground">
                  app.abrahub.com/studio
                </div>
              </div>
            </div>

            {/* App Content */}
            <div className="p-6 min-h-[400px]">
              {demoStep === 0 && (
                <div className="flex flex-col items-center justify-center h-80 gap-4">
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                    <Film className="h-12 w-12 text-primary" />
                  </div>
                  <p className="text-muted-foreground">Clique em "Ver Demo" para simular o pipeline</p>
                </div>
              )}

              {demoStep >= 1 && (
                <div className="space-y-4">
                  {/* Progress Steps */}
                  <div className="flex items-center justify-center gap-2 mb-6">
                    {['Análise', 'Conceito', 'Roteiro', 'Cenas', 'Imagens'].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`
                          flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300
                          ${demoStep > i + 1 ? 'bg-primary text-primary-foreground' : 
                            demoStep === i + 1 ? 'bg-primary/20 text-primary border-2 border-primary animate-pulse' : 
                            'bg-secondary text-muted-foreground'}
                        `}>
                          {demoStep > i + 1 ? '✓' : i + 1}
                        </div>
                        <span className={`hidden sm:inline text-sm ${demoStep >= i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {step}
                        </span>
                        {i < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>

                  {/* Storyboard Preview */}
                  {demoStep >= 4 && (
                    <div className="grid grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((scene) => (
                        <div 
                          key={scene}
                          className={`
                            aspect-video rounded-lg overflow-hidden border border-border/50 transition-all duration-500
                            ${demoStep >= 5 ? 'bg-gradient-to-br from-primary/20 to-yellow-dark/20' : 'bg-secondary/30'}
                          `}
                          style={{ 
                            animationDelay: `${scene * 100}ms`,
                            opacity: demoStep >= 5 ? 1 : 0.5
                          }}
                        >
                          <div className="h-full flex items-center justify-center">
                            {demoStep >= 5 ? (
                              <div className="text-center">
                                <div className="text-xs text-muted-foreground mb-1">Cena {scene}</div>
                                <div className="w-8 h-8 mx-auto rounded bg-primary/30 flex items-center justify-center">
                                  <Film className="h-4 w-4 text-primary" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {demoStep >= 5 && (
                    <div className="mt-6 text-center">
                      <p className="text-sm text-primary font-medium">
                        ✨ Storyboard gerado com 4 cenas e 12 keyframes
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Floating Labels */}
          <div className="absolute -left-4 top-1/4 hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 border border-border/50 backdrop-blur-sm animate-float">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">Consistência Visual</span>
          </div>
          <div className="absolute -right-4 top-1/2 hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-card/80 border border-border/50 backdrop-blur-sm animate-float" style={{ animationDelay: '1s' }}>
            <Film className="h-4 w-4 text-studio-cyan" />
            <span className="text-xs font-medium">Keyframes de Vídeo</span>
          </div>
        </div>

        {/* Features Row */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            {
              icon: Sparkles,
              title: 'Pipeline Narrativo',
              description: 'Roteiro visual automático dividido em cenas',
              color: 'text-primary',
            },
            {
              icon: Layers,
              title: 'Consistência Extrema',
              description: 'Mesmo personagem e estilo em todas as cenas',
              color: 'text-studio-cyan',
            },
            {
              icon: Film,
              title: 'Prompts de Vídeo',
              description: 'Exportação pronta para Kling e similares',
              color: 'text-studio-purple',
            },
          ].map((feature, i) => (
            <div 
              key={i} 
              className="p-5 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card/50 animate-slide-up"
              style={{ animationDelay: `${400 + i * 100}ms` }}
            >
              <feature.icon className={`h-6 w-6 mb-3 ${feature.color}`} />
              <h3 className="font-display font-semibold text-foreground mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Tagline */}
        <p className="mt-12 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '700ms' }}>
          "Eu não gerei imagens. <span className="text-foreground">Eu criei cenas cinematográficas com realismo extremo.</span>"
        </p>
      </div>
    </div>
  );
}