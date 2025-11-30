import { Category } from './types';
import { 
  Home, 
  ShoppingCart, 
  Car, 
  Plane, 
  ShoppingBag, 
  Coffee, 
  HeartPulse, 
  GraduationCap, 
  DollarSign, 
  HelpCircle, 
  ArrowRightLeft,
  LucideIcon,
  Tag,
  Lightbulb,
  TrendingUp,
  Smile,
  Dog,
  Gift,
  FileText,
  Shield
} from 'lucide-react';

/**
 * Fixes JavaScript floating point errors (e.g. 0.1 + 0.2 = 0.30000000000000004)
 * Rounds to 2 decimal places.
 */
export const round2dec = (num: number): number => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const formatCurrency = (value: number, currency: string = 'BRL') => {
  try {
    // Ensure we format a clean number
    const cleanValue = round2dec(value);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency }).format(cleanValue);
  } catch (e) {
    // Fallback if currency code is invalid
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
};

export const getCategoryIcon = (category: Category | string): LucideIcon => {
  switch (category) {
    case Category.HOUSING: return Home;
    case Category.FOOD: return ShoppingCart;
    case Category.TRANSPORTATION: return Car;
    case Category.UTILITIES: return Lightbulb;
    case Category.TRAVEL: return Plane;
    case Category.SHOPPING: return ShoppingBag;
    case Category.ENTERTAINMENT: return Coffee;
    case Category.HEALTH: return HeartPulse;
    case Category.EDUCATION: return GraduationCap;
    case Category.PERSONAL_CARE: return Smile;
    case Category.PETS: return Dog;
    case Category.GIFTS: return Gift;
    case Category.INVESTMENT: return TrendingUp;
    case Category.TAXES: return FileText;
    case Category.INSURANCE: return Shield;
    case Category.INCOME: return DollarSign;
    case Category.TRANSFER: return ArrowRightLeft;
    default: return Tag; // Generic icon for custom categories
  }
};

// Fix Timezone issues by parsing YYYY-MM-DD explicitly as local time noon
export const parseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
    // Handle ISO strings with time
    if (dateString.includes('T')) return new Date(dateString);
    
    // Handle YYYY-MM-DD
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
};

export const isSameMonth = (date1: string | Date, date2: Date) => {
    const d1 = typeof date1 === 'string' ? parseDate(date1) : date1;
    return d1.getMonth() === date2.getMonth() && d1.getFullYear() === date2.getFullYear();
};