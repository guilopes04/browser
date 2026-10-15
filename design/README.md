# Navegador: especificação de design

Especificação visual e decisões do navegador próprio para macOS, fechadas no chat com o Claude em 15/10/2026.

## Onde está cada coisa

- `telas/*.png`: captura de cada tela em 2x. É a referência visual.
- `fonte/*.dc.html`: fonte de cada tela, com cores, tamanhos, espaçamentos e textos exatos. `fonte/Sidebar.dc.html` concentra os tokens de cor por espaço e tema (no bloco `renderVals`).
- `fonte/canvas.json`: índice das telas e como estão agrupadas.

A captura do modo leitura (`telas/Leitura.png`) saiu com a fonte reserva. A fonte pretendida é a Newsreader (Google Fonts).

## Telas

| Arquivo | O que mostra |
|---|---|
| Main | Janela principal: sidebar aberta, espaço Pessoal, aba com áudio, abas suspensas |
| MenuAba | Menu de contexto da aba, com submenu "Mover para espaço" |
| ModoCompacto | Sidebar reduzida a ícones, espaço Trabalho, tema escuro, nome da aba ao passar o mouse |
| SidebarOculta | Sidebar escondida (⌘S), revelada flutuando ao encostar na borda esquerda |
| PaletaVazia / Paleta | ⌘K ao abrir (abas recentes e ações) e com resultados (abas de todos os espaços, favoritos, histórico, ações) |
| NovaAba | Nova aba: só busca e favoritos do espaço |
| Split | Duas abas lado a lado, painel ativo com contorno, alça de redimensionar |
| Anonima | Janela anônima, sempre escura, sem favoritos |
| Leitura | Modo leitura com barra de tamanho, fonte e fundo |
| PainelSite | Popover do escudo: bloqueador no site, permissões, copiar URL limpa, capturar |
| Permissao | Alerta de câmera e microfone (vale só para o espaço atual) |
| Busca | Buscar na página (⌘F) |
| Downloads / Extensoes | Popovers que saem dos botões do rodapé da sidebar |
| Captura | Captura de área, parte visível ou página inteira |
| Erro | Página de sem conexão |
| Ajustes* | Janela de Ajustes nativa (⌘,): Geral, Espaços (com regras de abertura), Bloqueador, Privacidade, Atalhos, Extensões |
| Onboarding1 / Onboarding2 | Primeira abertura: criar espaços, depois importar perfis do Chrome |
| Sidebar | Componente da sidebar usado em todas as janelas |

## Tokens principais

- Fonte da interface: a do sistema (SF). Única fonte própria: Newsreader no modo leitura.
- Espaço Pessoal: destaque `#4352C4`, fundo da janela `#E8E9F0` (claro) e `#1A1B22` (escuro).
- Espaço Trabalho: destaque `#A35A06`, fundo `#EFEAE1` (claro) e `#1F1C17` (escuro).
- Janela anônima: fundo `#26262B`, sempre escura.
- Texto claro `#17181C`, secundário `#565863`. Texto escuro `#F1F1F4`, secundário `#A3A4AD`.
- Conteúdo da página em painel branco com raio de 10px, recuado 8px da borda da janela.
- A cor do espaço tinge a janela inteira: é o elemento de identidade. O resto segue o padrão do macOS.

## Decisões fechadas com o Gilas

- Só macOS (Apple Silicon), Chromium via Electron, TypeScript.
- Leve, prático e sem IA. Leveza vem de suspender abas paradas e bloquear anúncios e rastreadores.
- Espaços flexíveis (Pessoal e Trabalho por padrão), cada um com sessão isolada: cookies, logins, permissões e histórico separados.
- Ajustes em janela nativa (⌘,).
- Recursos: split view, janela anônima, modo leitura, roteamento de links por espaço, áudio na aba, captura da página, atalhos customizáveis, copiar URL limpa.
- Também entram: bloqueador, extensões da Chrome Web Store, importar do Chrome (favoritos, histórico, abas e extensões; senhas não).
- Senhas: app Senhas do Mac, pela extensão Senhas do iCloud.
- Streaming com DRM (Electron da castLabs): última prioridade.
- Tema claro/escuro segue o macOS, sem opção própria.

## Propostas do Claude ainda não confirmadas pelo Gilas

- Atalhos: ⌘S mostra/oculta a sidebar (no Chrome é "salvar página"), ⌥⌘S captura, ⌃⌘N split view, ⇧⌘C copiar URL limpa, ⇧⌘R modo leitura, ⌃1/⌃2 trocar de espaço.
- Suspender abas paradas depois de 30 minutos, nunca suspendendo aba com áudio.
- Extensões ativadas por espaço.
- Onboarding na ordem: primeiro criar espaços, depois importar cada perfil do Chrome para um espaço.

## Incertezas técnicas em aberto

- Não está confirmado se a extensão Senhas do iCloud funciona no Electron. Ela conversa com o app Senhas por native messaging, que o Electron, até onde se sabe, não implementa de fábrica. Testar primeiro: se não funcionar, a alternativa combinada é migrar para o Bitwarden.
- O suporte do Electron às APIs de extensão do Chrome é parcial.
- O Electron não traz o Safe Browsing do Google. A compensação planejada são listas de malware no bloqueador.
- O login do Google pode bloquear navegadores embutidos.
