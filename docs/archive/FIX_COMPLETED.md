Correção Enviada!

O erro `text = uuid` acontecia porque o sistema antigo tentava enviar o ID do cartão de uma forma que o banco de dados não aceitava mais.

O que eu fiz:
1.  Removi a função antiga (`rpc soft_delete_account`).
2.  Criei uma nova lógica que roda direto no seu navegador: ela primeiro apaga as transações e depois apaga o cartão.

Como testar:
1.  Aguarde o deploy finalizar na Vercel (alguns minutos).
2.  Recarregue a página.
3.  Tente excluir o cartão novamente.

Se precisar de mais alguma coisa, é só chamar!
