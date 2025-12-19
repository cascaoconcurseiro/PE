import React from 'react';
import { getBankSvg } from '../../utils/bankLogos';
import { Building2 } from 'lucide-react';

interface BankLogoProps {
  accountName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

export const BankLogo: React.FC<BankLogoProps> = ({ 
  accountName, 
  size = 'md', 
  className = '',
  fallbackIcon
}) => {
  const svgString = getBankSvg(accountName);
  const sizeClass = sizeClasses[size];
  
  // Se não tem logo, mostra fallback
  if (!svgString) {
    return fallbackIcon ? (
      <>{fallbackIcon}</>
    ) : (
      <div className={`${sizeClass} ${className} flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg`}>
        <Building2 className="w-1/2 h-1/2 text-slate-400" />
      </div>
    );
  }
  
  return (
    <div 
      className={`${sizeClass} ${className} rounded-lg overflow-hidden`}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};
