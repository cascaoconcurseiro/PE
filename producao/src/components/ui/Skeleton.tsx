import React from 'react';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
    return (
        <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-md ${className}`} />
    );
};

export const DashboardSkeleton = () => {
    return (
        <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-32 rounded-3xl" />
                <Skeleton className="h-32 rounded-3xl" />
                <Skeleton className="h-32 rounded-3xl" />
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Skeleton className="h-80 lg:col-span-2 rounded-3xl" />
                <Skeleton className="h-80 rounded-3xl" />
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    );
};
