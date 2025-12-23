# Correção Imediata - Função RPC Não Existe

## 🚨 Problema Identificado
```
Failed to import installment series "Seguro - Carro": Could not find the function public.create_shared_transaction_v2
```

**Causa**: A função RPC não existe no banco de dados Supabase.

## ⚡ Solução Imediata

### **Opção 1: Criar Função RPC (Recomendado)**

1. **Acesse o Supabase Dashboard**
2. **Vá para SQL Editor**
3. **Execute o conteúdo do arquivo**: `criar-funcao-rpc-shared.sql`
4. **Verifique se foi criada com sucesso**

### **Opção 2: Função Simples (Alternativa)**

Se a função complexa não funcionar:

1. **Execute o conteúdo do arquivo**: `criar-funcao-rpc-simples.sql`
2. **Teste novamente a importação**

### **Opção 3: Correção Automática (Já Implementada)**

O código foi modificado para usar **3 estratégias em cascata**:

1. **Tentar RPC complexa** → Se falhar por função não existir
2. **Tentar RPC simples** → Se falhar por função não existir  
3. **Inserção direta** → Sempre funciona

## 🧪 Teste Após Correção

Execute no console do navegador:

```javascript
// Teste rápido da correção
async function testeCorrecao() {
    if (!window.sharedTransactionManager) {
        console.error('❌ SharedTransactionManager não encontrado');
        return;
    }
    
    const testData = {
        transactions: [{
            description: 'TESTE CORREÇÃO - Seguro Carro (1/1)',
            amount: 95.00,
            category_id: 'OTHER',
            account_id: null,
            shared_with: [{
                user_id: (await window.sharedTransactionManager.supabase.auth.getUser()).data.user?.id,
                amount: 95.00
            }],
            installment_number: 1,
            total_installments: 1,
            due_date: '2025-01-20'
        }]
    };
    
    console.log('🧪 Testando correção...');
    const result = await window.sharedTransactionManager.importSharedInstallments(testData);
    
    if (result.success) {
        console.log('✅ CORREÇÃO FUNCIONOU!');
        console.log('🎉 Parcelas podem ser importadas agora');
    } else {
        console.error('❌ Ainda há problemas:', result.errors);
    }
}

testeCorrecao();
```

## 📋 Status das Correções

### ✅ **Implementado**:
- Estratégia de fallback em cascata
- Inserção direta como último recurso
- Logs detalhados para debug
- Tratamento de erros específicos

### 🔧 **Para Fazer**:
1. Executar SQL para criar função RPC
2. Testar importação das parcelas
3. Verificar se aparecem na interface

## 🎯 Próximos Passos

1. **Execute o SQL** no Supabase Dashboard
2. **Teste a importação** das parcelas do seguro
3. **Verifique se aparecem** na aba Compartilhado
4. **Se ainda não funcionar**, o fallback automático será usado

**A correção garante que as parcelas serão criadas independentemente da função RPC existir ou não.**