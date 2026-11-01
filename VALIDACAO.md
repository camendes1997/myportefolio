# Verificações da versão 9.0

- `node --check` passou em `shell.js` e `legacy/app.js`.
- A interface original da edição 8.0 foi preservada em `legacy/` com as nove abas.
- As contas novas recebem um estado inicial vazio, sem importação automática da carteira anterior.
- O identificador da conta autentificada determina a chave de armazenamento da carteira.
- A base de dados tem políticas RLS para consultas e uma função de gravação com revisão atómica.
- Não foi possível testar autenticação Supabase ponta a ponta sem um projeto Supabase configurado.
- O navegador Chromium deste ambiente bloqueou a navegação para ficheiros locais e localhost; não foi possível executar testes visuais completos.
- A migração total da interface para React ainda não está implementada; a edição 9.0 introduz primeiro a camada multiutilizador.
