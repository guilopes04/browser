# Gilas Browser

Navegador leve para macOS (Apple Silicon), feito com Electron e TypeScript. Sem IA.

A ideia é gastar pouca memória e ficar fora do caminho: abas em uma sidebar vertical, abas paradas suspensas para liberar RAM, espaços (Pessoal, Trabalho) com sessões isoladas e uma paleta de comandos no ⌘K. O design e as decisões estão em [`design/`](design/README.md) e [`docs/arquitetura.md`](docs/arquitetura.md).

O projeto está em fase inicial (versão 0.1). Ainda não há integração com as Senhas do iCloud: ela depende de uma entitlement que a Apple precisa aprovar.

## Instalar

1. Baixe o `.dmg` mais recente em [Releases](https://github.com/guilopes04/browser/releases).
2. Abra o `.dmg` e arraste o **Gilas Browser** para a pasta Aplicativos.
3. Abra o app. O build é assinado com Developer ID e notarizado pela Apple, então o Gatekeeper não pede nenhum passo extra.

Requisitos: Mac com chip Apple Silicon (M1 ou mais novo).

## Construir

Precisa de Node.js 22 ou mais novo e do Xcode Command Line Tools.

```sh
cd app
npm install
npm run build      # compila o app em app/out
npm start          # compila e abre o app
npm test           # testes
npm run typecheck  # tipos
npm run lint       # ESLint
```

Empacotar o `.dmg` e o `.zip`:

```sh
npm run dist:sem-assinar   # sem assinatura, serve para testar o empacotamento
npm run dist               # assina com Developer ID e notariza (precisa da conta e do perfil na keychain)
```

O `npm run dist` espera o certificado "Developer ID Application" na keychain e o perfil de notarização `browser-notary`, criado com `xcrun notarytool store-credentials`. Os arquivos saem em `app/dist`. O script `scripts/publica.sh` roda a auditoria, constrói, confere a assinatura e, com `--publicar`, cria a release no GitHub.

## Licença

[MIT](LICENSE), Guilherme Lopes, 2026.
