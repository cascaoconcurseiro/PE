import React, { useState } from 'react';
import { Trip, TripShoppingItem } from '../../../types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ShoppingBag, Save, Plus, X, Check, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../utils';

interface TripShoppingProps {
    trip: Trip;
    onUpdateTrip: (trip: Trip) => void;
}

export const TripShopping: React.FC<TripShoppingProps> = ({ trip, onUpdateTrip }) => {
    const [shopItem, setShopItem] = useState('');
    const [shopEstCost, setShopEstCost] = useState('');
    const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);

    const handleSaveShoppingItem = () => {
        if (!shopItem.trim()) return;
        let updatedList = [...(trip.shoppingList || [])];
        const estCost = shopEstCost ? parseFloat(shopEstCost) : 0;

        if (editingShoppingId) {
            updatedList = updatedList.map(item => item.id === editingShoppingId ? { ...item, item: shopItem, estimatedCost: estCost } : item);
        } else {
            updatedList.push({ id: Math.random().toString(36).substr(2, 9), item: shopItem, estimatedCost: estCost, purchased: false });
        }

        onUpdateTrip({ ...trip, shoppingList: updatedList });
        setShopItem('');
        setShopEstCost('');
        setEditingShoppingId(null);
    };

    const startEditingShopping = (item: TripShoppingItem) => {
        setShopItem(item.item);
        setShopEstCost(item.estimatedCost?.toString() || '');
        setEditingShoppingId(item.id);
    };

    const toggleShoppingItem = (itemId: string) => {
        onUpdateTrip({
            ...trip,
            shoppingList: (trip.shoppingList || []).map(i => i.id === itemId ? { ...i, purchased: !i.purchased } : i)
        });
    };

    const deleteShoppingItem = (itemId: string) => {
        onUpdateTrip({
            ...trip,
            shoppingList: (trip.shoppingList || []).filter(i => i.id !== itemId)
        });
        if (editingShoppingId === itemId) {
            setShopItem('');
            setShopEstCost('');
            setEditingShoppingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Card title={editingShoppingId ? "Editar Item" : "Lista de Desejos"}>
                <div className="bg-violet-50 dark:bg-violet-900/20 p-4 rounded-xl mb-4 border border-violet-100 dark:border-violet-800 flex justify-between items-center">
                    <span className="text-sm font-bold text-violet-700 dark:text-violet-400">Previsão Total de Gastos</span>
                    <span className="text-lg font-black text-violet-900 dark:text-violet-300">
                        {formatCurrency((trip.shoppingList || []).reduce((acc, item) => acc + (item.estimatedCost || 0), 0), trip.currency)}
                    </span>
                </div>

                <div className="flex gap-2 mb-4 no-print">
                    <input
                        className="flex-[2] rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        placeholder="Item (ex: iPhone, Perfume)"
                        value={shopItem}
                        onChange={e => setShopItem(e.target.value)}
                    />
                    <input
                        type="number"
                        className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 p-3 text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 focus:ring-2 focus:ring-violet-500 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400"
                        placeholder="Valor Est."
                        value={shopEstCost}
                        onChange={e => setShopEstCost(e.target.value)}
                    />
                    <Button onClick={handleSaveShoppingItem} disabled={!shopItem}>
                        {editingShoppingId ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </Button>
                    {editingShoppingId && (
                        <Button onClick={() => { setEditingShoppingId(null); setShopItem(''); setShopEstCost(''); }} variant="secondary">
                            <X className="w-5 h-5" />
                        </Button>
                    )}
                </div>

                <div className="space-y-2">
                    {(!trip.shoppingList || trip.shoppingList.length === 0) && (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <ShoppingBag className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm">Lista vazia.</p>
                        </div>
                    )}
                    {trip.shoppingList?.map(item => (
                        <div key={item.id} className={`flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${editingShoppingId === item.id ? 'ring-2 ring-violet-200 dark:ring-violet-800' : ''}`}>
                            <div className="flex items-center gap-3 flex-1">
                                <button onClick={() => toggleShoppingItem(item.id)} className={`w-5 h-5 rounded border flex items-center justify-center ${item.purchased ? 'bg-emerald-500 border-emerald-500' : 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'}`}>
                                    {item.purchased && <Check className="w-3 h-3 text-white" />}
                                </button>
                                <div>
                                    <p className={`font-bold text-sm ${item.purchased ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-white'}`}>{item.item}</p>
                                    {item.estimatedCost ? <p className="text-xs text-slate-500 dark:text-slate-400">Est: {formatCurrency(item.estimatedCost, trip.currency)}</p> : null}
                                </div>
                            </div>
                            <div className="flex gap-2 no-print">
                                <button onClick={() => startEditingShopping(item)} className="text-slate-300 dark:text-slate-600 hover:text-violet-600 dark:hover:text-violet-400">
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteShoppingItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};
