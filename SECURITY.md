# Segurança

A Forja instala software na máquina do usuário, então a postura de segurança
importa. Este documento descreve o modelo de ameaça e as decisões.

## O que a Forja faz (e não faz)

- **Instala/atualiza via winget**, a partir das fontes oficiais. Não hospeda
  nem redistribui instaladores.
- **Sem telemetria.** Não coleta nem envia dados de uso.
- **Rede usada:** o `winget` (downloads das fontes oficiais) e, para checar
  atualizações da própria Forja, a API do GitHub (`api.github.com`) e os hosts
  de asset de release (`github.com`, `objects.githubusercontent.com`,
  `release-assets.githubusercontent.com`) — os únicos hosts liberados pela CSP
  (`connect-src` em [tauri.conf.json](apps/desktop/src-tauri/tauri.conf.json)).
  Ícones e fontes são **empacotados localmente** (funcionam offline num PC
  recém-formatado). Nenhum servidor da Forja, nenhum CDN em runtime.

## Execução de comandos

- Os comandos do `winget` são montados no Rust e passados como **vetor de
  argumentos** (`ShellExt::command(...).args([...])`) — **não** como string de
  shell. Não há interpolação em shell, logo não há injeção de comando.
- O plugin-shell é **escopado** em [capabilities/default.json](apps/desktop/src-tauri/capabilities/default.json):
  só `winget install`, `winget upgrade` e `winget list` são permitidos, e o
  `--id` é validado por regex (`^[A-Za-z0-9.\-_+]+$`).
- Os ids vêm do **manifesto** (dado declarativo), não de texto livre do usuário.
  O id usado em `upgrade` vem da saída do `winget list` e também é passado como
  argumento isolado.

## Importar perfil `.forja`

- Um `.forja` é JSON e só contém uma **lista de ids** + metadados. O import
  apenas lê strings de `programIds`; **não** executa código nem caminhos. Um
  arquivo malicioso, no pior caso, pré-seleciona ids inexistentes (ignorados).

## Autoupdate da própria Forja

- O card de atualização baixa o `.exe` da release mais recente no GitHub e
  roda ([updater.rs](apps/desktop/src-tauri/src/updater.rs)). Antes de
  executar, o hash SHA256 do arquivo baixado é conferido contra um sidecar
  `<asset>.exe.sha256` publicado junto do instalador na mesma release — se o
  sidecar não existir ou o hash não bater, o instalador é apagado e a
  instalação aborta (falha fechada). O front-end só habilita o botão de
  atualização em 1 clique quando esse sidecar é encontrado
  (`checkForjaUpdate` em [tauri.ts](apps/desktop/src/tauri.ts)); caso
  contrário cai no link manual da página de releases.
- **Processo de release**: como o hash é o único mecanismo de verificação,
  toda release precisa subir o `.sha256` junto do instalador, com o mesmo
  nome + `.sha256`. Ex. (PowerShell, na pasta com o instalador):
  `(Get-FileHash .\Forja_x.y.z_x64-setup.exe -Algorithm SHA256).Hash > .\Forja_x.y.z_x64-setup.exe.sha256`
  — depois subir os dois arquivos como assets da release no GitHub.

## Itens em aberto / hardening recomendado

- **Fallback/elevação (UAC)**: o caminho de instalação fora do winget
  (download do `fallbackUrl` + elevação) está **stub** e não roda. Quando for
  implementado, validar hash/assinatura do instalador antes de elevar.
- **Drivers**: por ora só detecção + deep-link para a ferramenta oficial.

## Reportar uma vulnerabilidade

Abra uma issue privada (Security Advisory) no repositório ou entre em contato
com o mantenedor. Por favor, não divulgue publicamente antes de uma correção.
