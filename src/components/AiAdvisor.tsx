import React from 'react';
import { Card } from './ui/Card';

interface AiAdvisorProps {
    contextData: any;
}

export const AiAdvisor: React.FC<AiAdvisorProps> = ({ contextData }) => {
    return (
        <Card className="p-4">
            <p className="text-center text-slate-500">O consultor IA está temporariamente indisponível.</p>
        </Card>
    );
};