# MyPortefolio 9.4 — atualização diária gratuita e cache global

## Porquê esta alteração
A Twelve Data limita a quantidade de chamadas por minuto, e vários utilizadores partilhariam a mesma chave. A versão 9.4 utiliza **uma cache diária partilhada** e **limites globais por fornecedor**, evitando voltar a consultar símbolos já atualizados nesse dia.

## Instalação no Supabase (OBRIGATÓRIA)
1. Abre o teu projeto Supabase → **SQL Editor → New query**.
2. Copia o conteúdo de [supabase/MIGRACAO_COTACOES_9_4.sql](supabase/MIGRACAO_COTACOES_9_4.sql) e executa-o. Cria apenas tabelas auxiliares de cotações/quotas e uma função de reserva de créditos; **não modifica** `public.portfolios`.
3. Confirma que a execução terminou sem erro. Não precisas de colocar dados financeiros nas novas tabelas.
4. Vai a **Edge Functions → market-quotes → Edit**. Substitui o código antigo pelo de [supabase/functions/market-quotes/index.ts](supabase/functions/market-quotes/index.ts) e faz **Deploy updates**.
5. Mantém **Verify JWT** ativo. Mantém `TWELVEDATA_API_KEY` e, se já estiver configurada, `ALPHAVANTAGE_API_KEY`.
6. O Supabase disponibiliza normalmente `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` às Edge Functions. Se o teu ambiente não as disponibilizar, verifica a configuração da função. **Nunca coloques a service role no GitHub ou no navegador.**
7. Abre https://camendes1997.github.io/myportefolio/ e atualiza com Ctrl+Shift+R.
8. Em **Ações** ou **ETF**, ativa "Atualização diária" e experimenta "Atualizar preços agora". Mantém a aba aberta se aparecerem preços pendentes.

## Funcionamento
- Consulta no máximo uma vez por **dia UTC** por combinação fornecedor/símbolo/bolsa (ou moeda de fallback).
- Reutiliza a cache do dia entre **contas diferentes** sem partilhar carteiras.
- Reserva créditos atomicamente no PostgreSQL antes de cada pedido externo (Twelve Data: máximo configurado de 7 créditos em 65 s e 700 em 24 h; Alpha Vantage: 1 em 65 s e 20 em 24 h). São limites prudentes, não garantias de disponibilidade.
- Se atingir limite temporário, assinala pendentes e tenta de novo após pelo menos 75 segundos **enquanto a aplicação e a aba estiverem abertas**.
- Não há cron nem atualizações com o navegador fechado nesta edição.
- Distingue "Atualizado", "Em cache", "Pendente", "Limite diário", "Erro" e "Por atualizar".
- Respostas de preço sem data, moeda ou símbolo válido são recusadas. Mantém o último preço quando falha a consulta.
- O último fecho pode ser anterior ao dia da consulta (fim de semana/feriados), e **não é uma cotação em tempo real**.
- Só altera os preços atuais; histórico, compras, vendas e comissões não são modificados.

## Teste recomendado
1. Testa um único ativo na aba Ações com atualização manual.
2. Repete o pedido no mesmo dia: deve surgir "Em cache".
3. Ativa a atualização diária e mantém a aba aberta para verificar a recuperação após limite por minuto.
4. Verifica se o Dashboard acompanha o valor líquido da aba.
5. Guarda um backup JSON como medida adicional.

## Limitações e cuidados
- A migração e o deployment da Edge Function são manuais: atualizar o GitHub **não** atualiza o código do Supabase.
- O plano gratuito poderá não cobrir EDP, Mercedes-Benz ou ETF europeus. A cache não contorna restrições comerciais.
- A migração protege contra chamadas simultâneas e excesso de créditos; fornecedores externos ainda podem impor limites diferentes.
- Este cache guarda apenas preços e metadados de mercado, não operações dos utilizadores.
- Se a aplicação vier a ter muitos utilizadores, revê os termos de licença/redistribuição e as políticas de API.
