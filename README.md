# Forja — _Do zero ao pronto._

App desktop (Windows-first) que automatiza a configuração de um PC recém-formatado:
você escolhe os programas, a Forja baixa da fonte oficial e instala em silêncio via
**winget**, mostrando progresso em tempo real. O diferencial: salvar a seleção como
um arquivo **`.forja`** portátil e reimportar na próxima formatação com um clique.

Stack: **Tauri v2** (Rust) + **React + TypeScript + Vite + TailwindCSS**, em um
monorepo pnpm. Empacotamento NSIS.

## Recursos

- **Catálogo manifest-driven** com categorias, busca e seleção múltipla.
- **Perfis prontos** por persona (Dev, Gamer, Office, Streamer, Estudante).
- **Instalação silenciosa via winget** com progresso em tempo real — fila,
  barra de download (`baixando · %`) e status por item.
- **Aba Instalações** global: o progresso sobrevive à navegação entre telas.
- **Detecção do que já está instalado** + versão, com botão **Atualizar** quando
  há versão nova (casa o id real do winget, que costuma diferir do id de
  instalação — ex.: `Google.Chrome` ↔ `Google.Chrome.EXE`).
- **Exportar / Importar** a seleção como arquivo `.forja` portátil.
- **Ícones reais** dos apps (CDN), com fallback para monograma offline.

## Rodando

**Pré-requisitos**
- [Node 18+](https://nodejs.org) e [pnpm 9+](https://pnpm.io) (`npm i -g pnpm`)
- [Rust](https://rustup.rs) + pré-requisitos do Tauri no Windows
  ([WebView2 + MSVC Build Tools](https://tauri.app/start/prerequisites/))
- `winget` (já vem no Windows 10/11 atualizado)

```bash
pnpm install
pnpm tauri dev      # app desktop completo (Rust + React)
```

Para mexer só na UI sem a toolchain Rust, dá pra rodar no navegador — o catálogo é
carregado do JSON e a instalação é simulada:

```bash
pnpm dev            # http://localhost:1420
```

Build do instalador:

```bash
pnpm tauri build    # gera o .exe NSIS em apps/desktop/src-tauri/target/release/bundle
```

## Estrutura

```
packages/catalog/      dados puros e reutilizáveis (sem React/Rust)
  schema.ts            tipos do manifest + perfil (fonte da verdade dos tipos)
  catalog.json         catálogo seed
  presets.json         perfis prontos (Dev, Gamer, Office, Streamer, Estudante)

apps/desktop/
  src/                 React: 5 telas (Onboarding, Catálogo, Perfis, Instalação, Export/Import)
  src-tauri/
    src/catalog.rs     structs serde + validação do manifest (get_catalog / get_presets)
    src/install.rs     spawn do winget + eventos de progresso (install_programs)
    capabilities/      allowlist do shell para o comando winget
```

## Como adicionar um item ao catálogo

Edite **`packages/catalog/catalog.json`** e acrescente um objeto:

```json
{
  "id": "obsidian",
  "name": "Obsidian",
  "category": "Produtividade",
  "description": "Notas em markdown com grafo de conhecimento.",
  "icon": { "label": "Ob", "bg": "#3a3540", "fg": "#ddd6e4" },
  "winget": "Obsidian.Obsidian",
  "fallbackUrl": "https://obsidian.md/download",
  "postInstall": []
}
```

- `id` — kebab-case, estável: é o que os perfis `.forja` guardam.
- `category` — uma de: Essenciais, Navegadores, Comunicação, Mídia, Produtividade,
  Desenvolvimento, Games, Drivers.
- `icon` — monograma de 2 letras + cores (o protótipo não usa logos reais).
- `winget` — id do pacote (`winget search <nome>` para descobrir). Use `null` para
  itens fora do winget; aí a Forja oferece o deep-link da `fallbackUrl`.

Para incluí-lo num perfil pronto, adicione o `id` em `packages/catalog/presets.json`.
A validação serde roda nos testes do Rust:

```bash
cd apps/desktop/src-tauri && cargo test
```

## Deixado para depois (stubs/TODO marcados no código)

- **Drivers / itens sem winget**: hoje só marcam `skipped` e abrem o site oficial.
  Instalação real + elevação UAC (`elevated-command`) fica numa próxima versão —
  ver `install.rs::install_one`.
- **macOS / Linux**: o foco da v1 é Windows.
- **postInstall**: o campo existe no schema mas ainda não é executado.
