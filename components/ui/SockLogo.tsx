import React from 'react';

interface SockLogoProps {
    className?: string;
}

export const SockLogo: React.FC<SockLogoProps> = ({ className = "w-8 h-8" }) => {
    return (
        <img
            src="/icon-192.png"
            alt="Pé de Meia Logo"
            className={className}
            style={{ objectFit: 'contain' }}
        />
    );
};
