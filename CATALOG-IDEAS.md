# Catálogo — ideias para expandir

Backlog de apps para adicionar ao [packages/catalog/catalog.json](packages/catalog/catalog.json).
**Nada aqui está no catálogo ainda** — é uma lista de candidatos.

Antes de adicionar, confirme o id com `winget search "<nome>"` (ids mudam e
variam por região). Para versionados (Python, JDK, .NET…), prefira o id
meta/estável e use o campo `detect` (prefixo) — ver o caso do Node/Python no
catálogo. Categoria nova também precisa entrar em `CATEGORIES` em
[apps/desktop/src/screens/Catalog.tsx](apps/desktop/src/screens/Catalog.tsx).

## Essenciais
| App | winget id |
|---|---|
| Notepad++ | `Notepad++.Notepad++` |
| WinRAR | `RARLab.WinRAR` |
| Everything (busca) | `voidtools.Everything` |
| ShareX | `ShareX.ShareX` |
| PowerShell 7 | `Microsoft.PowerShell` |
| Rufus | `Rufus.Rufus` |
| Revo Uninstaller | `RevoUninstaller.RevoUninstaller` |
| UniGetUI (ex-WingetUI) | `MartiCliment.UniGetUI` |
| TranslucentTB | `CharlesMilette.TranslucentTB` |
| HWiNFO | `REALiX.HWiNFO` |
| CrystalDiskInfo | `CrystalDewWorld.CrystalDiskInfo` |

## Navegadores
| App | winget id |
|---|---|
| Microsoft Edge | `Microsoft.Edge` |
| Opera | `Opera.Opera` |
| Opera GX | `Opera.OperaGX` |
| Vivaldi | `Vivaldi.Vivaldi` |
| Zen Browser | `Zen-Team.Zen-Browser` |
| LibreWolf | `LibreWolf.LibreWolf` |
| Tor Browser | `TorProject.TorBrowser` |

## Comunicação
| App | winget id |
|---|---|
| Telegram | `Telegram.TelegramDesktop` |
| WhatsApp | `9NKSQGP7F2NH` (msstore) |
| Slack | `SlackTechnologies.Slack` |
| Zoom | `Zoom.Zoom` |
| Microsoft Teams | `Microsoft.Teams` |
| Signal | `OpenWhisperSystems.Signal` |
| Thunderbird | `Mozilla.Thunderbird` |
| Skype | `Microsoft.Skype` |

## Mídia
| App | winget id |
|---|---|
| GIMP | `GIMP.GIMP` |
| Krita | `KDE.Krita` |
| Inkscape | `Inkscape.Inkscape` |
| Blender | `BlenderFoundation.Blender` |
| Audacity | `Audacity.Audacity` |
| HandBrake | `HandBrake.HandBrake` |
| DaVinci Resolve | `BlackmagicDesign.DaVinciResolve` |
| Paint.NET | `dotPDN.PaintDotNet` |
| IrfanView | `IrfanSkiljan.IrfanView` |
| foobar2000 | `PeterPawlowski.foobar2000` |
| K-Lite Codec Pack | `CodecGuide.K-LiteCodecPack.Standard` |
| iTunes | `Apple.iTunes` |

## Produtividade
| App | winget id |
|---|---|
| Microsoft 365 / Office | `Microsoft.Office` |
| ONLYOFFICE | `ONLYOFFICE.DesktopEditors` |
| Notion | `Notion.Notion` |
| Obsidian | `Obsidian.Obsidian` |
| Joplin | `Joplin.Joplin` |
| Adobe Acrobat Reader | `Adobe.Acrobat.Reader.64-bit` |
| SumatraPDF | `SumatraPDF.SumatraPDF` |
| AnyDesk | `AnyDeskSoftwareGmbH.AnyDesk` |
| TeamViewer | `TeamViewer.TeamViewer` |
| Google Drive | `Google.GoogleDrive` |
| Dropbox | `Dropbox.Dropbox` |

## Desenvolvimento
| App | winget id |
|---|---|
| Visual Studio 2022 Community | `Microsoft.VisualStudio.2022.Community` |
| JetBrains Toolbox | `JetBrains.Toolbox` |
| IntelliJ IDEA Community | `JetBrains.IntelliJIDEA.Community` |
| PyCharm Community | `JetBrains.PyCharm.Community` |
| Sublime Text | `SublimeHQ.SublimeText.4` |
| Neovim | `Neovim.Neovim` |
| Cursor | `Anysphere.Cursor` |
| GitHub CLI | `GitHub.cli` |
| Git LFS | `GitHub.GitLFS` |
| Go | `GoLang.Go` |
| Rust (rustup) | `Rustlang.Rustup` |
| .NET SDK 8 | `Microsoft.DotNet.SDK.8` |
| Java (Temurin 21) | `EclipseAdoptium.Temurin.21.JDK` |
| Bun | `Oven-sh.Bun` |
| Deno | `DenoLand.Deno` |
| pnpm | `pnpm.pnpm` |
| Yarn | `Yarn.Yarn` |
| Oh My Posh | `JanDeDobbeleer.OhMyPosh` |
| Insomnia | `Insomnia.Insomnia` |
| HeidiSQL | `HeidiSQL.HeidiSQL` |
| MongoDB Compass | `MongoDB.Compass.Full` |
| RedisInsight | `Redis.RedisInsight` |
| Miniconda | `Anaconda.Miniconda3` |
| CMake | `Kitware.CMake` |
| WinSCP | `WinSCP.WinSCP` |
| PuTTY | `PuTTY.PuTTY` |
| MSYS2 | `MSYS2.MSYS2` |

## Games
| App | winget id |
|---|---|
| GOG Galaxy | `GOG.Galaxy` |
| EA app | `ElectronicArts.EADesktop` |
| Ubisoft Connect | `Ubisoft.Connect` |
| Battle.net | `Blizzard.BattleNet` |
| Heroic Games Launcher | `HeroicGamesLauncher.HeroicGamesLauncher` |
| Playnite | `Playnite.Playnite` |
| MSI Afterburner | `Guru3D.Afterburner` |

## Drivers / Hardware (detecção + deep-link, instalação real depois)
| App | winget id |
|---|---|
| Intel Driver & Support Assistant | `Intel.IntelDriverAndSupportAssistant` |
| Logitech G HUB | `Logitech.GHUB` |
| SteelSeries GG | `SteelSeries.GG` |
| Corsair iCUE | `Corsair.iCUE.5` |
| NZXT CAM | `NZXT.CAM` |

## Segurança & VPN (categoria nova sugerida)
| App | winget id |
|---|---|
| Bitwarden | `Bitwarden.Bitwarden` |
| KeePassXC | `KeePassXCTeam.KeePassXC` |
| Proton VPN | `Proton.ProtonVPN` |
| Mullvad VPN | `MullvadVPN.MullvadVPN` |
| WireGuard | `WireGuard.WireGuard` |
| Cloudflare WARP | `Cloudflare.Warp` |
| Malwarebytes | `Malwarebytes.Malwarebytes` |
