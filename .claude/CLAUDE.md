# Synkra AIOS Development Rules for Claude Code

You are working with Synkra AIOS, an AI-Orchestrated System for Full Stack Development.

<!-- AIOS-MANAGED-START: core-framework -->
## Core Framework Understanding

Synkra AIOS is a meta-framework that orchestrates AI agents to handle complex development workflows. Always recognize and work within this architecture.
<!-- AIOS-MANAGED-END: core-framework -->

<!-- AIOS-MANAGED-START: agent-system -->
## Agent System

### Agent Activation
- Agents are activated with @agent-name syntax: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- The master agent is activated with @aios-master
- Agent commands use the * prefix: *help, *create-story, *task, *exit

### Agent Context
When an agent is active:
- Follow that agent's specific persona and expertise
- Use the agent's designated workflow patterns
- Maintain the agent's perspective throughout the interaction
<!-- AIOS-MANAGED-END: agent-system -->

## Development Methodology

### Story-Driven Development
1. **Work from stories** - All development starts with a story in `docs/stories/`
2. **Update progress** - Mark checkboxes as tasks complete: [ ] → [x]
3. **Track changes** - Maintain the File List section in the story
4. **Follow criteria** - Implement exactly what the acceptance criteria specify

### Code Standards
- Write clean, self-documenting code
- Follow existing patterns in the codebase
- Include comprehensive error handling
- Add unit tests for all new functionality
- Use TypeScript/JavaScript best practices

### Testing Requirements
- Run all tests before marking tasks complete
- Ensure linting passes: `npm run lint`
- Verify type checking: `npm run typecheck`
- Add tests for new features
- Test edge cases and error scenarios

<!-- AIOS-MANAGED-START: framework-structure -->
## AIOS Framework Structure

```
aios-core/
├── agents/         # Agent persona definitions (YAML/Markdown)
├── tasks/          # Executable task workflows
├── workflows/      # Multi-step workflow definitions
├── templates/      # Document and code templates
├── checklists/     # Validation and review checklists
└── rules/          # Framework rules and patterns

docs/
├── stories/        # Development stories (numbered)
├── prd/            # Product requirement documents
├── architecture/   # System architecture documentation
└── guides/         # User and developer guides
```
<!-- AIOS-MANAGED-END: framework-structure -->

## Workflow Execution

### Task Execution Pattern
1. Read the complete task/workflow definition
2. Understand all elicitation points
3. Execute steps sequentially
4. Handle errors gracefully
5. Provide clear feedback

### Interactive Workflows
- Workflows with `elicit: true` require user input
- Present options clearly
- Validate user responses
- Provide helpful defaults

## Best Practices

### When implementing features:
- Check existing patterns first
- Reuse components and utilities
- Follow naming conventions
- Keep functions focused and testable
- Document complex logic

### When working with agents:
- Respect agent boundaries
- Use appropriate agent for each task
- Follow agent communication patterns
- Maintain agent context

### When handling errors:
```javascript
try {
  // Operation
} catch (error) {
  console.error(`Error in ${operation}:`, error);
  // Provide helpful error message
  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

## Git & GitHub Integration

### Commit Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Reference story ID: `feat: implement IDE detection [Story 2.1]`
- Keep commits atomic and focused

### GitHub CLI Usage
- Ensure authenticated: `gh auth status`
- Use for PR creation: `gh pr create`
- Check org access: `gh api user/memberships`

<!-- AIOS-MANAGED-START: aios-patterns -->
## AIOS-Specific Patterns

### Working with Templates
```javascript
const template = await loadTemplate('template-name');
const rendered = await renderTemplate(template, context);
```

### Agent Command Handling
```javascript
if (command.startsWith('*')) {
  const agentCommand = command.substring(1);
  await executeAgentCommand(agentCommand, args);
}
```

### Story Updates
```javascript
// Update story progress
const story = await loadStory(storyId);
story.updateTask(taskId, { status: 'completed' });
await story.save();
```
<!-- AIOS-MANAGED-END: aios-patterns -->

## Environment Setup

### Required Tools
- Node.js 18+
- GitHub CLI
- Git
- Your preferred package manager (npm/yarn/pnpm)

### Configuration Files
- `.aios/config.yaml` - Framework configuration
- `.env` - Environment variables
- `aios.config.js` - Project-specific settings

<!-- AIOS-MANAGED-START: common-commands -->
## Common Commands

### AIOS Master Commands
- `*help` - Show available commands
- `*create-story` - Create new story
- `*task {name}` - Execute specific task
- `*workflow {name}` - Run workflow

### Development Commands
- `npm run dev` - Start development
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run build` - Build project
<!-- AIOS-MANAGED-END: common-commands -->

## Debugging

### Enable Debug Mode
```bash
export AIOS_DEBUG=true
```

### View Agent Logs
```bash
tail -f .aios/logs/agent.log
```

### Trace Workflow Execution
```bash
npm run trace -- workflow-name
```

## Claude Code Specific Configuration

### Performance Optimization
- Prefer batched tool calls when possible for better performance
- Use parallel execution for independent operations
- Cache frequently accessed data in memory during sessions

### Tool Usage Guidelines
- Always use the Grep tool for searching, never `grep` or `rg` in bash
- Use the Task tool for complex multi-step operations
- Batch file reads/writes when processing multiple files
- Prefer editing existing files over creating new ones

### Session Management
- Track story progress throughout the session
- Update checkboxes immediately after completing tasks
- Maintain context of the current story being worked on
- Save important state before long-running operations

### Error Recovery
- Always provide recovery suggestions for failures
- Include error context in messages to user
- Suggest rollback procedures when appropriate
- Document any manual fixes required

### Testing Strategy
- Run tests incrementally during development
- Always verify lint and typecheck before marking complete
- Test edge cases for each new feature
- Document test scenarios in story files

### Documentation
- Update relevant docs when changing functionality
- Include code examples in documentation
- Keep README synchronized with actual behavior
- Document breaking changes prominently

---

## ABRAhub Cinema — Project Context

### Identidade do Projeto
- **Nome**: ABRAhub Cinema
- **Repositório**: Abraham1152/abrahub-cinema
- **Supabase Project ID**: `vajxjtrztwfolhnkewnq`
- **Stack**: React 18 + TypeScript + Vite + SWC, TailwindCSS, shadcn/ui, Supabase, HashRouter (GitHub Pages)
- **Modelo de IA**: Gemini 2.5 Flash via BYOK — usuários trazem sua própria chave Gemini armazenada em `user_api_keys` (`gemini_api_key`, `is_valid`)

### Fluxo de Deploy
- **Frontend**: `git push origin main` → GitHub Actions auto-build e deploy no GitHub Pages (sem `npm run build` manual)
- **Supabase Functions**: `npx supabase functions deploy <nome-da-function>` (projeto já está linkado)
- Sempre fazer os dois juntos quando há mudanças de backend + frontend

### Arquitetura Principal
- `src/pages/Index.tsx` — estúdio principal (galeria em Map, subscriptions realtime, UI otimista)
- `src/hooks/useStoryboard.ts` — lógica do storyboard, `createScenesFromStructure`
- `src/components/storyboard/` — SceneBlock, AIDirectorModal, AIDirectorPreview
- `supabase/functions/process-generation-queue/` — geração de imagens via Gemini
- `supabase/functions/storyboard-generate-structure/` — estrutura de campanha do AI Director

### Padrões Críticos de Código
- Galeria usa `Map<string, GalleryItem>` — queue IDs como chave substituídos por image IDs ao concluir
- `optimisticQueueIdsRef` e `queueToImageMapRef` rastreiam gerações pendentes
- **Realtime swap deve ser atômico** — nunca ler e escrever em dois `setGalleryMap` separados
- **Grid/Split**: flags `is_story6`, `reference_type: 'split_upscale'`, `reference_prompt_injection: 'panel_number:N'`
- **Gemini exige base64 inline** — NUNCA enviar URLs públicas; sempre usar `fetchImageAsBase64()` antes da chamada à API
- `style_data` (coluna JSON) armazena metadados por cena (video_prompt, scene_emotion, etc.)

### Features Implementadas
- **AI Director**: form com 4 Selects (Tipo, Duração, Formato, Tom) — manter selects, não trocar por toggle buttons
- **AI Director Preview**: film strip horizontal com header/footer fixos, cards scrolláveis, botões pequenos e centralizados
- **video_prompt por cena**: 50-80 palavras em inglês, sequence-aware para continuidade de campanha
- **SceneBlock**: seção `VideoPromptSection` — somente leitura, colapsável, com botão de cópia

### Preferências do Usuário
- UI em **português (pt-BR)** — toasts, labels, botões, mensagens de erro
- Prompts de IA em **inglês** (image prompts e video prompts)
- Design minimalista e escuro (neutral-950, primary color accents)
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Sempre fazer deploy (git push + supabase deploy) após mudanças de código

### Integrações de Vídeo (Planejadas)
- Kling v3 via fal.ai como BYOK (~$0.10/s Standard, ~$0.20/s Pro)
- Seedance 2.0 via fal.ai (aguardar disponibilidade da API)
- fal.ai: API key simples, pay-per-use, JS SDK disponível

---
*Synkra AIOS Claude Code Configuration v2.0*
