
# Fix: Heranca de Estilo sem Personagem no Storyboard

## Problema

O Storyboard monta uma instrucao textual (`referencePromptInjection`) no frontend e envia para a edge function `queue-image-generation`. Porem, essa edge function **ignora** esse campo -- ela nao faz parte da interface `QueueImageRequest`. A funcao constroi sua propria instrucao internamente usando os flags `sequenceMode`, `sequenceKeepCharacter` e `sequenceKeepScenery`, que o Storyboard **nao esta enviando**.

Resultado: a ancora de estilo cai no fluxo padrao de classificacao automatica (Smart Reference), que trata a imagem como referencia de personagem e reproduz o personagem inteiro.

## Solucao

Reutilizar o sistema de Sequence Mode que ja existe na edge function, passando os flags corretos a partir do hook `useStoryboard.ts`.

## Mudancas

### 1. `src/hooks/useStoryboard.ts` (funcao `generateImage`)

Remover a construcao manual de `referencePromptInjection` e, em vez disso, enviar os flags que a edge function ja entende:

- Quando houver `styleReferenceImages` (ancora de estilo de cena pai):
  - Enviar `sequenceMode: true`
  - Enviar `sequenceKeepCharacter: inherit_character` (do `style_data` da cena)
  - Enviar `sequenceKeepScenery: inherit_environment` (do `style_data` da cena)
- Remover o campo `referencePromptInjection` do body da chamada

Isso faz com que a edge function use os prompts de continuidade ja testados e robustos (os mesmos do modo Sequencia do Studio), que incluem instrucoes explicitas como "Do NOT reproduce characters or people from the reference" quando `keepCharacter` esta desligado.

### 2. Nenhuma mudanca na edge function

A logica de `sequenceMode` com `keepCharacter`/`keepScenery` ja esta pronta e testada na edge function. Nao precisa de alteracao.

## Detalhes tecnicos

A chamada na funcao `generateImage` passara de:

```typescript
body: {
  prompt, aspectRatio, quality, presetId, focalLength,
  aperture, cameraAngle, filmLook,
  referenceImages: allReferenceImages,
  referencePromptInjection,  // IGNORADO pela edge function
  useOwnKey,
}
```

Para:

```typescript
body: {
  prompt, aspectRatio, quality, presetId, focalLength,
  aperture, cameraAngle, filmLook,
  referenceImages: allReferenceImages,
  sequenceMode: hasStyleAnchors,
  sequenceKeepCharacter: inheritCharacter,
  sequenceKeepScenery: inheritEnvironment,
  useOwnKey,
}
```

Onde `hasStyleAnchors = styleReferenceImages.length > 0`, `inheritCharacter` e `inheritEnvironment` vem do `style_data` da cena (como ja esta sendo lido).
