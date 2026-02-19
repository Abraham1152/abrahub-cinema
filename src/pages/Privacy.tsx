import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Clock, UserCheck, Cookie, Mail, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function Privacy() {
  const lastUpdated = '02 de fevereiro de 2026';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center px-4 md:px-6">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-4xl py-12 px-4 md:px-6">
        <div className="space-y-2 mb-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Política de Privacidade
          </h1>
          <p className="text-muted-foreground">
            Última atualização: {lastUpdated}
          </p>
        </div>

        <div className="prose prose-invert prose-sm max-w-none space-y-10">
          {/* 1. Introduction */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">1. Introdução</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              A <strong className="text-foreground">ABRAhub</strong> ("nós", "nosso" ou "Controlador") está comprometida 
              em proteger a privacidade dos usuários de nossa plataforma de geração de imagens com inteligência artificial. 
              Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos seus dados pessoais, 
              em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Ao utilizar nossos serviços, você concorda com as práticas descritas nesta política. 
              Recomendamos a leitura atenta deste documento.
            </p>
          </section>

          <Separator />

          {/* 2. Data Collected */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">2. Dados Pessoais Coletados</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Coletamos os seguintes tipos de dados pessoais:
            </p>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="font-medium text-sm">Dados de Cadastro</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Endereço de e-mail</li>
                  <li>• Nome de exibição (opcional)</li>
                  <li>• Foto de perfil (opcional)</li>
                </ul>
              </div>
              
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="font-medium text-sm">Dados de Uso</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Prompts de geração de imagens</li>
                  <li>• Configurações de equipamento (câmera, lente)</li>
                  <li>• Preferências de interface</li>
                </ul>
              </div>
              
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="font-medium text-sm">Conteúdo Gerado</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Imagens geradas pela IA</li>
                  <li>• Imagens de referência enviadas</li>
                  <li>• Metadados associados</li>
                </ul>
              </div>
              
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="font-medium text-sm">Dados de Pagamento</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Processados via Stripe (terceiro)</li>
                  <li>• Não armazenamos dados de cartão</li>
                  <li>• Mantemos histórico de transações</li>
                </ul>
              </div>
            </div>
          </section>

          <Separator />

          {/* 3. Purpose */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">3. Finalidades do Tratamento</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados são tratados para as seguintes finalidades:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Prestação do serviço:</strong> Gerar imagens conforme suas instruções e preferências</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Autenticação:</strong> Verificar sua identidade e manter a segurança da conta</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Pagamentos:</strong> Processar assinaturas e créditos através do Stripe</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Melhoria do serviço:</strong> Analisar uso (de forma agregada) para aprimorar a plataforma</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Comunicação:</strong> Enviar notificações sobre sua conta e o serviço</span>
              </li>
            </ul>
            
            <div className="rounded-lg bg-secondary/30 border border-border p-4 mt-4">
              <h4 className="font-medium text-sm mb-2">Base Legal (LGPD Art. 7º)</h4>
              <p className="text-xs text-muted-foreground">
                O tratamento de dados é realizado com base em: <strong>consentimento</strong> (para cookies opcionais), 
                <strong> execução de contrato</strong> (para prestação do serviço), e <strong>legítimo interesse</strong> (para melhorias e segurança).
              </p>
            </div>
          </section>

          <Separator />

          {/* 4. Storage & Security */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">4. Armazenamento e Retenção</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Seus dados são armazenados em servidores seguros com as seguintes políticas de retenção:
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium">Tipo de Dado</th>
                    <th className="text-left py-3 px-4 font-medium">Período de Retenção</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Imagens geradas</td>
                    <td className="py-3 px-4">3 dias (exclusão automática)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Dados da conta</td>
                    <td className="py-3 px-4">Enquanto a conta estiver ativa</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Logs de acesso</td>
                    <td className="py-3 px-4">90 dias</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4">Histórico de transações</td>
                    <td className="py-3 px-4">5 anos (obrigação fiscal)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Utilizamos criptografia em trânsito (TLS/SSL) e em repouso. O acesso aos dados é restrito 
              a funcionários autorizados com necessidade legítima.
            </p>
          </section>

          <Separator />

          {/* 5. Third Parties */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">5. Compartilhamento com Terceiros</h2>
            <p className="text-muted-foreground leading-relaxed">
              Compartilhamos dados apenas com os seguintes parceiros, estritamente para prestação do serviço:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Stripe:</strong> Processamento de pagamentos (dados de cobrança)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Provedores de IA:</strong> Processamento de prompts para geração de imagens</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span><strong className="text-foreground">Infraestrutura em nuvem:</strong> Armazenamento seguro de dados</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">
              Não vendemos, alugamos ou comercializamos seus dados pessoais. Não compartilhamos dados 
              para fins de marketing de terceiros.
            </p>
          </section>

          <Separator />

          {/* 6. User Rights */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCheck className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">6. Seus Direitos (LGPD)</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Como titular dos dados, você possui os seguintes direitos:
            </p>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Acesso</h4>
                <p className="text-xs text-muted-foreground">Solicitar cópia dos dados que temos sobre você</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Correção</h4>
                <p className="text-xs text-muted-foreground">Atualizar dados incompletos ou incorretos</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Exclusão</h4>
                <p className="text-xs text-muted-foreground">Solicitar remoção dos seus dados pessoais</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Portabilidade</h4>
                <p className="text-xs text-muted-foreground">Receber seus dados em formato estruturado</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Revogação</h4>
                <p className="text-xs text-muted-foreground">Retirar consentimento a qualquer momento</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <h4 className="font-medium text-sm mb-1">Oposição</h4>
                <p className="text-xs text-muted-foreground">Opor-se a tratamento baseado em legítimo interesse</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              Para exercer seus direitos, entre em contato através do e-mail indicado na seção de Contato.
              Responderemos em até 15 dias úteis.
            </p>
          </section>

          <Separator />

          {/* 7. Cookies */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">7. Cookies e Tecnologias</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Utilizamos cookies para melhorar sua experiência. Você pode gerenciar suas preferências 
              a qualquer momento.
            </p>
            
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Cookies Essenciais</h4>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Sempre Ativos</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Necessários para autenticação, segurança e funcionamento básico da plataforma. 
                  Incluem tokens de sessão e preferências de consentimento.
                </p>
              </div>
              
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Cookies Funcionais</h4>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">Opcional</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Memorizam suas preferências de interface, como tema (claro/escuro), 
                  configurações de exibição e idioma.
                </p>
              </div>
              
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Cookies Analíticos</h4>
                  <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">Opcional</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Coletam informações anônimas sobre como você usa o site, ajudando-nos a 
                  identificar problemas e melhorar a experiência.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* 8. Changes */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">8. Alterações nesta Política</h2>
            <p className="text-muted-foreground leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Quando fizermos alterações 
              significativas, notificaremos você por e-mail ou através de um aviso em nossa plataforma. 
              A data da última atualização está indicada no topo desta página.
            </p>
          </section>

          <Separator />

          {/* 9. Contact */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold m-0">9. Contato</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Para dúvidas, solicitações ou exercício de direitos relacionados aos seus dados pessoais:
            </p>
            <div className="rounded-lg bg-secondary/30 border border-border p-4">
              <p className="text-sm">
                <strong>E-mail:</strong>{' '}
                <a href="mailto:privacidade@abrahub.com" className="text-primary hover:underline">
                  privacidade@abrahub.com
                </a>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Encarregado de Proteção de Dados (DPO): Disponível mediante solicitação.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} ABRAhub. Todos os direitos reservados.
          </p>
        </div>
      </main>
    </div>
  );
}
