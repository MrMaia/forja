# Detecção de versão por comando — design

Data: 2026-06-29

## Problema

A Forja detecta programas por dois sinais: `winget list` (versão + upgrade) e
presença do executável no PATH/pastas conhecidas (`pathtools.rs`). Ferramentas
instaladas **fora do winget** (ex.: PHP 8.5.5 instalado manualmente) só seriam
pegas pelo probe de executável — mas várias entradas de linguagem (php, bun,
deno, java-temurin, miniconda) **não têm o campo `exe`** no catálogo, então o
probe nem roda pra elas. Resultado: ficam como "não instalado".

Além disso, mesmo quando o probe de executável encontra o binário, ele só diz
"está aqui" — não traz a **versão**. O usuário quer ver a versão real de cada
ferramenta CLI, inclusive em instalações manuais.

## Objetivo

Para **toda** ferramenta com `exe` (todas as CLIs do catálogo, não só
Linguagens), detectar presença E a **versão exata**, rodando o comando de versão
do próprio binário encontrado.

## Não-objetivos

- Apps GUI (Chrome, Discord, IDEs) — não têm `exe`, não recebem probe.
- Runtimes sem CLI (vcredist, dotnet-runtime) — sem `exe`, ficam de fora.
- Alterar a detecção via winget (continua sendo a fonte primária de versão).

## Design

### 1. Backend — `pathtools.rs`

- `PathToolInfo` ganha `version: Option<String>`.
- `PathSpec` ganha `version_arg: Option<String>` (vindo do catálogo; default
  `--version`).
- Quando `probe` **encontra** o executável (no PATH ou install dir), roda o
  binário encontrado com o arg de versão, captura **stdout + stderr** e extrai a
  primeira ocorrência de `\d+\.\d+(?:\.\d+)?` como a versão. Cobre os formatos
  comuns: `PHP 8.5.5`, `v22.1.0`, `cargo 1.77.0`, `go version go1.22.0`,
  `openjdk 21.0.1`, `conda 24.1.0`.
- `check_path_tools` passa de `#[tauri::command]` (síncrono, **main thread**)
  para `#[tauri::command(async)]`. Hoje ele só faz I/O de arquivo; ao passar a
  spawnar processos, **precisa** sair da main thread — mesma classe do bug de
  congelamento já corrigido em `system.rs`. Processos criados com
  `CREATE_NO_WINDOW` (sem janela de cmd), via um helper local (mesmo padrão do
  `quiet_command` de `system.rs`).
- O probe de versão só roda para ferramentas **encontradas** (instaladas) — um
  punhado de subprocessos rápidos. Erros ao rodar/parsing → `version: None`
  (silencioso; presença ainda é reportada).
- **`.cmd`/`.bat`** (ex.: `claude.cmd`) não executam direto via `CreateProcess`;
  esses rodam via `cmd /c "<caminho>" <arg>` (também com `CREATE_NO_WINDOW`).
  `.exe` roda direto.

### 2. Catálogo + schema

- Novo campo opcional `versionArg?: string` em `schema.ts` e
  `#[serde(rename = "versionArg", default)] pub version_arg: Option<String>` em
  `catalog.rs::Program`. `PathSpec` (pathtools) também recebe `version_arg`.
- O frontend (`store.tsx::loadInstalled`) passa `versionArg: p.versionArg` ao
  montar `pathSpecs`.
- Override de `versionArg` só onde o flag difere do default `--version`:
  - **go** → `version` (o comando é `go version`, não `go --version`).
- Adicionar `exe`/`installDirs` às linguagens que faltam:
  - **php** → `exe: ["php.exe"]`
  - **bun** → `exe: ["bun.exe"]`
  - **deno** → `exe: ["deno.exe"]`
  - **java-temurin** → `exe: ["java.exe"]`, `installDirs` no padrão
    `%ProgramFiles%\Eclipse Adoptium\*\bin`
  - **miniconda** → `exe: ["conda.exe"]`

### 3. Frontend — `Catalog.tsx`

- O estado "instalado · vX" ([Catalog.tsx:461]) hoje usa só `info?.installed`
  (winget). Passa a usar `info?.installed ?? pinfo?.version`, de modo que
  instalações manuais (PHP) mostrem a versão vinda do comando.
- Reconciliação: **winget tem prioridade** quando fornece versão; o probe
  preenche a lacuna. Nada muda para ferramentas já detectadas via winget.

## Fluxo de dados

```
catálogo (exe + versionArg)
  → store.loadInstalled monta pathSpecs (com versionArg)
  → invoke check_path_tools (async, worker thread)
     → probe encontra o exe → roda <exe> <versionArg> (CREATE_NO_WINDOW)
        → extrai semver de stdout+stderr → version
  → PathToolInfo { installed, onPath, pathDir, version }
  → card mostra "✓ instalado · v<info.installed ?? pinfo.version>"
```

## Tratamento de erro

- Falha ao spawnar / exit não-zero / sem semver no output → `version: None`.
  A presença (`installed`/`onPath`) é independente e continua valendo.
- Sem regressão de performance perceptível: probe de versão só para instalados,
  em worker thread.

## Testes

- `pathtools.rs`: teste de unidade do parser de versão (extrai a primeira
  `\d+\.\d+(\.\d+)?` de strings de exemplo: PHP/node/go/java). Os testes de
  `probe` existentes continuam válidos (a versão é `None` quando não há comando).
- `cargo check`/`cargo test` no `src-tauri`.
- Verificação manual: abrir a Forja com PHP manual instalado → card "PHP" mostra
  "✓ instalado · v8.5.5".
