import React from 'react';

interface SockLogoProps {
    className?: string;
}

export const SockLogo: React.FC<SockLogoProps> = ({ className = "w-8 h-8" }) => {
    return (
        <svg
            viewBox="0 0 100 100"
            className={className}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Sock body - green with beige stripes */}
            <path
                d="M35 25 C35 25, 30 30, 30 40 L30 60 C30 65, 32 70, 38 72 L50 75 C55 76, 60 74, 62 70 L65 60 L65 40 C65 30, 60 25, 35 25 Z"
                fill="#10b981"
                stroke="#059669"
                strokeWidth="1.5"
            />

            {/* Beige stripes on sock */}
            <rect x="30" y="35" width="35" height="4" fill="#d4a574" opacity="0.8" rx="1" />
            <rect x="30" y="45" width="35" height="4" fill="#d4a574" opacity="0.8" rx="1" />
            <rect x="30" y="55" width="35" height="4" fill="#d4a574" opacity="0.8" rx="1" />

            {/* Sock opening/rim */}
            <ellipse cx="47.5" cy="25" rx="15" ry="5" fill="#059669" />
            <ellipse cx="47.5" cy="25" rx="13" ry="4" fill="#10b981" />

            {/* Coins */}
            <circle cx="45" cy="18" r="5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            <text x="45" y="21" fontSize="6" fill="#f59e0b" textAnchor="middle" fontWeight="bold">$</text>

            <circle cx="55" cy="15" r="4.5" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            <text x="55" y="18" fontSize="5" fill="#f59e0b" textAnchor="middle" fontWeight="bold">$</text>

            <circle cx="38" cy="20" r="4" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            <text x="38" y="23" fontSize="5" fill="#f59e0b" textAnchor="middle" fontWeight="bold">$</text>

            {/* Small coin falling */}
            <circle cx="60" cy="22" r="3" fill="#fbbf24" stroke="#f59e0b" strokeWidth="0.8" />

            {/* Dollar bill peeking out */}
            <rect x="42" y="12" width="8" height="5" fill="#34d399" stroke="#10b981" strokeWidth="0.8" rx="0.5" />
            <text x="46" y="16" fontSize="3" fill="#059669" textAnchor="middle" fontWeight="bold">$</text>
        </svg>
    );
};
