import { renderHook, act } from '@testing-library/react';
import { useCrudOperations } from '../useCrudOperations';
import { supabaseService } from '../../core/services/supabaseService';

jest.mock('../../core/services/supabaseService');

const mockSupabaseService = supabaseService as jest.Mocked<typeof supabaseService>;
const mockPerformOperation = jest.fn();
const mockSetDataState = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    mockPerformOperation.mockImplementation(async (operation) => {
        await operation();
    });
});

describe('useCrudOperations', () => {
    const renderCrudOps = () => renderHook(() => 
        useCrudOperations({
            performOperation: mockPerformOperation,
            setDataState: mockSetDataState
        })
    );

    it('should handle create operation', async () => {
        mockSupabaseService.create.mockResolvedValue('new-id');

        const { result } = renderCrudOps();

        const entityData = {
            name: 'Test Entity',
            type: 'TEST'
        };

        await act(async () => {
            await result.current.create('test_table', entityData, 'Entity created!');
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('test_table', 
            expect.objectContaining({
                ...entityData,
                id: expect.any(String)
            })
        );

        expect(mockPerformOperation).toHaveBeenCalledWith(
            expect.any(Function),
            'Entity created!'
        );
    });

    it('should handle update operation', async () => {
        mockSupabaseService.update.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const entityData = {
            id: 'entity-id',
            name: 'Updated Entity',
            type: 'TEST'
        };

        await act(async () => {
            await result.current.update('test_table', entityData, 'Entity updated!');
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('test_table',
            expect.objectContaining({
                ...entityData,
                updatedAt: expect.any(String)
            })
        );

        expect(mockPerformOperation).toHaveBeenCalledWith(
            expect.any(Function),
            'Entity updated!'
        );
    });

    it('should handle delete operation', async () => {
        mockSupabaseService.delete.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        await act(async () => {
            await result.current.delete('test_table', 'entity-id', 'Entity deleted!');
        });

        expect(mockSupabaseService.delete).toHaveBeenCalledWith('test_table', 'entity-id');

        expect(mockPerformOperation).toHaveBeenCalledWith(
            expect.any(Function),
            'Entity deleted!'
        );
    });

    it('should handle bulk create operation', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const entities = [
            { name: 'Entity 1', type: 'TEST' },
            { name: 'Entity 2', type: 'TEST' }
        ];

        await act(async () => {
            await result.current.bulkCreate('test_table', entities, 'Entities created!');
        });

        expect(mockSupabaseService.bulkCreate).toHaveBeenCalledWith('test_table',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Entity 1',
                    id: expect.any(String),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String)
                }),
                expect.objectContaining({
                    name: 'Entity 2',
                    id: expect.any(String),
                    createdAt: expect.any(String),
                    updatedAt: expect.any(String)
                })
            ])
        );

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle bulk update operation', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined); // bulkCreate uses upsert

        const { result } = renderCrudOps();

        const entities = [
            { id: 'entity-1', name: 'Updated Entity 1', type: 'TEST' },
            { id: 'entity-2', name: 'Updated Entity 2', type: 'TEST' }
        ];

        await act(async () => {
            await result.current.bulkUpdate('test_table', entities, 'Entities updated!');
        });

        expect(mockSupabaseService.bulkCreate).toHaveBeenCalledWith('test_table',
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'entity-1',
                    name: 'Updated Entity 1',
                    updatedAt: expect.any(String)
                }),
                expect.objectContaining({
                    id: 'entity-2',
                    name: 'Updated Entity 2',
                    updatedAt: expect.any(String)
                })
            ])
        );

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle bulk delete operation', async () => {
        mockSupabaseService.bulkDelete.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const idsToDelete = ['entity-1', 'entity-2'];

        await act(async () => {
            await result.current.bulkDelete('test_table', idsToDelete, 'Entities deleted!');
        });

        expect(mockSupabaseService.bulkDelete).toHaveBeenCalledWith('test_table', idsToDelete);

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should map table names to state keys correctly', async () => {
        mockSupabaseService.create.mockResolvedValue('new-id');

        const { result } = renderCrudOps();

        // Test various table mappings
        const testCases = [
            { table: 'accounts', expectedStateKey: 'accounts' },
            { table: 'transactions', expectedStateKey: 'transactions' },
            { table: 'family_members', expectedStateKey: 'familyMembers' },
            { table: 'custom_categories', expectedStateKey: 'customCategories' }
        ];

        for (const testCase of testCases) {
            await act(async () => {
                await result.current.create(testCase.table, { name: 'Test' }, 'Created!');
            });

            // Verify the state update function was called
            expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
            
            // Test the state update function
            const stateUpdateFn = mockSetDataState.mock.calls[mockSetDataState.mock.calls.length - 1][0];
            const mockPrevState = { [testCase.expectedStateKey]: [] };
            const newState = stateUpdateFn(mockPrevState);
            
            expect(newState[testCase.expectedStateKey]).toHaveLength(1);
            expect(newState[testCase.expectedStateKey][0]).toMatchObject({
                name: 'Test',
                id: expect.any(String)
            });
        }
    });

    it('should handle custom operations with factories', async () => {
        mockSupabaseService.create.mockResolvedValue('new-id');

        const { result } = renderCrudOps();

        const customData = { name: 'Custom Entity', customField: 'value' };

        await act(async () => {
            await result.current.createOperation('custom_table', customData, 'Custom created!', 'customEntities');
        });

        expect(mockSupabaseService.create).toHaveBeenCalledWith('custom_table',
            expect.objectContaining({
                ...customData,
                id: expect.any(String)
            })
        );

        // Test custom state key
        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
        const stateUpdateFn = mockSetDataState.mock.calls[0][0];
        const mockPrevState = { customEntities: [] };
        const newState = stateUpdateFn(mockPrevState);
        
        expect(newState.customEntities).toHaveLength(1);
        expect(newState.customEntities[0]).toMatchObject({
            ...customData,
            id: expect.any(String)
        });
    });

    it('should handle operations without state updates', async () => {
        mockSupabaseService.update.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        await act(async () => {
            await result.current.updateOperation('custom_table', { id: 'test-id', name: 'Test' }, 'Updated!');
        });

        expect(mockSupabaseService.update).toHaveBeenCalledWith('custom_table',
            expect.objectContaining({
                id: 'test-id',
                name: 'Test',
                updatedAt: expect.any(String)
            })
        );

        // Should not update state when no stateKey provided
        expect(mockSetDataState).not.toHaveBeenCalled();
    });

    it('should handle state updates correctly for bulk operations', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const entities = [
            { name: 'Entity 1' },
            { name: 'Entity 2' }
        ];

        await act(async () => {
            await result.current.bulkCreate('accounts', entities, 'Accounts created!');
        });

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
        
        // Test the state update function
        const stateUpdateFn = mockSetDataState.mock.calls[0][0];
        const mockPrevState = { accounts: [{ id: 'existing', name: 'Existing' }] };
        const newState = stateUpdateFn(mockPrevState);
        
        expect(newState.accounts).toHaveLength(3); // 1 existing + 2 new
        expect(newState.accounts[1]).toMatchObject({
            name: 'Entity 1',
            id: expect.any(String)
        });
        expect(newState.accounts[2]).toMatchObject({
            name: 'Entity 2',
            id: expect.any(String)
        });
    });

    it('should handle bulk update state correctly', async () => {
        mockSupabaseService.bulkCreate.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const entities = [
            { id: 'entity-1', name: 'Updated Entity 1' },
            { id: 'entity-2', name: 'Updated Entity 2' }
        ];

        await act(async () => {
            await result.current.bulkUpdate('accounts', entities, 'Accounts updated!');
        });

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
        
        // Test the state update function
        const stateUpdateFn = mockSetDataState.mock.calls[0][0];
        const mockPrevState = { 
            accounts: [
                { id: 'entity-1', name: 'Original Entity 1' },
                { id: 'entity-3', name: 'Other Entity' }
            ] 
        };
        const newState = stateUpdateFn(mockPrevState);
        
        expect(newState.accounts).toHaveLength(2);
        expect(newState.accounts[0]).toMatchObject({
            id: 'entity-1',
            name: 'Updated Entity 1'
        });
        expect(newState.accounts[1]).toMatchObject({
            id: 'entity-3',
            name: 'Other Entity'
        });
    });

    it('should handle bulk delete state correctly', async () => {
        mockSupabaseService.bulkDelete.mockResolvedValue(undefined);

        const { result } = renderCrudOps();

        const idsToDelete = ['entity-1', 'entity-2'];

        await act(async () => {
            await result.current.bulkDelete('accounts', idsToDelete, 'Accounts deleted!');
        });

        expect(mockSetDataState).toHaveBeenCalledWith(expect.any(Function));
        
        // Test the state update function
        const stateUpdateFn = mockSetDataState.mock.calls[0][0];
        const mockPrevState = { 
            accounts: [
                { id: 'entity-1', name: 'Entity 1' },
                { id: 'entity-2', name: 'Entity 2' },
                { id: 'entity-3', name: 'Entity 3' }
            ] 
        };
        const newState = stateUpdateFn(mockPrevState);
        
        expect(newState.accounts).toHaveLength(1);
        expect(newState.accounts[0]).toMatchObject({
            id: 'entity-3',
            name: 'Entity 3'
        });
    });
});