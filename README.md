# Reksa MVP

Inclui cadastro, login, sessão persistente, identificador `@usuario`, solicitação/aceite de conversa, conversa privada, grupos, mensagens e base para Web Push.

## Estrutura
GitHub Pages -> Apps Script Web App -> Google Sheets

Abas: Usuarios, Sessoes, Conversas, Participantes, Mensagens, Solicitacoes, PushSubscriptions.

## Configuração
1. Crie uma Google Sheet.
2. No Apps Script, cole `apps-script/Code.gs`.
3. Em Propriedades do script, defina `SPREADSHEET_ID`.
4. Execute `setup` uma vez.
5. Publique como Web App.
6. Copie a URL `/exec` para `API_URL` em `script.js`.
7. Publique os arquivos do frontend no GitHub Pages.

## Importante
O Web Push está preparado no frontend, mas o envio real via VAPID ainda não está implementado. As mensagens usam polling de 5 segundos.

O hash de senha atual é SHA-256 + salt apenas para este MVP educacional. Para produção, use Argon2id, bcrypt ou scrypt, além de rate limiting, controles contra enumeração, gestão robusta de sessões e banco de dados adequado.

A tela de solicitações ainda precisa ser adicionada ao frontend para que o destinatário aceite/recuse diretamente pela interface. O backend já possui `requests`, `acceptRequest` e `rejectRequest`.
