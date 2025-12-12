import React, { useState } from 'react';
import { FamilyMember } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Users, User, Trash2, Mail, Pencil, X, Check, Loader2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { FamilySummary } from './family/FamilySummary';

interface FamilyProps {
    members: FamilyMember[];
    onAddMember: (member: Partial<FamilyMember>) => void;
    onUpdateMember: (member: FamilyMember) => void;
    onDeleteMember: (id: string) => void;
    onInviteMember?: (memberId: string, email: string) => Promise<void>;
}

export const Family: React.FC<FamilyProps> = ({ members, onAddMember, onUpdateMember, onDeleteMember, onInviteMember }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [email, setEmail] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Email Check State
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [emailCheckStatus, setEmailCheckStatus] = useState<'IDLE' | 'FOUND' | 'NOT_FOUND'>('IDLE');
    const [lastCheckedEmail, setLastCheckedEmail] = useState('');
    const [foundUserId, setFoundUserId] = useState<string | null>(null);

    const checkEmail = async (emailToCheck: string) => {
        const cleanEmail = emailToCheck.trim();
        if (!cleanEmail || cleanEmail === lastCheckedEmail) return;

        setIsCheckingEmail(true);
        setLastCheckedEmail(cleanEmail);
        try {
            const { data: inviteeId } = await supabase.rpc('check_user_by_email', { email_to_check: cleanEmail });
            if (inviteeId) {
                setEmailCheckStatus('FOUND');
                setFoundUserId(inviteeId);
            } else {
                setEmailCheckStatus('NOT_FOUND');
                setFoundUserId(null);
            }
        } catch (error) {
            console.error("Error checking email:", error);
            setEmailCheckStatus('NOT_FOUND');
        } finally {
            setIsCheckingEmail(false);
        }
    };

    const handleEmailBlur = () => {
        if (email && email.includes('@')) {
            checkEmail(email);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const currentEmail = email.trim() || undefined;
        let finalMemberId = editingId;
        let shouldInvite = false;

        // Check for invite if email is present and changed (or new)
        if (currentEmail && onInviteMember) {
            let inviteeId = foundUserId;

            // If not checked yet or changed since last check (rare edge case if typing fast then enter)
            if (currentEmail !== lastCheckedEmail) {
                const { data } = await supabase.rpc('check_user_by_email', { email_to_check: currentEmail });
                inviteeId = data;
            }

            if (inviteeId) {
                const confirmInvite = window.confirm(`O usuário com e-mail ${currentEmail} foi encontrado no sistema.\n\nDeseja enviar uma solicitação para compartilhar todas as despesas vinculadas a este membro?`);
                if (confirmInvite) {
                    shouldInvite = true;
                }
            }
        }

        if (editingId) {
            // Update existing
            onUpdateMember({
                id: editingId,
                name: name.trim(),
                role: role.trim(),
                email: currentEmail
            });
        } else {
            // Add new - generate ID here if inviting, so we can link it
            finalMemberId = crypto.randomUUID();
            onAddMember({
                id: finalMemberId,
                name: name.trim(),
                role: role.trim(),
                email: currentEmail
            });
        }

        if (shouldInvite && finalMemberId && currentEmail && onInviteMember) {
            await onInviteMember(finalMemberId, currentEmail);
        }

        // Reset form
        setName('');
        setRole('');
        setEmail('');
        setEditingId(null);
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
        setIsFormOpen(false);
    };

    const handleEdit = (member: FamilyMember) => {
        setName(member.name);
        setRole(member.role || '');
        setEmail(member.email || '');
        setEditingId(member.id);
        // Reset check state on edit start to force re-check if they touch it
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
        setIsFormOpen(true);
    };

    const handleCancelEdit = () => {
        setName('');
        setRole('');
        setEmail('');
        setEditingId(null);
        setEmailCheckStatus('IDLE');
        setLastCheckedEmail('');
        setFoundUserId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Minha Família</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Gerencie quem divide as contas com você.</p>
                </div>
                <Button
                    onClick={() => setIsFormOpen(true)}
                    size="sm"
                    className="shadow-md shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 text-white h-9 text-xs"
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo Membro
                </Button>
            </div>

            <FamilySummary totalMembers={members.length} pendingInvites={0} />

            {isFormOpen && (
                <div className="relative">
                    {/* Overlay if needed or just inline card */}
                    <Card className="bg-white dark:bg-slate-800 border-none shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 mb-6" title={editingId ? "Editar Membro" : "Novo Membro"}>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            className="w-full pl-9 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Ex: João"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Parentesco (Opcional)</label>
                                    <input
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                        value={role}
                                        onChange={e => setRole(e.target.value)}
                                        placeholder="Ex: Cônjuge"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Email (Para compartilhar despesas)</label>
                                <div className="relative group">
                                    <div className={`absolute inset-0 rounded-xl transition-opacity opacity-0 group-focus-within:opacity-100 pointer-events-none ring-2 ${emailCheckStatus === 'FOUND' ? 'ring-emerald-500/20' : 'ring-blue-500/20'}`} />
                                    <input
                                        type="email"
                                        className={`w-full pl-9 pr-9 px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 text-sm font-medium transition-all ${emailCheckStatus === 'FOUND' ? 'border-emerald-500 focus:border-emerald-500' : emailCheckStatus === 'NOT_FOUND' ? 'border-amber-300 focus:border-amber-400' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500'}`}
                                        value={email}
                                        onChange={e => {
                                            setEmail(e.target.value);
                                            if (e.target.value !== lastCheckedEmail) setEmailCheckStatus('IDLE');
                                        }}
                                        onBlur={handleEmailBlur}
                                        placeholder="email@exemplo.com"
                                    />
                                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

                                    {/* Status Indicator */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {isCheckingEmail && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                                        {!isCheckingEmail && emailCheckStatus === 'FOUND' && <UserCheck className="w-4 h-4 text-emerald-600" aria-label="Usuário encontrado" />}
                                        {!isCheckingEmail && emailCheckStatus === 'NOT_FOUND' && email && <UserX className="w-4 h-4 text-amber-500" aria-label="Usuário não encontrado" />}
                                    </div>
                                </div>
                                {/* Feedback Text */}
                                {emailCheckStatus === 'FOUND' && !isCheckingEmail && (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1.5 px-1 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Usuário do App encontrado!
                                    </p>
                                )}
                                {emailCheckStatus === 'NOT_FOUND' && !isCheckingEmail && email && (
                                    <p className="text-[10px] text-amber-600 mt-1.5 px-1 flex items-center gap-1 font-medium">
                                        <UserX className="w-3 h-3" /> Usuário não possui conta no App ainda
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="submit" disabled={!name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                                    {editingId ? 'Salvar Alterações' : 'Adicionar Membro'}
                                </Button>
                                <Button type="button" variant="ghost" onClick={handleCancelEdit} className="flex-1 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                                    Cancelar
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            <div className="space-y-3">
                {members.length === 0 && !isFormOpen && (
                    <div className="text-center py-12 px-4 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-full inline-flex mb-4 text-slate-400">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Família Vazia</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 max-w-xs mx-auto">Adicione pessoas para começar a dividir despesas e controlar gastos em conjunto.</p>
                        <Button onClick={() => setIsFormOpen(true)} variant="secondary" className="text-blue-600 bg-blue-50 hover:bg-blue-100 border-none">
                            Adicionar Primeiro Membro
                        </Button>
                    </div>
                )}

                {members.map(member => (
                    <div
                        key={member.id}
                        className={`group bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all flex justify-between items-center ${editingId === member.id ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold shadow-inner ${member.email ? 'bg-gradient-to-br from-indigo-100 to-blue-100 text-indigo-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                                {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white text-base">{member.name}</h3>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                    {member.role && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wide">
                                            {member.role}
                                        </span>
                                    )}
                                    {member.email && (
                                        <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                            <Mail className="w-3 h-3" />
                                            <span className="truncate max-w-[150px]">{member.email}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => handleEdit(member)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-colors"
                                title="Editar"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDeleteMember(member.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                                title="Excluir"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};