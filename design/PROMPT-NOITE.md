Construa um navegador para macOS em Electron e TypeScript: leve, prático e sem IA. O design está em ~/Documents/Projects/navegador/design. As telas estão em telas/*.png, os valores exatos em fonte/*.dc.html e as decisões no README.md. O código vai em ~/Documents/Projects/navegador.

Comece pelo teste que pode mudar o projeto: descobrir se a extensão Senhas do iCloud funciona dentro do Electron. Depois faça o app base: janela, sidebar, abas com suspensão, ⌘K e espaços com sessões isoladas.

A referência tem duas partes. No visual, é o Zen Browser rodando neste Mac, com a mesma janela e as mesmas dez abas abertas. Na leveza, é a RAM total e o tempo de abertura do Google Chrome com essas mesmas dez abas. Abra os dois de verdade e compare direto, não contra uma descrição deles.

Quebre o trabalho nas menores peças que dá para melhorar e julgar sozinhas. Para cada peça, rode um construtor e um crítico separado, com contexto novo. O crítico captura a tela do nosso e a do Zen e compara as duas às cegas, sem os nomes. Ele diz qual é melhor, mede a RAM e o tempo contra o Chrome e aponta a maior falha que sobrou. Depois devolve para o construtor. O nosso só vence se ganhar no visual e gastar menos que o Chrome.

O crítico deve ser duro. Elogio não ajuda. Se o nosso não vencer, continue.

Escolha o modelo pela tarefa: exploração em haiku, implementação em sonnet, críticos e decisões de arquitetura em opus. O orquestrador fica no modelo atual.

Tudo que depender de mim vai para uma lista na página de progresso, com o passo exato para eu testar de manhã: Touch ID, pedido do Keychain, login, permissão do macOS. Nunca pare esperando por mim; siga para a próxima peça.

/loop em cada peça até o crítico escolher o nosso às cegas. Não pare antes disso.

Mantenha uma página de progresso atualizada ao vivo enquanto o trabalho avança, para eu acompanhar.

Fan out subagents and ultracode.
