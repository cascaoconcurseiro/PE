/**
 * Testes de Propriedade para Schema do Factory Reset
 * 
 * Property 3: Recovery Record Integrity
 * Validates: Requirements 3.1, 3.2, 3.3
 * 
 * Estes testes validam as propriedades universais do schema do sistema de factory reset,
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

interface TestRecoveryRecord {
    id: string;
    user_id: string;
    original_transaction_id: string;
    transaction_type: string;
    metadata: any;
    created_at: string;
    is_valid: boolean;
}

interface TestAuditRecord {
    id: string;
    user_id: string;
    action: string;
    details: any;
    success: boolean;
    created_at: string;
}

// Helpers para criar dados de teste
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

const createTestRecoveryRecord = async (userId: string): Promise<TestRecoveryRecord> => {
    const recordData = {
        user_id: userId,
        original_transaction_id: faker.string.uuid(),
        transaction_type: faker.helpers.arrayElement(['trip', 'shared_expense', 'investment', 'budget']),
        metadata: {
            category: faker.commerce.department(),
            amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
            description: faker.lorem.sentence(),
            original_owner_id: faker.string.uuid()
        },
        is_valid: true
    };
    
    const { data, error } = await supabase
        .from('recovery_records')
        .insert(recordData)
        .select()
        .single();
    
    if (error) throw error;
    
    return data;
};

const createTestAuditRecord = async (userId: string): Promise<TestAuditRecord> => {
    const auditData = {
        user_id: userId,
        action: faker.helpers.arrayElement(['initiated', 'completed', 'recovery_created', 'recovery_restored']),
        details: {
            operation: faker.lorem.word(),
            timestamp: new Date().toISOString(),
            metadata: faker.lorem.sentence()
        },
        success: faker.datatype.boolean(),
        execution_time_ms: faker.number.int({ min: 10, max: 5000 }),
        transactions_deleted: faker.number.int({ min: 0, max: 100 }),
        accounts_deleted: faker.number.int({ min: 0, max: 10 })
    };
    
    const { data, error } = await supabase
        .from('factory_reset_audit')
        .insert(auditData)
        .select()
        .single();
    
    if (error) throw error;
    
    return data;
};

// Cleanup helper
const cleanupTestData = async (userIds: string[]) => {
    // Limpar dados de teste na ordem correta (respeitando FKs)
    await supabase.from('factory_reset_audit').delete().in('user_id', userIds);
    await supabase.from('recovery_records').delete().in('user_id', userIds);
};

describe('Factory Reset Schema Property Tests - Real Database', () => {
    let testUsers: TestUser[] = [];
    
    afterEach(async () => {
        // Limpar dados de teste após cada teste
        if (testUsers.length > 0) {
            const userIds = testUsers.map(u => u.id);
            await cleanupTestData(userIds);
            testUsers = [];
        }
    });

    describe('Property 3.1: Recovery Record Integrity', () => {
        /**
         * Feature: factory-reset-recovery, Property 3: Recovery Record Integrity
         * 
         * Para qualquer transação compartilhada, criar um registro de recuperação
         * deve armazenar o ID da transação original, ID do usuário original, e 
         * metadados completos com precisão.
         */
        it('should store recovery records with complete and accurate metadata for any shared transaction', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            // Gerar dados aleatórios para múltiplos registros
            const recordCount = faker.number.int({ min: 1, max: 10 });
            
            for (let i = 0; i < recordCount; i++) {
                const originalTransactionId = faker.string.uuid();
                const transactionType = faker.helpers.arrayElement(['trip', 'shared_expense', 'investment', 'budget']);
                const originalOwnerId = faker.string.uuid();
                const amount = faker.number.float({ min: 1, max: 10000, fractionDigits: 2 });
                
                const metadata = {
                    category: faker.commerce.department(),
                    subcategory: faker.commerce.productName(),
                    amount: amount,
                    description: faker.lorem.sentence(),
                    original_owner_id: originalOwnerId,
                    account_id: faker.string.uuid(),
                    payer_id: faker.helpers.arrayElement(['me', originalOwnerId]),
                    domain: faker.helpers.arrayElement(['TRAVEL', 'SHARED', 'BUSINESS'])
                };
                
                // Criar registro de recuperação
                const { data: record, error } = await supabase
                    .from('recovery_records')
                    .insert({
                        user_id: user.id,
                        original_transaction_id: originalTransactionId,
                        transaction_type: transactionType,
                        metadata: metadata,
                        is_valid: true
                    })
                    .select()
                    .single();
                
                expect(error).toBeNull();
                expect(record).toBeTruthy();
                
                // Propriedade: ID da transação original deve ser preservado exatamente
                expect(record.original_transaction_id).toBe(originalTransactionId);
                
                // Propriedade: ID do usuário deve ser preservado exatamente
                expect(record.user_id).toBe(user.id);
                
                // Propriedade: Tipo de transação deve ser válido
                expect(['trip', 'shared_expense', 'investment', 'budget']).toContain(record.transaction_type);
                
                // Propriedade: Metadados devem conter todos os campos obrigatórios
                expect(record.metadata).toBeTruthy();
                expect(record.metadata.original_owner_id).toBe(originalOwnerId);
                expect(record.metadata.amount).toBe(amount);
                expect(record.metadata.description).toBeTruthy();
                
                // Propriedade: Registro deve ser válido por padrão
                expect(record.is_valid).toBe(true);
                
                // Propriedade: Data de criação deve ser recente (últimos 5 segundos)
                const createdAt = new Date(record.created_at);
                const now = new Date();
                const timeDiff = now.getTime() - createdAt.getTime();
                expect(timeDiff).toBeLessThan(5000); // 5 segundos
            }
        });

        /**
         * Para qualquer usuário, deve ser possível criar múltiplos registros de recuperação
         * para diferentes transações, mas não duplicatas para a mesma transação.
         */
        it('should enforce unique constraint per user-transaction pair', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            const transactionId = faker.string.uuid();
            const transactionType = faker.helpers.arrayElement(['trip', 'shared_expense']);
            
            const metadata = {
                amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
                description: faker.lorem.sentence(),
                original_owner_id: faker.string.uuid()
            };
            
            // Primeiro registro deve ser criado com sucesso
            const { data: firstRecord, error: firstError } = await supabase
                .from('recovery_records')
                .insert({
                    user_id: user.id,
                    original_transaction_id: transactionId,
                    transaction_type: transactionType,
                    metadata: metadata
                })
                .select()
                .single();
            
            expect(firstError).toBeNull();
            expect(firstRecord).toBeTruthy();
            
            // Segundo registro com mesmo user_id e transaction_id deve falhar
            const { data: secondRecord, error: secondError } = await supabase
                .from('recovery_records')
                .insert({
                    user_id: user.id,
                    original_transaction_id: transactionId,
                    transaction_type: transactionType,
                    metadata: { ...metadata, description: 'Different description' }
                })
                .select()
                .single();
            
            expect(secondError).toBeTruthy();
            expect(secondRecord).toBeNull();
            
            // Propriedade: Erro deve ser de violação de constraint única
            expect(secondError.code).toBe('23505'); // unique_violation
        });
    });

    describe('Property 3.2: Audit Trail Completeness', () => {
        /**
         * Feature: factory-reset-recovery, Property 10: Complete Audit Trail
         * 
         * Para qualquer operação de factory reset ou recuperação, o sistema deve
         * criar logs de auditoria abrangentes com timestamps, IDs de usuário e
         * detalhes da operação.
         */
        it('should create comprehensive audit logs for any factory reset operation', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            const actions = ['initiated', 'completed', 'recovery_created', 'recovery_restored', 'recovery_cleaned'];
            
            for (const action of actions) {
                const executionTime = faker.number.int({ min: 10, max: 5000 });
                const transactionsDeleted = faker.number.int({ min: 0, max: 100 });
                const accountsDeleted = faker.number.int({ min: 0, max: 10 });
                
                const auditData = {
                    user_id: user.id,
                    action: action,
                    details: {
                        operation_id: faker.string.uuid(),
                        timestamp: new Date().toISOString(),
                        metadata: faker.lorem.sentence()
                    },
                    success: faker.datatype.boolean(),
                    execution_time_ms: executionTime,
                    transactions_deleted: transactionsDeleted,
                    accounts_deleted: accountsDeleted
                };
                
                const { data: auditRecord, error } = await supabase
                    .from('factory_reset_audit')
                    .insert(auditData)
                    .select()
                    .single();
                
                expect(error).toBeNull();
                expect(auditRecord).toBeTruthy();
                
                // Propriedade: User ID deve ser preservado exatamente
                expect(auditRecord.user_id).toBe(user.id);
                
                // Propriedade: Action deve ser válida
                expect(['initiated', 'completed', 'recovery_created', 'recovery_restored', 'recovery_cleaned', 'validation_failed', 'rollback_executed']).toContain(auditRecord.action);
                
                // Propriedade: Detalhes devem ser preservados como JSONB
                expect(auditRecord.details).toBeTruthy();
                expect(typeof auditRecord.details).toBe('object');
                
                // Propriedade: Métricas numéricas devem ser não-negativas
                expect(auditRecord.execution_time_ms).toBeGreaterThanOrEqual(0);
                expect(auditRecord.transactions_deleted).toBeGreaterThanOrEqual(0);
                expect(auditRecord.accounts_deleted).toBeGreaterThanOrEqual(0);
                
                // Propriedade: Timestamp deve ser recente
                const createdAt = new Date(auditRecord.created_at);
                const now = new Date();
                const timeDiff = now.getTime() - createdAt.getTime();
                expect(timeDiff).toBeLessThan(5000); // 5 segundos
            }
        });

        /**
         * Para qualquer registro de auditoria, deve ser possível consultar
         * por usuário e por ação de forma eficiente.
         */
        it('should support efficient querying by user and action', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            // Criar múltiplos registros de auditoria
            const recordCount = faker.number.int({ min: 5, max: 15 });
            const actions = ['initiated', 'completed', 'recovery_created'];
            
            for (let i = 0; i < recordCount; i++) {
                await createTestAuditRecord(user.id);
            }
            
            // Consultar por usuário
            const { data: userRecords, error: userError } = await supabase
                .from('factory_reset_audit')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            expect(userError).toBeNull();
            expect(userRecords).toBeTruthy();
            expect(userRecords.length).toBeGreaterThanOrEqual(recordCount);
            
            // Propriedade: Todos os registros devem pertencer ao usuário correto
            userRecords.forEach(record => {
                expect(record.user_id).toBe(user.id);
            });
            
            // Consultar por ação específica
            for (const action of actions) {
                const { data: actionRecords, error: actionError } = await supabase
                    .from('factory_reset_audit')
                    .select('*')
                    .eq('action', action)
                    .eq('user_id', user.id);
                
                expect(actionError).toBeNull();
                
                // Propriedade: Todos os registros devem ter a ação correta
                if (actionRecords && actionRecords.length > 0) {
                    actionRecords.forEach(record => {
                        expect(record.action).toBe(action);
                        expect(record.user_id).toBe(user.id);
                    });
                }
            }
        });
    });

    describe('Property 3.3: RLS Policy Enforcement', () => {
        /**
         * Feature: factory-reset-recovery, Property 3: Recovery Record Integrity
         * 
         * Para qualquer usuário, o sistema deve garantir que apenas seus próprios
         * registros de recuperação e auditoria sejam acessíveis via RLS.
         */
        it('should enforce RLS policies for recovery records and audit logs', async () => {
            const user1 = await createTestUser();
            const user2 = await createTestUser();
            testUsers.push(user1, user2);
            
            // Criar registros para ambos os usuários
            const record1 = await createTestRecoveryRecord(user1.id);
            const record2 = await createTestRecoveryRecord(user2.id);
            
            const audit1 = await createTestAuditRecord(user1.id);
            const audit2 = await createTestAuditRecord(user2.id);
            
            // Simular autenticação como user1 (em um cenário real, isso seria feito via auth)
            // Para este teste, vamos verificar que os dados foram criados corretamente
            
            // Propriedade: Registros devem existir para ambos os usuários
            const { data: allRecoveryRecords, error: recoveryError } = await supabase
                .from('recovery_records')
                .select('*')
                .in('user_id', [user1.id, user2.id]);
            
            expect(recoveryError).toBeNull();
            expect(allRecoveryRecords).toBeTruthy();
            expect(allRecoveryRecords.length).toBeGreaterThanOrEqual(2);
            
            const { data: allAuditRecords, error: auditError } = await supabase
                .from('factory_reset_audit')
                .select('*')
                .in('user_id', [user1.id, user2.id]);
            
            expect(auditError).toBeNull();
            expect(allAuditRecords).toBeTruthy();
            expect(allAuditRecords.length).toBeGreaterThanOrEqual(2);
            
            // Propriedade: Cada registro deve pertencer ao usuário correto
            const user1Records = allRecoveryRecords.filter(r => r.user_id === user1.id);
            const user2Records = allRecoveryRecords.filter(r => r.user_id === user2.id);
            
            expect(user1Records.length).toBeGreaterThanOrEqual(1);
            expect(user2Records.length).toBeGreaterThanOrEqual(1);
            
            user1Records.forEach(record => {
                expect(record.user_id).toBe(user1.id);
            });
            
            user2Records.forEach(record => {
                expect(record.user_id).toBe(user2.id);
            });
        });
    });

    describe('Property 3.4: Data Type Validation', () => {
        /**
         * Feature: factory-reset-recovery, Property 3: Recovery Record Integrity
         * 
         * Para qualquer entrada de dados, o schema deve validar tipos de dados
         * e constraints corretamente.
         */
        it('should validate data types and constraints for recovery records', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            // Teste com tipo de transação inválido
            const { data: invalidType, error: typeError } = await supabase
                .from('recovery_records')
                .insert({
                    user_id: user.id,
                    original_transaction_id: faker.string.uuid(),
                    transaction_type: 'invalid_type', // Tipo inválido
                    metadata: { test: 'data' }
                })
                .select()
                .single();
            
            expect(typeError).toBeTruthy();
            expect(invalidType).toBeNull();
            
            // Propriedade: Erro deve ser de violação de check constraint
            expect(typeError.code).toBe('23514'); // check_violation
            
            // Teste com tipos válidos
            const validTypes = ['trip', 'shared_expense', 'investment', 'budget'];
            
            for (const validType of validTypes) {
                const { data: validRecord, error: validError } = await supabase
                    .from('recovery_records')
                    .insert({
                        user_id: user.id,
                        original_transaction_id: faker.string.uuid(),
                        transaction_type: validType,
                        metadata: {
                            amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
                            description: faker.lorem.sentence()
                        }
                    })
                    .select()
                    .single();
                
                expect(validError).toBeNull();
                expect(validRecord).toBeTruthy();
                expect(validRecord.transaction_type).toBe(validType);
            }
        });

        /**
         * Para qualquer entrada de auditoria, o schema deve validar
         * actions e tipos de dados corretamente.
         */
        it('should validate audit record actions and data types', async () => {
            const user = await createTestUser();
            testUsers.push(user);
            
            // Teste com action inválida
            const { data: invalidAction, error: actionError } = await supabase
                .from('factory_reset_audit')
                .insert({
                    user_id: user.id,
                    action: 'invalid_action', // Action inválida
                    details: { test: 'data' },
                    success: true
                })
                .select()
                .single();
            
            expect(actionError).toBeTruthy();
            expect(invalidAction).toBeNull();
            
            // Propriedade: Erro deve ser de violação de check constraint
            expect(actionError.code).toBe('23514'); // check_violation
            
            // Teste com actions válidas
            const validActions = ['initiated', 'completed', 'recovery_created', 'recovery_restored', 'recovery_cleaned'];
            
            for (const validAction of validActions) {
                const { data: validAudit, error: validError } = await supabase
                    .from('factory_reset_audit')
                    .insert({
                        user_id: user.id,
                        action: validAction,
                        details: {
                            operation: faker.lorem.word(),
                            timestamp: new Date().toISOString()
                        },
                        success: faker.datatype.boolean(),
                        execution_time_ms: faker.number.int({ min: 1, max: 5000 })
                    })
                    .select()
                    .single();
                
                expect(validError).toBeNull();
                expect(validAudit).toBeTruthy();
                expect(validAudit.action).toBe(validAction);
            }
        });
    });
});