import React, { useState } from 'react';
import { Trip, Transaction, Account, FamilyMember } from '../types';

import { TripList } from './trips/TripList';
import { TripForm } from './trips/TripForm';
import { TripDetail } from './trips/TripDetail';

interface TripsProps {
    trips: Trip[];
    transactions: Transaction[];
    accounts: Account[];
    familyMembers: FamilyMember[];
    onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
    onAddTrip: (t: Trip) => void;
    onUpdateTrip?: (t: Trip) => void;
    onDeleteTrip?: (id: string) => void;
    onNavigateToShared?: () => void;
}

export const Trips: React.FC<TripsProps> = ({ trips, transactions, accounts, familyMembers, onAddTransaction, onAddTrip, onUpdateTrip, onDeleteTrip, onNavigateToShared }) => {
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [isCreatingTrip, setIsCreatingTrip] = useState(false);
    const [editingTripId, setEditingTripId] = useState<string | null>(null);

    const selectedTrip = trips.find(t => String(t.id) === String(selectedTripId));
    const tripTransactions = transactions.filter(t => t.tripId && String(t.tripId) === String(selectedTripId)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleCreateOrUpdateTrip = (tripData: any) => {
        if (editingTripId && onUpdateTrip) {
            const existingTrip = trips.find(t => t.id === editingTripId);
            if (existingTrip) {
                onUpdateTrip({ ...existingTrip, ...tripData });
            }
        } else {
            onAddTrip({
                ...tripData,
                id: Math.random().toString(36).substr(2, 9),
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
            />
        );
    }

    if (selectedTrip) {
        return (
            <TripDetail
                trip={selectedTrip}
                transactions={tripTransactions}
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
            />
        );
    }

    return (
        <TripList
            trips={trips}
            onTripClick={setSelectedTripId}
            onCreateClick={() => setIsCreatingTrip(true)}
        />
    );
};
