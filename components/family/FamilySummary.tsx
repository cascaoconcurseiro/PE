import React from 'react';
import { Card } from '../ui/Card';
import { Users, UserPlus, Mail } from 'lucide-react';

interface FamilySummaryProps {
    totalMembers: number;
    pendingInvites: number;
}

export const FamilySummary: React.FC<FamilySummaryProps> = ({ totalMembers, pendingInvites }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Total Members Card */}
            <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Users className="w-24 h-24 text-white" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Total de Membros</p>
                            <h3 className="text-3xl font-black">{totalMembers}</h3>
                        </div>
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-blue-100 text-xs flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                            Compartilhando despesas ativamente
                        </p>
                    </div>
                </div>
            </Card>

            {/* Invites / Status Card */}
            <Card className="bg-gradient-to-br from-violet-600 to-purple-700 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                    <Mail className="w-24 h-24 text-white" />
                </div>
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-violet-200 text-xs font-bold uppercase tracking-wider mb-1">Status de Convites</p>
                            <h3 className="text-3xl font-black">{pendingInvites}</h3>
                        </div>
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm border border-white/10">
                            <UserPlus className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div className="mt-4">
                        {pendingInvites > 0 ? (
                            <p className="text-violet-100 text-xs font-bold bg-white/20 inline-block px-2 py-1 rounded-lg">
                                {pendingInvites} {pendingInvites === 1 ? 'convite pendente' : 'convites pendentes'}
                            </p>
                        ) : (
                            <p className="text-violet-100 text-xs opacity-80">
                                Todos os convites aceitos
                            </p>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};
