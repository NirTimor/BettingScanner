'use client';

interface SparklineProps {
    values: number[];
    className?: string;
    strokeClassName?: string;
}

const normalizeValues = (values: number[]) => {
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return values.map(() => 0.5);
    return values.map((val) => (val - min) / (max - min));
};

export default function Sparkline({ values, className = '', strokeClassName = 'stroke-blue-500' }: SparklineProps) {
    const cleaned = values.filter((val) => Number.isFinite(val));
    const normalized = normalizeValues(cleaned);
    const width = 120;
    const height = 32;
    const padding = 2;

    if (normalized.length < 2) {
        return (
            <div className={`h-8 w-[120px] rounded-md bg-zinc-100 dark:bg-zinc-800 ${className}`} />
        );
    }

    const points = normalized.map((val, idx) => {
        const x = padding + (idx / (normalized.length - 1)) * (width - padding * 2);
        const y = height - padding - val * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg
            className={`h-8 w-[120px] ${className}`}
            viewBox={`0 0 ${width} ${height}`}
            fill="none"
        >
            <polyline
                points={points}
                className={`${strokeClassName}`}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                fill="none"
            />
        </svg>
    );
}
