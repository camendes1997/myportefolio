# MyPortefolio 9.0 — edição multiutilizador

## O que está incluído
- Interface e nove abas da v8.0 preservadas em `legacy/`.
- Contas privadas por email e palavra-passe via Supabase Auth.
- Base de dados PostgreSQL com Row Level Security (RLS) e uma carteira por utilizador.
- Sincronização da carteira em JSON com controlo de revisão; rejeita conflitos entre dispositivos em vez de sobrescrever silenciosamente.
- Backup JSON e importação manual a partir da aba Importar/exportar.
- Contas novas começam com uma carteira vazia, nunca com a carteira de exemplo de outra pessoa.

## Instalação
1. Cria um projeto em https://supabase.com e ativa Email em Authentication > Providers.
2. No SQL Editor, executa **schema.sql**.
3. Copia `config.example.js` para `config.js` e substitui o URL e a chave **pública (publishable/anon)** do projeto. NUNCA introduzas a `service_role` ou outra chave secreta no navegador.
4. Publica a pasta completa num servidor HTTPS (Vercel, Netlify, GitHub Pages) ou testa com `python -m http.server 8080` e abre http://localhost:8080/. Evita `file://`.
5. Cria uma conta e inicia sessão. Para recuperar os teus investimentos da 8.0: exporta JSON da edição antiga e importa-o explicitamente na nova conta, na aba Importar/exportar.
6. Espera pela indicação **Sincronizado** antes de fechar a página.

## Segurança e limites
- A base de dados aplica RLS por `auth.uid()`, e a função SQL recusa alterações concorrentes através de `expected_revision`.
- Uma conta tem uma carteira. A autenticação por email pode exigir confirmação conforme as definições do Supabase.
- As sessões são guardadas em `sessionStorage` e os dados da carteira ficam também em `localStorage` **associados ao ID da conta**, para funcionamento da interface existente. Estes dados locais **não são cifrados**: usa um equipamento privado.
- Conflitos de vários dispositivos são bloqueados; exporta backup e recarrega antes de decidir o que manter. Não há fusão automática.
- O servidor remoto ainda não foi configurado pelo autor: é necessário o teu projeto Supabase; não há backend funcional antes dessa configuração.
- Ainda não houve migração completa de todos os ecrãs para React. Esta edição mantém a interface legada como módulo integrado, e implementa autenticação/sincronização sem dependências externas. A migração React pode ser feita depois, sem voltar a remodelar as tabelas.
- Cotações de mercado continuam manuais; a taxa de câmbio utiliza a fonte diária existente quando acessível.
- Os cálculos fiscais mantêm simplificações existentes da v8.0; confirma-os antes de decisões fiscais.

## Estrutura
- `index.html`, `shell.css`, `shell.js` — interface de autenticação e sincronização.
- `legacy/` — interface v8.0 com dados isolados por utilizador.
- `schema.sql` — tabelas e segurança da base de dados.
- `config.example.js` e `config.js` — configuração.

## Publicação GitHub Pages
Ver `INSTALAR_GITHUB.md`; workflow em `.github/workflows/deploy.yml`.
