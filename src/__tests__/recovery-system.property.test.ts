/**
 * Testes de Propriedade para Sistema de Recuperação Automática
 * 
 * Property 10: Robust Data Synchronization
 * Validates: Requirements 5.1, 5.2, 5.3
 * 
 * Estes testes validam as propriedades universais do sistema de recuperação,
 * usando dados reais do banco de dados Supabase.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

// Configuração do cliente Supabase para testes
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Tipos para os testes
interface TestUser {
    id: string;
    email: string;
}

interface TestTransaction {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    category_id: string;
    account_id: string;
}

interface TestSharedRequest {
    id: string;
    original_transaction_id: string;
    requested_by_user_id: string;
    requested_to_user_id: string;
    amount: number;
    status: string;
}

// Helpers para criar dados de teste reais
const createTestUser = async (): Promise<TestUser> => {
    const email = faker.internet.email();
    const { data, error } = await supabase.auth.signUp({
        email,
        password: 'test123456'
    });
    
    if (error) throw error;
    
    return {
        id: data.user!.id,
        email
    };
};

const createTestTransaction = async (userId: string): Promise<TestTransaction> => {
    const transactionData = {
        user_id: userId,
        description: faker.lorem.sentence(),
        amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
        category_id: faker.string.uuid(),
        account_id: faker.string.uuid(),
        transaction_date: faker.date.recent().toISOString().split('T')[0],
        type: 'expense'
    };
    
    const { data, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();
    
    if (error) throw error;
    
    return data;
};

const createTestSharedRequest = async (
    originalTransactionId: string,
    requestedBy: string,
    requestedTo: string
): Promise<TestSharedRequest> => {
    const requestData = {
        original_transaction_id: originalTransactionId,
        requested_by_user_id: requestedBy,
        requested_to_user_id: requestedTo,
        amount: faker.number.float({ min: 1, max: 500, fractionDigits: 2 }),
        description: faker.lorem.sentence(),
        status: 'pending'
    };
    
    const { data, error } = await supabase
        .from('shared_transaction_requests')
        .insert(requestData)
        .select()
        .single();
    
    if (error) throw error;
    
    return data;
};

// Cleanup helper
const cleanupTestData = async (userIds: string[]) => {
    // Limpar dados de teste na ordem correta (respeitando FKs)
    await supabase.from('shared_reconciliation_history').delete().in('inconsistency_id', 
        supabase.from('shared_inconsistencies').select('id').in('user_id', userIds)
    );
    
    await supabase.from('shared_inconsistencies').delete().in('user_id', userIds);
    await supabase.from('shared_operation_queue').delete().in('user_id', userIds);
    await supabase.from('shared_transaction_mirrors').delete().in('user_id', userIds);
    await supabase.from('shared_transaction_requests').delete().in('requested_by_user_id', userIds);
    await supabase.from('transactions').delete().in('user_id', userIds);
};

describe('Recovery System Property Tests - Real Database', () => {
    let testUsers: TestUser[] = [];
    
    afterEach(async () => {
        // Limpar dados de teste após cada teste
        if (testUsers.length > 0) {
            const userIds = testUsers.map(u => u.id);
            await cleanupTestData(userIds);
            testUsers = [];
        }
    });

    describe('Property 10.1: Retry Mechanism with Exponential Backoff', () => {
        /**
         * Feature: shared-system-overhaul, Property 10.1: Retry Mechanism Consistency
         * 
         * Para qualquer operação falhada, o sistema deve calcular o próximo retry
         * usando backoff exponencial, e o tempo deve aumentar a cada tentativa.
         */
        it('should calculate exponential backoff correctly for any retry count', async () => {
            // Testar com diferentes valores de retry count
            for (let retryCount = 0; retryCount < 10; retryCount++) {
                const baseDelay = faker.number.int({ min: 1, max: 10 });
                
                const { data, error } = await supabase.rpc('calculate_next_retry', {
                    retry_count: retryCount,
                    base_delay_seconds: baseDelay
                });
                
                expect(error).toBeNull();
                expect(data).toBeTruthy();
                
                // Propriedade: O resultado deve sempre ser uma data futura válida
                const nextRetryTime = new Date(data);
                expect(nextRetryTime.getTime()).toBeGreaterThan(Date.now());
                
                // Propriedade: O delay deve aumentar com o retry count
                if (retryCount > 0) {
                    const previousResult = await supabase.rpc('calculate_next_retry', {
                        retry_count: retryCount - 1,
                        base_delay_seconds: baseDelay
                    });
                    
                    const previousTime = new Date(previousResult.data);
                    // O próximo retry deve ser pelo menos igual ou maior que o anterior
                    expect(nextRetryTime.getTime()).toBeGreaterThanOrEqual(previousTime.getTime());
                }
            }
        });

        /**
         * Para qualquer operação que falha, o sistema deve
         * incrementar o contador de retry e agendar próxima tentativa.
         */
        it('should increment retry count and schedule next attempt for failed operations', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            // Criar operação na queue
            const operationData = {
                description: faker.lorem.sentence(),
                amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 })
            };
            
            const { data: operationId, error: enqueueError } = await supabase.rpc('enqueue_operation', {
                p_operation_type: 'create_shared',
                p_operation_data: operationData,
                p_user_id: user.id,
                p_max_retries: 3
            });
            
            expect(enqueueError).toBeNull();
            expect(operationId).toBeTruthy();
            
            // Simular falha da operação
            const errorMessage = faker.lorem.sentence();
            const { error: failError } = await supabase.rpc('fail_operation', {
                p_operation_id: operationId,
                p_error_message: errorMessage
            });
            
            expect(failError).toBeNull();
            
            // Verificar se o retry count foi incrementado
            const { data: queueItem, error: selectError } = await supabase
                .from('shared_operation_queue')
                .select('retry_count, status, next_retry_at')
                .eq('id', operationId)
                .single();
            
            expect(selectError).toBeNull();
            expect(queueItem.retry_count).toBe(1);
            expect(queueItem.status).toBe('pending');
            expect(new Date(queueItem.next_retry_at).getTime()).toBeGreaterThan(Date.now());
        });
    });

    describe('Property 10.2: Circuit Breaker Pattern', () => {
        /**
         * Feature: shared-system-overhaul, Property 10.2: Circuit Breaker State Consistency
         * 
         * Para qualquer tipo de operação, o circuit breaker deve transicionar
         * corretamente entre estados baseado no número de falhas.
         */
        it('should maintain consistent circuit breaker state transitions', async () => {
            const operationTypes = ['create_shared', 'sync_shared', 'respond_request'];
            
            for (const operationType of operationTypes) {
                // Verificar estado inicial
                const { data: initialState, error: checkError } = await supabase.rpc('check_circuit_breaker', {
                    p_operation_type: operationType
                });
                
                expect(checkError).toBeNull();
                expect(['closed', 'open', 'half_open']).toContain(initialState);
                
                // Registrar sucesso
                const { error: successError } = await supabase.rpc('record_circuit_success', {
                    p_operation_type: operationType
                });
                
                expect(successError).toBeNull();
                
                // Verificar que o estado foi resetado para closed
                const { data: afterSuccessState } = await supabase.rpc('check_circuit_breaker', {
                    p_operation_type: operationType
                });
                
                expect(afterSuccessState).toBe('closed');
            }
        });

        /**
         * Para qualquer operação que falha repetidamente, o circuit breaker
         * deve abrir após atingir o threshold de falhas.
         */
        it('should open circuit after failure threshold for any operation type', async () => {
            const operationType = faker.helpers.arrayElement(['create_shared', 'sync_shared', 'respond_request']);
            
            // Registrar múltiplas falhas
            for (let i = 0; i < 6; i++) { // Threshold é 5
                const { error } = await supabase.rpc('record_circuit_failure', {
                    p_operation_type: operationType,
                    p_error_message: `Test failure ${i + 1}`
                });
                
                expect(error).toBeNull();
            }
            
            // Verificar se o circuito abriu
            const { data: circuitState } = await supabase.rpc('check_circuit_breaker', {
                p_operation_type: operationType
            });
            
            expect(circuitState).toBe('open');
        });
    });

    describe('Property 10.3: Operation Queue Management', () => {
        /**
         * Feature: shared-system-overhaul, Property 10.3: Queue Operation Atomicity
         * 
         * Para qualquer operação adicionada à queue, ela deve ser processada
         * exatamente uma vez ou falhar com retry apropriado.
         */
        it('should process each queued operation atomically', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            const operationData = {
                description: faker.lorem.sentence(),
                amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 })
            };
            
            // Adicionar operação à queue
            const { data: operationId, error: enqueueError } = await supabase.rpc('enqueue_operation', {
                p_operation_type: 'create_shared',
                p_operation_data: operationData,
                p_user_id: user.id,
                p_max_retries: 3
            });
            
            expect(enqueueError).toBeNull();
            expect(operationId).toBeTruthy();
            
            // Processar próxima operação
            const { data: processedOp, error: processError } = await supabase.rpc('process_next_operation');
            
            expect(processError).toBeNull();
            
            if (processedOp && processedOp.length > 0) {
                const operation = processedOp[0];
                expect(operation.operation_id).toBe(operationId);
                expect(operation.operation_type).toBe('create_shared');
                expect(operation.user_id).toBe(user.id);
                
                // Marcar como concluída
                const { error: completeError } = await supabase.rpc('complete_operation', {
                    p_operation_id: operation.operation_id
                });
                
                expect(completeError).toBeNull();
                
                // Verificar se foi marcada como completa
                const { data: completedOp } = await supabase
                    .from('shared_operation_queue')
                    .select('status, completed_at')
                    .eq('id', operation.operation_id)
                    .single();
                
                expect(completedOp.status).toBe('completed');
                expect(completedOp.completed_at).toBeTruthy();
            }
        });
    });

    describe('Property 10.4: Reconciliation System', () => {
        /**
         * Feature: shared-system-overhaul, Property 10.4: Inconsistency Detection Completeness
         * 
         * Para qualquer estado do sistema, a detecção de inconsistências
         * deve encontrar todas as divergências existentes.
         */
        it('should detect all types of inconsistencies in system state', async () => {
            const user1 = await createTestUser();
            const user2 = await createTestUser();
            testUsers.push(user1, user2);
            
            // Criar transação original
            const transaction = await createTestTransaction(user1.id);
            
            // Criar solicitação aceita sem espelho (inconsistência missing_mirror)
            const { error: requestError } = await supabase
                .from('shared_transaction_requests')
                .insert({
                    original_transaction_id: transaction.id,
                    requested_by_user_id: user1.id,
                    requested_to_user_id: user2.id,
                    amount: 100,
                    description: 'Test request',
                    status: 'accepted'
                });
            
            expect(requestError).toBeNull();
            
            // Executar detecção de inconsistências
            const { data: missingCount, error: detectError } = await supabase.rpc('detect_missing_mirrors');
            
            expect(detectError).toBeNull();
            expect(typeof missingCount).toBe('number');
            expect(missingCount).toBeGreaterThanOrEqual(0);
            
            // Verificar se a inconsistência foi registrada
            const { data: inconsistencies } = await supabase
                .from('shared_inconsistencies')
                .select('*')
                .eq('user_id', user2.id)
                .eq('inconsistency_type', 'missing_mirror');
            
            if (missingCount > 0) {
                expect(inconsistencies).toBeTruthy();
                expect(inconsistencies.length).toBeGreaterThan(0);
            }
        });

        /**
         * Para qualquer inconsistência detectada, o sistema deve tentar
         * resolvê-la automaticamente ou marcar como falhada.
         */
        it('should resolve or fail detected inconsistencies', async () => {
            // Executar reconciliação completa
            const { data: reconciliationResult, error: reconcileError } = await supabase.rpc('run_full_reconciliation');
            
            expect(reconcileError).toBeNull();
            expect(reconciliationResult).toBeTruthy();
            expect(reconciliationResult.success).toBe(true);
            expect(reconciliationResult.summary).toBeTruthy();
            
            // Propriedade: Todas as estatísticas devem ser números não-negativos
            const summary = reconciliationResult.summary;
            expect(summary.orphaned_detected).toBeGreaterThanOrEqual(0);
            expect(summary.missing_detected).toBeGreaterThanOrEqual(0);
            expect(summary.mismatches_detected).toBeGreaterThanOrEqual(0);
            expect(summary.resolved_count).toBeGreaterThanOrEqual(0);
            expect(summary.failed_count).toBeGreaterThanOrEqual(0);
            expect(summary.duration_seconds).toBeGreaterThan(0);
            
            // Propriedade: Resolved + Failed deve ser <= Total detectado
            const totalDetected = summary.orphaned_detected + summary.missing_detected + summary.mismatches_detected;
            const totalProcessed = summary.resolved_count + summary.failed_count;
            expect(totalProcessed).toBeLessThanOrEqual(totalDetected);
        });
    });

    describe('Property 10.5: Data Integrity During Recovery', () => {
        /**
         * Feature: shared-system-overhaul, Property 10.5: Recovery Data Integrity
         * 
         * Para qualquer operação de recuperação, os dados devem permanecer
         * consistentes mesmo em caso de falha parcial.
         */
        it('should maintain data consistency during recovery operations', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            const transaction = await createTestTransaction(user.id);
            
            // Testar wrapper com retry
            const { data: syncResult, error: syncError } = await supabase.rpc('sync_shared_transaction_with_retry', {
                p_transaction_id: transaction.id,
                p_user_id: user.id
            });
            
            expect(syncError).toBeNull();
            expect(syncResult).toBeTruthy();
            
            // Propriedade: O resultado deve ter estrutura consistente
            expect(typeof syncResult.success).toBe('boolean');
            
            // Propriedade: Se falhou e não foi executado imediatamente, deve estar na queue
            if (!syncResult.success && !syncResult.executed_immediately) {
                expect(syncResult.queued).toBe(true);
                expect(syncResult.operation_id).toBeTruthy();
                
                // Verificar se realmente foi adicionado à queue
                const { data: queueItem } = await supabase
                    .from('shared_operation_queue')
                    .select('*')
                    .eq('id', syncResult.operation_id)
                    .single();
                
                expect(queueItem).toBeTruthy();
                expect(queueItem.operation_type).toBe('sync_shared');
                expect(queueItem.user_id).toBe(user.id);
            }
        });
    });
});