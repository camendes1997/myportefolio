# MyPortefolio 9.3 — alternativa gratuita para Ações e ETF

Esta versão tenta primeiro a **Twelve Data**. Caso não forneça a cotação, pode tentar **Alpha Vantage** quando houver símbolo alternativo e moeda configurados explicitamente.

## Configuração

1. Regista uma conta em https://www.alphavantage.co/support/#api-key e obtém uma chave gratuita. Confirma os limites de chamadas do plano gratuito; podem mudar.
2. Em Supabase → Edge Functions → Secrets, adiciona **ALPHAVANTAGE_API_KEY** com a chave. Não coloques a chave em GitHub nem no `config.js`.
3. Em Supabase → Edge Functions → `market-quotes`, atualiza o código da função a partir de `supabase/functions/market-quotes/index.ts` e faz **Deploy**. Mantém a verificação JWT ativa.
4. Abre MyPortefolio → Ações ou ETF → Configurar num ativo. Mantém o símbolo e bolsa da Twelve Data. Se quiseres testar a alternativa, acrescenta o símbolo Alpha Vantage e **a moeda efetiva da cotação**.
5. Começa com **um só ativo** e clica em Atualizar preços agora. Confirma o preço, a moeda, a data e se o fornecedor identificado está correto.
6. Não atives a atualização diária enquanto não confirmares o funcionamento e os limites gratuitos.

## Regras de segurança e integridade

- Nenhuma operação de compra/venda é alterada; só o valor atual de mercado.
- Caso ambos os fornecedores falhem, mantém-se o último preço válido.
- A moeda de Alpha Vantage é confirmada pelo utilizador: o endpoint GLOBAL_QUOTE não inclui metadados de moeda.
- Se o preço estiver noutra moeda, a conversão é feita para euros com a Frankfurter. Se esta falhar, o preço não é atualizado.
- Rejeita respostas sem símbolo igual ao solicitado, preço positivo ou data de mercado válida.
- Retorna um erro por ativo, em vez de bloquear todos.
- A disponibilidade de ETF e ações europeias **não está garantida** pelo plano gratuito. Em particular, nem EDP nem Mercedes-Benz foram ainda confirmados.
- A utilização numa app pública multiutilizador está sujeita a direitos de redistribuição e condições de cada fornecedor.
- A função faz chamadas ao fornecedor por ativo e por utilizador; ainda não implementa cache de servidor nem uma quota global. Os planos gratuitos podem esgotar-se rapidamente com vários utilizadores.

## Limitações

O preço da Alpha Vantage no plano gratuito pode ser de fim de dia ou estar indisponível; não apresentar como tempo real. Não enviar ao servidor símbolos de mercados alternativos sem confirmar que correspondem ao instrumento real.
