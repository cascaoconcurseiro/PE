import React from 'react';

interface SimpleBarChartProps {
    data: { name: string; value: number; color?: string }[];
    height?: number;
}

export const SimpleBarChart: React.FC<SimpleBarChartProps> = ({ data, height = 200 }) => {
    const maxValue = Math.max(...data.map(d => d.value));

    return (
        <div className="flex items-end gap-2 h-full" style={{ height: `${height}px` }}>
            {data.map((item, index) => {
                const barHeight = (item.value / maxValue) * 100;
                return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            {item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                        <div
                            className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80"
                            style={{
                                height: `${barHeight}%`,
                                backgroundColor: item.color || '#4f46e5',
                                minHeight: '4px'
                            }}
                        />
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                            {item.name}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

interface SimpleLineChartProps {
    data: { name: string; value: number }[];
    color?: string;
    height?: number;
}

export const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data, color = '#10b981', height = 200 }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue;

    const points = data.map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((item.value - minValue) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative" style={{ height: `${height}px` }}>
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="currentColor" strokeWidth="0.1" className="text-slate-200 dark:text-slate-700" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.1" className="text-slate-200 dark:text-slate-700" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="currentColor" strokeWidth="0.1" className="text-slate-200 dark:text-slate-700" />

                {/* Area under line */}
                <polygon
                    points={`0,100 ${points} 100,100`}
                    fill={color}
                    fillOpacity="0.1"
                />

                {/* Line */}
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-500"
                />

                {/* Points */}
                {data.map((item, index) => {
                    const x = (index / (data.length - 1)) * 100;
                    const y = 100 - ((item.value - minValue) / range) * 100;
                    return (
                        <circle
                            key={index}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill={color}
                            className="transition-all duration-500 hover:r-2"
                        />
                    );
                })}
            </svg>

            {/* Labels */}
            <div className="flex justify-between mt-2">
                {data.map((item, index) => (
                    <div key={index} className="text-xs text-slate-500 dark:text-slate-400">
                        {item.name}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface SimplePieChartProps {
    data: { name: string; value: number; color: string }[];
    size?: number;
}

export const SimplePieChart: React.FC<SimplePieChartProps> = ({ data, size = 200 }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90;

    return (
        <div className="flex flex-col items-center gap-4">
            <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
                {data.map((item, index) => {
                    const percentage = (item.value / total) * 100;
                    const angle = (percentage / 100) * 360;
                    const startAngle = currentAngle;
                    const endAngle = currentAngle + angle;

                    const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                    const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                    const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                    const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);

                    const largeArc = angle > 180 ? 1 : 0;
                    const path = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

                    currentAngle += angle;

                    return (
                        <path
                            key={index}
                            d={path}
                            fill={item.color}
                            className="transition-all duration-500 hover:opacity-80"
                        />
                    );
                })}
                <circle cx="50" cy="50" r="25" fill="white" className="dark:fill-slate-900" />
            </svg>

            <div className="flex flex-wrap gap-3 justify-center">
                {data.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {item.name}: {((item.value / total) * 100).toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
