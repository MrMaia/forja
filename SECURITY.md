# Segurança

A Forja instala software na máquina do usuário, então a postura de segurança
importa. Este documento descreve o modelo de ameaça e as decisões.

## O que a Forja faz (e não faz)

- **Instala/atualiza via winget**, a partir das fontes oficiais. Não hospeda
  nem redistribui instaladores.
- **Sem telemetria.** Não coleta nem envia dados de uso.
- **Rede usada:** apenas (1) o próprio `winget` (downloads das fontes oficiais),
  (2) ícones dos apps via CDN (`jsdelivr`, `iconify`, `simpleicons`) e (3) fontes
  do Google Fonts. Nenhum servidor da Forja.

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

## Itens em aberto / hardening recomendado

- **CSP**: hoje `csp: null` em [tauri.conf.json](apps/desktop/src-tauri/tauri.conf.json).
  Superfície de XSS é baixa (a UI não renderiza HTML de terceiros; o import é
  JSON), mas antes do release público recomenda-se uma CSP com allowlist:
  `default-src 'self'; img-src 'self' https://cdn.jsdelivr.net https://api.iconify.design https://cdn.simpleicons.org data:; font-src https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`.
- **Fallback/elevação (UAC)**: o caminho de instalação fora do winget
  (download do `fallbackUrl` + elevação) está **stub** e não roda. Quando for
  implementado, validar hash/assinatura do instalador antes de elevar.
- **Drivers**: por ora só detecção + deep-link para a ferramenta oficial.

## Reportar uma vulnerabilidade

Abra uma issue privada (Security Advisory) no repositório ou entre em contato
com o mantenedor. Por favor, não divulgue publicamente antes de uma correção.
