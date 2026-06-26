# Detecção por executável + suporte a PATH — Design

Data: 2026-06-26
Status: aprovado (aguardando revisão da spec)

## Problema

A detecção de "o que já está instalado" hoje vem só do `winget list`, que dá
versão e upgrade disponível. Isso tem duas lacunas para ferramentas de dev:

1. **Apps instalados fora do winget** (instalador oficial, etc.) nem sempre são
   reconhecidos de forma confiável. Ex.: Node instalado pelo `.msi` aparece como
   `ARP\Machine\X64\{GUID}` — resolvido parcialmente por match de nome, mas frágil.
2. **PATH**: linguagens/CLIs podem estar instaladas e **fora do PATH** (ex.: Python
   instalado sem marcar "Add to PATH"), e a Forja não detecta nem ajuda a corrigir.

## Objetivo

Adicionar um **segundo sinal de detecção** — a presença do executável no disco e
no PATH — para ferramentas dev, e um fluxo de **um clique para adicionar ao PATH
do usuário**. Os dois sinais se complementam: o winget continua dando versão e
upgrade; o executável dá "existe?" e "está no PATH?".

Escopo inicial de ferramentas: **Git, Node, Python, GitHub CLI, Docker**.

## Não-objetivos (YAGNI)

- PATH do **sistema** (todos os usuários / requer admin). Só PATH do usuário.
- Detecção por executável para todos os apps de GUI do catálogo.
- Descobrir versão rodando o executável (o winget já fornece versão).
- Varredura própria do registro Uninstall (o winget list já lê o registro).

## Design

### 1. Schema do catálogo (`packages/catalog/schema.ts` + `catalog.rs`)

Campos **opcionais** novos em `Program`:

- `exe?: string[]` — nomes do executável a procurar.
  Ex.: `["git.exe"]`, `["node.exe"]`, `["python.exe", "python3.exe"]`.
- `installDirs?: string[]` — pastas-candidatas onde o executável fica quando
  instalado, com variáveis de ambiente do Windows (`%ProgramFiles%`, etc.).
  Ex.: Git `["%ProgramFiles%\\Git\\cmd"]`, Node `["%ProgramFiles%\\nodejs"]`.

Preenchidos agora para Git, Node, Python, GitHub CLI, Docker. Estender no futuro
é só editar o JSON — sem mudança de código.

As structs serde em `catalog.rs` ganham os mesmos campos opcionais
(`#[serde(default)]`), mantendo a paridade Rust↔TS já documentada no schema.

### 2. Detecção por executável (Rust — nativo, sem novas crates)

Novo comando Tauri `check_path_tools(specs)` em um módulo novo
(`src-tauri/src/pathtools.rs`). Para cada programa que tem `exe`:

1. Procura cada `exe` nas pastas do `PATH` do processo. Achou → `installed=true`,
   `onPath=true`, `pathDir=<pasta>`.
2. Senão, procura cada `exe` em cada `installDirs` (expandindo variáveis de
   ambiente). Achou → `installed=true`, `onPath=false`, `pathDir=<pasta candidata>`.
3. Senão → `installed=false` (cai no resultado do winget).

Tipo de retorno por id:

```rust
struct PathToolInfo {
    id: String,
    installed: bool,
    on_path: bool,
    path_dir: Option<String>, // pasta a adicionar ao PATH quando on_path = false
}
```

Expansão de `%VAR%`: helper simples lendo `std::env::var`. Sem crates novas.

### 3. Adicionar ao PATH do usuário (Rust)

Novo comando `add_to_user_path(dir: String) -> Result<(), String>`:

- Usa o shell plugin para rodar PowerShell:
  - lê `[Environment]::GetEnvironmentVariable('Path','User')`
  - se `dir` ainda não estiver lá (comparação case-insensitive por segmento),
    grava `('...;' + dir)` via `[Environment]::SetEnvironmentVariable('Path', $novo, 'User')`.
- `SetEnvironmentVariable` no escopo `User` escreve no registro **e** dispara o
  broadcast `WM_SETTINGCHANGE` — terminais novos pegam o PATH atualizado. Sem o
  truncamento de 1024 chars do `setx`. Sem admin.
- Idempotente: não duplica.

**Decisão técnica:** PowerShell em vez das crates `winreg` + `windows` porque faz
a coisa certa (incluindo o broadcast) com muito menos código e sem deps novas.

**Requer** adicionar `powershell` à allowlist do shell em
`src-tauri/capabilities/` (hoje só `winget` é permitido). O argumento será um
script fixo com o `dir` interpolado de forma segura.

### 4. Ponte Tauri + store (frontend)

- `tauri.ts`: tipos `PathToolInfo` e wrappers `checkPathTools`, `addToUserPath`;
  mock no modo navegador (ex.: marcar Python como instalado fora do PATH pra
  demonstrar o botão).
- `store.tsx`: ao carregar/atualizar, chamar `checkPathTools` junto do
  `checkInstalled` e mesclar em `installedOf` (ou um mapa irmão `pathOf(id)`).
  Após `addToUserPath` com sucesso, atualizar o estado local para `onPath=true`.

### 5. UI (Catálogo — `screens/Catalog.tsx`)

No card de um programa dev instalado, fora do PATH:

```
✓ instalado · v2.53.0 · ⚠ fora do PATH   [ Adicionar ao PATH ]
```

- Clique → `addToUserPath(pathDir)` → estado vira `✓ no PATH`.
- Texto auxiliar sutil: "abra um terminal novo para valer".
- Programas já no PATH: apenas "instalado" (sem ruído).
- Coexiste com o item 1 já entregue (instalados não têm caixinha de seleção).

## Componentes e responsabilidades

- `pathtools.rs` — detecção por executável + escrita no PATH do usuário. Puro,
  testável (a varredura de pastas/PATH é unit-testável com dirs temporárias).
- `catalog.rs` / `schema.ts` — fonte da verdade dos novos campos opcionais.
- `tauri.ts` — fronteira; isola o frontend do backend e provê o mock.
- `store.tsx` — orquestra: mescla winget + exe, mantém estado pós-ação.
- `Catalog.tsx` — só apresentação do estado de PATH + disparo da ação.

## Tratamento de erro

- `check_path_tools` nunca falha o carregamento: erro vira "não detectado".
- `add_to_user_path` retorna `Err(String)` com mensagem; a UI mostra inline
  ("não foi possível adicionar ao PATH: …") e mantém o botão pra tentar de novo.

## Testes

- Rust: expansão de `%VAR%`; achar exe no PATH; achar em `installDirs`;
  não-encontrado; idempotência do append de PATH (lógica de "já contém").
- Frontend: typecheck; verificação manual no app (Python fora do PATH → botão →
  vira "no PATH").

## Fora de escopo confirmado

PATH de sistema, exe-detection universal, versão via exe, varredura de registro.
