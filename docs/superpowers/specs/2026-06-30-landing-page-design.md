# Landing page da Forja — design

Página de marketing estática inspirada no estilo do reflect.app, aplicando a
identidade visual da Forja (base escura quente + acento âmbar/brasa).

## Formato

- **Arquivo único** `site/index.html` — Tailwind via CDN, fontes Space Grotesk +
  JetBrains Mono (Google Fonts). Zero build. Hospedável no GitHub Pages.
- **Bilíngue PT/EN** com toggle: dicionário em JS + atributos `data-i18n`;
  padrão PT, preferência salva em `localStorage`.
- **CTAs:** "Baixar" → `https://github.com/MrMaia/forja/releases/latest`
  (primário, âmbar); "GitHub" → `https://github.com/MrMaia/forja` (secundário).

## Linguagem visual (Reflect → Forja)

- Fundo `#14110f`; texto `#f0ebe4`; acento âmbar `#f5933f` (gradiente
  `#f9a455`→`#e8792b`).
- Halo de brasa pulsante atrás do hero (reaproveita keyframe `forjaPulse`),
  grade sutil com máscara radial, títulos grandes com tracking apertado, muito
  respiro, nav flutuante em pílula.
- Reveals com IntersectionObserver; hovers com leve elevação. Sem framework.
- Losango rotacionado como marca (igual ao app).

## Seções

1. **Nav flutuante** — marca, links (Recursos, Como funciona), toggle PT/EN,
   GitHub, pílula "Baixar".
2. **Hero** — eyebrow em mono, título gigante, subtítulo, dois CTAs, halo + grade.
3. **Faixa de apps** — "Instala da fonte oficial" + ícones reais (chrome, vscode,
   discord, steam, vlc, python, git, spotify, obs, docker…) via
   `cdn.simpleicons.org`, cinza→cor no hover.
4. **Recursos** — blocos alternados: Catálogo · Presets & Perfis · Drivers &
   Ajustes do Windows · Silencioso & oficial (winget/npm, um UAC por ação).
5. **Como funciona** — 3 passos: Escolha → Forja baixa do oficial → Instala em silêncio.
6. **CTA final** — faixa centralizada com glow, repete o download.
7. **Rodapé** — wordmark, links, "Software livre · MrMaia/forja", toggle.

## Não-objetivos

- Sem backend, sem analytics, sem formulários. Sem screenshots reais do app
  (usa mock/abstrações). Sem framework JS.
