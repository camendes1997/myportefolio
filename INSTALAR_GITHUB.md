# Publicação da MyPortefolio 9.0 via GitHub Pages

1. Cria um repositório novo `myportefolio` no GitHub (não uses outro projeto). Não coloques nele backups JSON, dados financeiros, passwords nem chaves secretas.
2. Coloca o conteúdo desta pasta na raiz do repositório (incluindo `.github/workflows/deploy.yml`). Faz commit para `main`.
3. Em **Settings > Pages > Build and deployment > Source**, escolhe **GitHub Actions**. O workflow faz a publicação.
4. O endereço terá tipicamente o formato `https://UTILIZADOR.github.io/myportefolio/` (substitui pelo nome real do repositório).
5. Cria um projeto em https://supabase.com, abre **SQL Editor** e executa `schema.sql`.
6. Em `config.js`, preenche `supabaseUrl` e `supabaseAnonKey` com a URL e **chave pública publishable/anon**, nunca a chave service_role. Faz commit da configuração pública.
7. Em **Supabase > Authentication > URL Configuration**, indica o endereço real publicado em **Site URL** e **Redirect URLs** (com o caminho completo e barra final).
8. Abre a app, cria a tua conta e testa o login, uma operação e a sincronização. Só depois importa a cópia JSON da versão 8.0.

**Segurança:** GitHub Pages serve ficheiros públicos. Não carregues dados pessoais para o repositório. A separação de carteiras é efetuada por RLS no Supabase. Antes de abrir a app a terceiros, testa com duas contas e valida as políticas de segurança.

**Limites:** a publicação via Pages não cria nem configura o projeto Supabase. Sem URL e chave pública válidas, o login e a base de dados não funcionam. Não estão incluídas cotações automáticas.
