// Performance Optimization: Lazy Loading Components
import { lazy } from 'react';

// Lazy load heavy components to improve initial load time
export const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
export const Accounts = lazy(() => import('./components/Accounts').then(m => ({ default: m.Accounts })));
export const Transactions = lazy(() => import('./components/Transactions').then(m => ({ default: m.Transactions })));
export const Budgets = lazy(() => import('./components/Budgets').then(m => ({ default: m.Budgets })));
export const Goals = lazy(() => import('./components/Goals').then(m => ({ default: m.Goals })));
export const Trips = lazy(() => import('./components/Trips').then(m => ({ default: m.Trips })));
export const Shared = lazy(() => import('./components/Shared').then(m => ({ default: m.Shared })));

export const Family = lazy(() => import('./components/Family').then(m => ({ default: m.Family })));
export const Investments = lazy(() => import('./components/Investments').then(m => ({ default: m.Investments })));
export const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
