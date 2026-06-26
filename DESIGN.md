# Forja — Design System

Referência visual fiel ao protótipo do Claude Design (`Forja.dc.html`).
Tema **escuro + acento âmbar incandescente**. Tagline: _Do zero ao pronto._

> Princípio do protótipo: _"Acento âmbar = seleção, ação e progresso. Base
> neutra escura, sem exagero no tema fogo."_

## Paleta

Tokens em [tailwind.config.js](apps/desktop/tailwind.config.js).

| Token | Hex | Uso |
|---|---|---|
| `forge.bg` | `#14110f` | fundo principal das telas |
| `forge.chrome` | `#100e0c` | barra de título / topo |
| `forge.deep` | `#0f0d0b` | barras de ação (footer) |
| `forge.inset` | `#110f0d` | sidebar |
| `forge.panel` | `#1a1613` | cards, inputs, painéis |
| `forge.text` | `#f0ebe4` | texto principal |
| `forge.muted` | `#a39a8e` | texto secundário |
| `forge.faint` | `#6f665c` | labels mono, contadores |
| `forge.dim` | `#5f564c` | ícones inertes |
| `amber.from → amber.to` | `#f9a455 → #e8792b` | gradiente de ação (botões, seleção) |
| `amber.light` | `#f5a85e` | links/destaques de texto |
| `amber.soft` | `#f7b377` | números, badges |
| `amber.glow` | `#f5933f` | barra ativa, glow |
| `status.done` | `#5bbf8a` | concluído |
| `status.downloading` | `#5b9fd4` | baixando |
| `status.error` | `#e25d4f` | erro |

Glow âmbar padrão: `rgba(245,147,63,α)` em `box-shadow`/`radial-gradient`.

## Tipografia

- **Space Grotesk** — toda a UI (400/500/600/700).
- **JetBrains Mono** — números, contadores, labels em maiúsculas, nomes de
  arquivo, versões, linhas de log. (`font-mono`)

Labels de seção: mono, `10.5px`, `uppercase`, `letter-spacing 0.08–0.12em`,
cor `forge.faint`.

## Marca

- **Diamante**: quadrado girado 45° com gradiente âmbar e glow. Componente
  [`<Diamond>`](apps/desktop/src/components/ui.tsx). Tamanhos: 13px (chrome),
  30–34px (banners/cards), 62px (onboarding).

## Componentes

Todos em [src/components/ui.tsx](apps/desktop/src/components/ui.tsx) salvo nota.

| Componente | Descrição |
|---|---|
| `TitleBar` | Chrome de 44px (janela sem borda nativa). Logo + seção à esquerda; botões reais minimizar/maximizar/fechar à direita. Arrastável (`data-tauri-drag-region`). |
| `WindowButton` | Controle de janela 36×28, hover sutil; fechar fica vermelho. |
| `Diamond` | Marca âmbar girada. |
| `AppIcon` | Ícone real do app (`iconUrl`) sobre tile neutro; cai para `Monogram` se a imagem falhar. |
| `Monogram` | Tile colorido com monograma de 2 letras (fallback / offline). |
| `AmberButton` | Botão primário com gradiente âmbar e elevação no hover. |
| `BackLink` | Botão "voltar" secundário: pílula com chevron à esquerda que recua no hover. |
| `Chevron` | Seta fina direcional (`currentColor`). |

### Cards
- **Raio**: 12px (programa) / 14px (perfil, painel).
- **Selecionado**: borda `amber.glow/55` + fundo `amber.glow/9` + check âmbar.
- **Não selecionado**: borda `white/6` sobre `forge.panel`, hover `white/14`.

### Estados de instalação (catálogo)
- **Instalado e atual**: badge verde discreto `✓ instalado vX` (`status.done`).
- **Desatualizado**: badge âmbar `vX → vY` + botão **Atualizar**.
- **Não instalado**: sem badge.

### Status de progresso (instalação)
Legenda do protótipo: Concluído (verde), Instalando (âmbar), Baixando (azul),
Na fila (cinza), Erro (vermelho). Spinner âmbar (`forjaSpin`) no item ativo.

## Animações

Em [index.css](apps/desktop/src/index.css):
- `forjaPulse` — glow pulsante do onboarding (4s).
- `forjaSpin` — spinner de item instalando (0.8s linear).
- Micro-interações via Tailwind: `hover:-translate-y-px` (botões),
  `group-hover:translate-x-0.5` (chevrons).

## Telas

Referência 1280×800, janela sem decoração nativa.

1. **Onboarding** — logo, tagline, CTA "Montar do zero" / "Escolher perfil",
   chips de perfil. Fundo: grade sutil + glow âmbar pulsante.
2. **Catálogo** — sidebar de categorias (com contadores) + busca + grid 3-col
   de `ProgramCard` + barra de ação (selecionados, ~tamanho, instalar).
3. **Perfis prontos** — grid 3×2 de presets (1º em destaque "POPULAR") +
   card tracejado "Montar do zero".
4. **Instalação** — progresso geral (% + barra) + fila de itens com status +
   legenda.
5. **Exportar / Importar** — banner `.forja`, painel de export (seleção +
   nome do arquivo) e painel de import (dropzone + perfis recentes).
