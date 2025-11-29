import React, { useEffect } from 'react';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../integrations/supabase/client';
import { Card } from './ui/Card';
import { PiggyBank, ShieldCheck } from 'lucide-react';

interface AuthProps {
    onLogin: (user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
    
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                // Transform Supabase user to our UserProfile type
                const userProfile = {
                    id: session.user.id,
                    name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'Usuário',
                    email: session.user.email || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncStatus: 'PENDING'
                };
                onLogin(userProfile);
            }
        });

        return () => subscription.unsubscribe();
    }, [onLogin]);

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-20 -left-20 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-3xl shadow-2xl mb-4 transform rotate-3">
                        <PiggyBank className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Pé de Meia</h1>
                    <p className="text-slate-400 text-sm">Sistema Financeiro Pessoal Profissional</p>
                </div>

                <Card className="bg-white border-none shadow-2xl overflow-hidden">
                    <div className="p-2">
                        <SupabaseAuth 
                            supabaseClient={supabase}
                            appearance={{ 
                                theme: ThemeSupa,
                                variables: {
                                    default: {
                                        colors: {
                                            brand: '#059669', // Emerald 600
                                            brandAccent: '#047857', // Emerald 700
                                        }
                                    }
                                }
                            }}
                            providers={[]}
                            localization={{
                                variables: {
                                    sign_in: {
                                        email_label: 'Endereço de E-mail',
                                        password_label: 'Sua Senha',
                                        button_label: 'Entrar',
                                        loading_button_label: 'Entrando...',
                                    },
                                    sign_up: {
                                        email_label: 'Endereço de E-mail',
                                        password_label: 'Crie uma Senha',
                                        button_label: 'Criar Conta',
                                        loading_button_label: 'Criando...',
                                    }
                                }
                            }}
                            theme="light"
                        />
                    </div>
                </Card>

                <div className="flex items-center justify-center gap-2 mt-8 text-slate-500 text-xs">
                    <ShieldCheck className="w-4 h-4" />
                    <p>Ambiente Seguro • Dados Criptografados</p>
                </div>
            </div>
        </div>
    );
};