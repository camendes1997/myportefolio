# MyPortefolio 9.5 — estados e recuperação das cotações

## Alterações
- Estados distintos por ativo: **Atualizado**, **Em cache**, **A aguardar API**, **Limite diário**, **Sem cobertura**, **Cotação desatualizada**, **Erro**.
- Nova coluna **Fonte** e **Data cotação** em Ações e ETF.
- Mensagens detalhadas do fornecedor permanecem consultáveis na aba.
- Novas tentativas automáticas apenas para ativos **pendentes**, quando a opção diária está ligada e a aba permanece aberta.
- Os últimos preços válidos são preservados. Operações, capital investido e cálculos não são alterados.
- A Twelve Data e a Alpha Vantage continuam sujeitas às quotas e à cobertura contratada; erro de cotação antiga não prova ausência permanente de cobertura.

## Instalação obrigatória no Supabase
1. A interface v9.5 é publicada automaticamente no GitHub Pages.
2. Para os novos tipos de erro, abre **Supabase → Edge Functions → market-quotes → Edit**.
3. Substitui o código pelo ficheiro `supabase/functions/market-quotes/index.ts` do GitHub e faz **Deploy updates**.
4. Mantém Verify JWT ativado e os segredos existentes. Não é necessária nova migração SQL.
5. Abre a aplicação, força a atualização (Ctrl+Shift+R), e testa a aba ETF.
6. Confirma se SECO.DE aparece como **Cotação desatualizada** se o fornecedor continuar a devolver data demasiado antiga; EUNM.DE poderá aparecer como **A aguardar API** enquanto persistir o limite.
7. Compara o último preço e a respetiva data com a bolsa antes de o considerares validado.

## Limitações
- Não existe atualização em segundo plano com o navegador fechado.
- A integração ainda não dispõe de fontes adicionais gratuitas com cobertura confirmada para SECO.DE.
- O estado «Em cache» descreve a reutilização no mesmo dia, não garante que o último fecho seja de hoje (mercados fechados).
- A função Supabase ainda necessita de um teste real após publicação; atualizar o GitHub não publica Edge Functions.
