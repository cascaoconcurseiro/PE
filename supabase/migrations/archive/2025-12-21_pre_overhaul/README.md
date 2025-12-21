# Migrações Arquivadas - Pré-Reestruturação Sistema Compartilhado

## Data: 2025-12-21
## Motivo: Limpeza e consolidação do banco de dados

## Arquivos Arquivados (29 migrações)

### Scripts de Diagnóstico (7 arquivos)
- `20260221_diagnostic_engine.sql` - Engine de diagnóstico original
- `20260221_diagnostic_engine_fixed.sql` - Versão corrigida do engine
- `20260221_diagnostic_engine_tests.sql` - Testes do engine (versão original)
- `20260221_diagnostic_tests_fixed.sql` - Testes corrigidos
- `20260221_diagnostic_missing_installment.sql` - Diagnóstico específico de parcelas
- `diagnostic_report.sql` - Relatório de diagnóstico
- `system_deep_diagnostic.sql` - Diagnóstico profundo do sistema

### Scripts de Correção (2 arquivos)
- `20260221_correction_engine.sql` - Engine de correção
- `20260221_correction_tests.sql` - Testes do engine de correção

### Scripts de Correção de Parcelas (4 arquivos)
- `20260221_fix_installment_import_user_id.sql` - Correção original
- `20260221_fix_installment_import_user_id_CLEAN.sql` - Versão limpa
- `20260221_fix_existing_installments.sql` - Correção de parcelas existentes
- `20260221_find_10th_installment.sql` - Busca da 10ª parcela
- `20260221_find_10th_installment_FIXED.sql` - Versão corrigida

### Scripts Seguro Carro (4 arquivos)
- `20260221_fix_seguro_carro.sql` - Correção principal
- `20260221_fix_seguro_carro_step1.sql` - Primeiro passo
- `20260221_complete_seguro_carro_fix.sql` - Correção completa
- `20260221_investigate_seguro_carro.sql` - Investigação

### Scripts de Teste e Verificação (8 arquivos)
- `20260221_test_installment_import_fix.sql` - Teste da correção
- `20260221_test_simple.sql` - Teste simples
- `20260221_verify_fix.sql` - Verificação da correção
- `20260221_verify_seguro_carro_fix.sql` - Verificação seguro carro
- `20260128_testar_constraints.sql` - Teste de constraints
- `20260128_verificar_migration.sql` - Verificação de migração
- `20260128_verificar_tipos_existentes.sql` - Verificação de tipos
- `20260128_verificar_valores_type.sql` - Verificação de valores
- `20260201_verify_ddd_ledger.sql` - Verificação DDD ledger
- `20260202_verify_reports.sql` - Verificação de relatórios

### Scripts de Investigação (2 arquivos)
- `20260221_deep_investigation.sql` - Investigação profunda
- `DATA_CONSISTENCY_CHECK.sql` - Verificação de consistência

## Motivos para Arquivamento

### 1. Duplicação
- Múltiplas versões do mesmo script (original, fixed, clean)
- Funções de diagnóstico redundantes
- Testes duplicados com pequenas variações

### 2. Scripts Temporários
- Scripts de investigação específica (seguro carro)
- Testes pontuais que já cumpriram seu propósito
- Verificações de migração já validadas

### 3. Consolidação
- Funcionalidades serão reimplementadas de forma consolidada
- Diagnósticos serão integrados ao novo sistema de auditoria
- Testes serão reescritos com property-based testing

## Impacto da Remoção

### ✅ Sem Impacto Negativo
- Scripts eram temporários ou de diagnóstico
- Funcionalidades críticas preservadas nas migrações restantes
- Dados não são afetados (apenas scripts de análise)

### 🔄 Funcionalidades Reimplementadas
- Sistema de diagnóstico → Novo sistema de auditoria
- Correções pontuais → Mecanismos de recuperação automática
- Testes manuais → Testes automatizados com property-based testing

## Recuperação

Se necessário recuperar algum script:
1. Localizar arquivo nesta pasta
2. Copiar de volta para `supabase/migrations/`
3. Renomear com timestamp atual
4. Executar migração normalmente

## Próximos Passos

1. Consolidar migrações restantes
2. Implementar novo schema compartilhado
3. Criar sistema de auditoria integrado
4. Implementar testes automatizados abrangentes

---

**Nota**: Todos os arquivos foram movidos, não deletados. Podem ser recuperados a qualquer momento.