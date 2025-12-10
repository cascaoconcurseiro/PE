import React, { useMemo } from 'react';

interface MiniSparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: 'emerald' | 'red' | 'indigo' | 'slate';
    showDots?: boolean;
    className?: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
    data,
    width = 80,
    height = 24,
    color = 'emerald',
    showDots = false,
    className = ''
}) => {
    const colorMap = {
        emerald: { stroke: '#10b981', fill: '#10b98120' },
        red: { stroke: '#ef4444', fill: '#ef444420' },
        indigo: { stroke: '#6366f1', fill: '#6366f120' },
        slate: { stroke: '#64748b', fill: '#64748b20' }
    };

    const { path, fillPath, points } = useMemo(() => {
        if (!data || data.length === 0) return { path: '', fillPath: '', points: [] };

        const padding = 4;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        const pts = data.map((value, index) => ({
            x: padding + (index / (data.length - 1 || 1)) * chartWidth,
            y: padding + chartHeight - ((value - min) / range * chartHeight)
        }));

        // Smooth curve using bezier
        let pathD = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const curr = pts[i];
            const cpx = (prev.x + curr.x) / 2;
            pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
        }

        // Fill path (closed)
        const fillD = pathD + ` L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;

        return { path: pathD, fillPath: fillD, points: pts };
    }, [data, width, height]);

    if (!data || data.length < 2) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
                <span className="text-xs text-slate-400">-</span>
            </div>
        );
    }

    const trend = data[data.length - 1] > data[0];
    const { stroke, fill } = colorMap[color];

    return (
        <svg width={width} height={height} className={className}>
            {/* Gradient fill */}
            <defs>
                <linearGradient id={`sparkline-gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={fill} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={fill} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Fill area */}
            <path
                d={fillPath}
                fill={`url(#sparkline-gradient-${color})`}
            />

            {/* Line */}
            <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* End dot */}
            {showDots && points.length > 0 && (
                <circle
                    cx={points[points.length - 1]?.x}
                    cy={points[points.length - 1]?.y}
                    r="3"
                    fill={stroke}
                />
            )}
        </svg>
    );
};

// Helper to generate sparkline data from transactions
export const generateSparklineData = (
    transactions: { date: string; amount: number; type: string }[],
    days: number = 7
): number[] => {
    const now = new Date();
    const data: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() - i);
        const dateStr = targetDate.toISOString().split('T')[0];

        const dayTotal = transactions
            .filter(t => t.date.startsWith(dateStr))
            .reduce((sum, t) =>
                sum + (t.type === 'INCOME' ? t.amount : -t.amount), 0);

        data.push(dayTotal);
    }

    // Convert to cumulative
    let cumulative = 0;
    return data.map(d => {
        cumulative += d;
        return cumulative;
    });
};
