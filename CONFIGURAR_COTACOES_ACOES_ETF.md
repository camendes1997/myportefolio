# MyPortefolio 9.2 — cotações de Ações e ETF

A integração usa **Twelve Data** no servidor (Supabase Edge Function `market-quotes`). A chave do fornecedor nunca deve entrar em `config.js`, no GitHub Pages ou no JavaScript do navegador.

## Configuração obrigatória, uma única vez

1. Regista uma conta em https://twelvedata.com/ e obtém uma API key. Confirma a cobertura das bolsas e os créditos do teu plano: os dados de certos mercados europeus/ETF podem requerer acesso pago.
2. Abre o teu projeto no Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Atribui à função o nome exato `market-quotes` e copia o conteúdo de `supabase/functions/market-quotes/index.ts`. Faz Deploy.
4. Mantém **Verify JWT** ativado. A função também valida a sessão do utilizador através de Supabase Auth.
5. Em **Edge Functions → Secrets**, cria `TWELVEDATA_API_KEY` e coloca o valor da tua chave. Nunca partilhes esta chave comigo e não a coloques no repositório.
6. No GitHub Pages, entra com a tua conta → ETF ou Ações → **Configurar** em cada ticker.
7. Introduz o símbolo exato do fornecedor e a bolsa (ex.: `AAPL` / `NASDAQ`; `VWCE` / `XETR`, caso o fornecedor os reconheça nessa combinação). Não assumes que sufixos como `.DE` são suportados da mesma maneira em diferentes APIs.
8. Clica em **Atualizar preços agora**. Confirma os valores antes de ativar **Atualização diária**.

## Como funciona

- Apenas símbolos confirmados são consultados; outros mantêm o preço manual.
- Aceita no máximo 24 símbolos configurados por atualização, agrupados em pedidos de 8 por função. O limite protege de custos inesperados, mas cada consulta ao fornecedor pode consumir créditos.
- O servidor obtém o preço e a moeda, e converte para EUR com Frankfurter quando necessário. Se faltar moeda, câmbio, data ou preço válido, **não altera esse ativo**.
- Retorna erros individuais por ticker. Mantém os preços anteriores em caso de falha.
- O histórico das compras, vendas e comissões **não é alterado**. Apenas o preço de mercado atual é atualizado.
- Atualizações automáticas ocorrem na abertura da aba, no máximo uma vez por dia/categoria se ativadas. Não há atualizações em segundo plano quando a aplicação está fechada.
- A fonte pode devolver o último fecho, não necessariamente uma cotação em tempo real. A API tem limites de acesso e latência dependentes do plano.
- A identificação por símbolo deve ser revista quando houver fusões, mudanças de bolsa ou múltiplas classes de ações.
- Mantém backup JSON regular, sobretudo antes de importar ou atualizar muitos preços.

## Segurança

A função só aceita pedidos autenticados, valida a lista de símbolos, define CORS para a origem GitHub Pages do projeto e nunca devolve a chave de API. Não desatives o JWT para contornar erros 401. A autenticação multiutilizador e as políticas RLS existentes mantêm-se.

## Limitação conhecida

Não foi possível testar a função contra a tua conta Twelve Data e o teu Supabase, pois essa chave ainda não foi configurada. Os preços reais só poderão ser validados depois do deployment e do mapeamento dos ativos.
