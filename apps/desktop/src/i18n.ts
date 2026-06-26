// Lightweight i18n. Portuguese is the source/fallback; English is the alternate.
// Missing keys fall back to PT, so the app never shows raw keys.

export type Lang = "pt" | "en";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "pt", label: "Português" },
  { value: "en", label: "English" },
];

type Dict = Record<string, string>;

const pt: Dict = {
  "nav.title": "Navegação",
  "nav.home": "Início",
  "nav.catalog": "Catálogo",
  "nav.installs": "Instalações",
  "nav.presets": "Perfis prontos",
  "nav.export": "Exportar / Importar",
  "nav.drivers": "Drivers de rede",
  "nav.tweaks": "Ajustes do Windows",
  "nav.settings": "Configurações",

  "onboarding.tagline": "Do zero ao pronto.",
  "onboarding.desc":
    "Monte e instale seu ambiente inteiro de uma vez só. Você escolhe os programas, a Forja baixa direto da fonte oficial e instala tudo sozinha — em silêncio.",
  "onboarding.build": "Montar do zero",
  "onboarding.choosePreset": "Escolher um perfil pronto",
  "onboarding.orProfile": "ou comece por um perfil",
  "onboarding.footer": "fontes oficiais · instalação silenciosa · Windows 10 / 11",

  "catalog.search": "Buscar programas…",
  "catalog.programs": "programas",
  "catalog.selectAll": "Selecionar todos",
  "catalog.none": "nenhum programa encontrado",
  "catalog.results": "Resultados para",
  "catalog.selectedItems": "itens selecionados",
  "catalog.estimated": "GB estimado",
  "catalog.free": "GB livres",
  "catalog.lowSpace": "(pouco espaço!)",
  "catalog.clear": "Limpar seleção",
  "catalog.install": "Instalar selecionados",

  "settings.title": "Configurações",
  "settings.language": "Idioma",
  "settings.languageRow": "Idioma do aplicativo",
  "settings.languageDesc": "Escolha o idioma da interface.",
  "settings.updates": "Atualizações da Forja",
  "settings.autoCheck": "Verificar atualizações ao abrir",
  "settings.autoCheckDesc": "Checa se há uma versão nova da Forja quando o app inicia.",
  "settings.checkNow": "Verificar agora",
  "settings.checking": "verificando…",
  "settings.download": "Baixar e instalar",
  "settings.downloading": "baixando…",
  "settings.upToDate": "Você está na versão mais recente.",
  "settings.newVersion": "Nova versão {v} disponível!",
  "settings.checkHint": "Toque em “Verificar agora”.",
  "settings.checkFail": "Não foi possível verificar agora (sem internet ou sem versão publicada).",
  "settings.programs": "Programas instalados",
  "settings.withUpdate": "com atualização",
  "settings.allUpdated": "Tudo atualizado",
  "settings.detectDesc": "Detectado via winget e presença dos executáveis.",
  "settings.verify": "Verificar",
  "settings.updateAll": "Atualizar tudo",
  "settings.catalog": "Catálogo",
  "settings.hideInstalled": "Ocultar programas já instalados",
  "settings.hideInstalledDesc": "Mostra só o que ainda falta instalar.",
  "settings.about": "Sobre",
  "settings.aboutDesc": "Windows 10 / 11 · instalação via winget.",
};

const en: Dict = {
  "nav.title": "Navigation",
  "nav.home": "Home",
  "nav.catalog": "Catalog",
  "nav.installs": "Installs",
  "nav.presets": "Presets",
  "nav.export": "Export / Import",
  "nav.drivers": "Network drivers",
  "nav.tweaks": "Windows tweaks",
  "nav.settings": "Settings",

  "onboarding.tagline": "From zero to ready.",
  "onboarding.desc":
    "Build and install your whole environment in one go. You pick the programs, Forja downloads them from the official source and installs everything silently.",
  "onboarding.build": "Build from scratch",
  "onboarding.choosePreset": "Choose a preset",
  "onboarding.orProfile": "or start from a preset",
  "onboarding.footer": "official sources · silent install · Windows 10 / 11",

  "catalog.search": "Search programs…",
  "catalog.programs": "programs",
  "catalog.selectAll": "Select all",
  "catalog.none": "no programs found",
  "catalog.results": "Results for",
  "catalog.selectedItems": "selected items",
  "catalog.estimated": "GB estimated",
  "catalog.free": "GB free",
  "catalog.lowSpace": "(low space!)",
  "catalog.clear": "Clear selection",
  "catalog.install": "Install selected",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.languageRow": "App language",
  "settings.languageDesc": "Choose the interface language.",
  "settings.updates": "Forja updates",
  "settings.autoCheck": "Check for updates on launch",
  "settings.autoCheckDesc": "Checks for a new Forja version when the app starts.",
  "settings.checkNow": "Check now",
  "settings.checking": "checking…",
  "settings.download": "Download & install",
  "settings.downloading": "downloading…",
  "settings.upToDate": "You're on the latest version.",
  "settings.newVersion": "New version {v} available!",
  "settings.checkHint": "Tap “Check now”.",
  "settings.checkFail": "Couldn't check now (no internet or no published release).",
  "settings.programs": "Installed programs",
  "settings.withUpdate": "with an update",
  "settings.allUpdated": "All up to date",
  "settings.detectDesc": "Detected via winget and executable presence.",
  "settings.verify": "Check",
  "settings.updateAll": "Update all",
  "settings.catalog": "Catalog",
  "settings.hideInstalled": "Hide already-installed programs",
  "settings.hideInstalledDesc": "Show only what's left to install.",
  "settings.about": "About",
  "settings.aboutDesc": "Windows 10 / 11 · install via winget.",
};

const dicts: Record<Lang, Dict> = { pt, en };

export function detectLang(): Lang {
  const n = (typeof navigator !== "undefined" ? navigator.language : "pt").toLowerCase();
  return n.startsWith("pt") ? "pt" : "en";
}

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  let s = dicts[lang]?.[key] ?? pt[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
