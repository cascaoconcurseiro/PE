import React, { useState } from 'react';
import { Trip, Transaction, Account, FamilyMember } from '../types';
import { parseDate } from '../utils';

import { TripList } from './trips/TripList';
import { TripForm } from './trips/TripForm';
import { TripDetail } from './trips/TripDetail';

interface TripsProps {
    trips: Trip[];
    transactions: Transaction[];
    accounts: Account[];
    familyMembers: FamilyMember[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string) => void;
    onAddTrip: (t: Trip) => void;
    onUpdateTrip?: (t: Trip) => void;
    onDeleteTrip?: (id: string) => void;
    onNavigateToShared?: () => void;
    onEditTransaction?: (id: string) => void;
    onLoadHistory: (start: string, end: string) => Promise<void>;
    currentUserId?: string;
}

export const Trips: React.FC<TripsProps> = ({ trips, transactions, accounts, familyMembers, onAddTransaction, onUpdateTransaction, onDeleteTransaction, onAddTrip, onUpdateTrip, onDeleteTrip, onNavigateToShared, onEditTransaction, onLoadHistory, currentUserId }) => {
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [editingTripId, setEditingTripId] = useState<string | null>(null);

    const selectedTrip = trips.find(t => String(t.id) === String(selectedTripId));

    // PHASE 5: Smart Hydration (Load history when trip selected)
    React.useEffect(() => {
        if (selectedTrip) {
            onLoadHistory(selectedTrip.startDate, selectedTrip.endDate);
        }
    }, [selectedTripId, trips]); // trips dependency in case we load trips late? ID is simpler.

    const tripTransactions = transactions.filter(t => t.tripId && String(t.tripId) === String(selectedTripId)).sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());

    const handleCreateOrUpdateTrip = (tripData: any) => {
        if (editingTripId && onUpdateTrip) {
            const existingTrip = trips.find(t => t.id === editingTripId);
            if (existingTrip) {
                onUpdateTrip({ ...existingTrip, ...tripData });
            }
        } else {
            onAddTrip({
                ...tripData,
                id: crypto.randomUUID(),
            });
        }
        setIsCreatingTrip(false);
        setEditingTripId(null);
    };

    const startEditingTrip = (trip: Trip) => {
        setEditingTripId(trip.id);
        setIsCreatingTrip(true);
        setSelectedTripId(null); // Return to main view to show form, or handle inline. 
        // In current logic, form replaces the view.
    };

    if (isCreatingTrip) {
        const editingTrip = trips.find(t => t.id === editingTripId);
        return (
            <TripForm
                initialData={editingTrip}
                familyMembers={familyMembers}
                onSave={handleCreateOrUpdateTrip}
                onCancel={() => { setIsCreatingTrip(false); setEditingTripId(null); }}
                editingTripId={editingTripId}
                userId={currentUserId}
            />
        );
    }

    if (selectedTrip) {
        return (
            <TripDetail
                trip={selectedTrip}
                transactions={tripTransactions}
                accounts={accounts}
                familyMembers={familyMembers}
                onBack={() => setSelectedTripId(null)}
                onEdit={startEditingTrip}
                onDelete={(id) => {
                    if (onDeleteTrip) {
                        onDeleteTrip(id);
                        setSelectedTripId(null);
                    }
                }}
                onUpdateTrip={(t) => onUpdateTrip && onUpdateTrip(t)}
                onNavigateToShared={onNavigateToShared}
                onEditTransaction={onEditTransaction} // Keep this for legacy or specialized modal trigger if needed
                onUpdateTransactionInternal={onUpdateTransaction}
                onDeleteTransactionInternal={onDeleteTransaction}
                userId={currentUserId}
            />
        );
    }

    return (
        <TripList
            trips={trips}
            onTripClick={setSelectedTripId}
            onCreateClick={() => setIsCreatingTrip(true)}
            userId={currentUserId}
        />
    );
};
