import React from 'react';

interface PrivacyBlurProps {
    children?: React.ReactNode;
    showValues: boolean;
    darkBg?: boolean;
}

export const PrivacyBlur: React.FC<PrivacyBlurProps> = ({ children, showValues, darkBg = false }) => {
    if (showValues) return <>{children}</>;
    return <span className={`blur-sm select-none ${darkBg ? 'opacity-80' : 'opacity-60'}`}>R$ ••••</span>;
};