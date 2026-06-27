# Forja

Instalador desktop pós-formatação para Windows 10/11. O usuário escolhe programas,
drivers e ajustes; a Forja baixa da fonte oficial (winget/npm) e instala em silêncio.

- **Monorepo (pnpm):** `apps/desktop` (Tauri v2 + React/Vite/Tailwind), `packages/catalog` (manifesto + schema compartilhados).
- **Frontend:** `apps/desktop/src` — telas em `src/screens`, UI compartilhada em `src/components/ui.tsx`, estado global em `src/store.tsx`, ponte com o Rust em `src/tauri.ts`, i18n em `src/i18n.ts`.
- **Backend:** `apps/desktop/src-tauri/src` — `catalog.rs`, `detect.rs` (winget list), `install.rs` (winget/npm), `pathtools.rs` (PATH), `hardware.rs` (rede/disco), `tweaks.rs` (ajustes via PowerShell + UAC), `updater.rs`, `system.rs` (ações elevadas: driver Wi-Fi, admin).
- O repositório remoto (`MrMaia/forja`) já sofreu **force-push** no passado — sempre `git fetch` e confira `origin/main`/tags antes de assumir o estado.

## Regras

- **SEMPRE traduza todo texto visível ao usuário.** Nada de string PT fixa nas telas.
  - UI: adicione a chave em `pt` e `en` no `STRINGS`/dicionários de `src/i18n.ts` e leia via `t("chave")` (vindo de `useForja()`).
  - Categorias: `t("cat.<Categoria>")`. Descrições de apps: `tDesc(id, fallbackPt)`. Presets: `tPreset(...)`.
  - Isso inclui: nomes de categorias, descrições dos apps (cards), aba de Instalações, Perfis, Exportar/Importar, Drivers de rede, Ajustes do Windows, banners, estados vazios e alertas.
  - `pt` e `en` devem ter as MESMAS chaves. Esquecer o `en` é um bug.
- Mantenha `packages/catalog/schema.ts` (TS) e `src-tauri/src/catalog.rs` (serde) em sincronia.
- winget/npm é o caminho de instalação; ações elevadas vão por `system.rs`/`tweaks.rs` (um prompt UAC por ação).
