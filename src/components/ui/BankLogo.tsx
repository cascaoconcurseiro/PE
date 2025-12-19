import React, { useState } from 'react';
import { getBankLogoUrl } from '../../utils/bankLogos';
import { Building2 } from 'lucide-react';

interface BankLogoProps {
  accountName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export const BankLogo: React.FC<BankLogoProps> = ({ 
  accountName, 
  size = 'md', 
  className = '',
  fallbackIcon
}) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getBankLogoUrl(accountName);
  
  const sizeClass = sizeClasses[size];
  
  // Se não tem logo ou deu erro, mostra fallback
  if (!logoUrl || hasError) {
    return fallbackIcon ? (
      <>{fallbackIcon}</>
    ) : (
      <div className={`${sizeClass} ${className} flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg`}>
        <Building2 className="w-1/2 h-1/2 text-slate-400" />
      </div>
    );
  }
  
  return (
    <img
      src={logoUrl}
      alt={`Logo ${accountName}`}
      className={`${sizeClass} ${className} object-contain rounded-lg`}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
};
