# ABRAhub Cinema - Contexto de Engenharia

## 🎯 Objetivo Atual
Migrar o sistema Lovable para uma infraestrutura própria (Supabase + GitHub/Vercel) no modelo **Local-First Web**. Os alunos usam o site, mas os arquivos pesados são deletados após 7 dias para economizar storage.

## 🏗️ Arquitetura e Deploy
- **Produção (Alunos):** Branch `main` -> GitHub Pages (https://abraham1152.github.io/abrahub-cinema/)
- **Staging (Testes):** Branch `staging` -> Vercel (https://abrahub-cinema.vercel.app/)
- **Banco de Dados:** Supabase projeto `vajxjtrztwfolhnkewnq`.
- **Identidade:** O app foi renomeado de SceneToScreen para **ABRAhub Cinema**.

## 🛠️ Configurações Críticas
- **Staging/Vercel:** O `vite.config.ts` está configurado para `base: "/"`. O `vercel.json` foi removido para evitar conflitos de redirecionamento SPA.
- **Imagens Presets:** 47 imagens no bucket `preset-images`.
  - `/film_look/` (OK)
  - `/focal/` (OK)
  - `/angle/` (OK)
  - `/camera/` (Links reais aplicados via script `apply_real_links.cjs`).
- **Webhook Stripe:** Configurado com a chave `whsec_EvmVSFtzpAb4d7K2YtEqgOQ7z5imqf3k`. URL: `https://vajxjtrztwfolhnkewnq.supabase.co/functions/v1/stripe-webhook`.

## 🚨 Pendências Imediatas (Onde paramos)
1. **Erro 401 na Vercel:** O site carrega (vencemos a tela branca), mas dá erro de autorização. **Ação:** O usuário precisa garantir que `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` na Vercel não tenham espaços e sejam as mesmas do `.env`.
2. **Promoção Admin:** O e-mail `pezanella94@gmail.com` já foi promovido a admin via script local.
3. **Backup de Usuários:** Aguardando lista de e-mails para importação em massa na `authorized_users`.
