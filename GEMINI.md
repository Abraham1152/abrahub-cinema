# SceneToScreen - Base de Conhecimento Central

## 🚀 Visão Geral
Aplicativo Desktop (.EXE) de alta performance para geração de storyboards e cenas cinematográficas via IA (Gemini BYOK).

## 🛠️ Stack Tecnológica
- **Frontend:** React + TypeScript + Vite + TailwindCSS + Shadcn/UI
- **Backend:** Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Desktop:** Electron (Empacotamento via Electron-Builder)
- **Pagamentos:** Stripe (Webhooks e Checkouts integrados)

## 🏗️ Arquitetura de Dados (Última Sincronização: 19/02/2026)
- **Projeto Supabase:** `vajxjtrztwfolhnkewnq`
- **Tabelas Críticas:** 
  - `profiles`: Dados do usuário e preferências.
  - `user_generated_images`: Registro de todas as gerações.
  - `generation_queue` / `generation_jobs`: Sistema de fila e processamento.
  - `storyboard_scenes`: Estrutura de cenas do projeto.
- **Tipos TS:** Sincronizados em `src/integrations/supabase/types.ts`.

## 📡 Edge Functions (Ativas)
- Total de 22 funções migradas e em produção no novo projeto.
- Secrets configurados para Stripe e Gemini.

## 📦 Instruções de Desenvolvimento
1. **Rodar Dev:** `npm run electron:dev`
2. **Atualizar Tipos do Banco:** `npx supabase gen types typescript --project-id vajxjtrztwfolhnkewnq --schema public > src/integrations/supabase/types.ts`
3. **Gerar Executável:** `npm run dist`

## 📝 Histórico de Mudanças Recentes
- Migração completa do Lovable para Infraestrutura Local/Própria.
- Correção de bugs estruturais no SQL original (upscale_status, generation_jobs).
- Implementação de suporte a Deep Linking no Electron (`main.cjs`).
- Desativação de confirmação de e-mail para facilitar o onboarding.
