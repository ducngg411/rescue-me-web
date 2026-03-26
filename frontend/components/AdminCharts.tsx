'use client';

/**
 * AdminCharts – shared, zero-dependency SVG charting primitives for admin pages.
 * 
 * Components exported:
 *  - HorizontalBarChart  (top-N ranked list with colored bars)
 *  - VerticalBarChart    (categorical bar chart, e.g. status distributions)
 *  - LineSparkChart      (7/30 day trend sparkline)
 *  - DonutChart          (status proportion ring)
 *  - ChartCard           (wrapper card with title + icon)
 */

import React from 'react';

// ─── Shared token ──────────────────────────────────────────────────────────────
const C = {
    navy: '#1a1a2e',
    gray: '#6b7280',
    grayLight: '#cbd5e1',
    border: '#e2e8f0',
    bg: '#f4f6f9',
    orange: '#f97316',
};

// ─── ChartCard ─────────────────────────────────────────────────────────────────
interface ChartCardProps {
    title: string;
    icon?: React.ReactNode;
    iconBg?: string;
    iconColor?: string;
    children: React.ReactNode;
    className?: string;
}
export function ChartCard({ title, icon, iconBg, iconColor, children, className = '' }: ChartCardProps) {
    return (
        <div className={`bg-white rounded-2xl border p-5 ${className}`} style={{ borderColor: C.border }}>
            <div className="flex items-center gap-2 mb-4">
                {icon && (
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: iconBg ?? '#fff7ed', color: iconColor ?? C.orange }}>
                        {icon}
                    </div>
                )}
                <h3 className="text-sm font-bold" style={{ color: C.navy }}>{title}</h3>
            </div>
            {children}
        </div>
    );
}

// ─── HorizontalBarChart ───────────────────────────────────────────────────────
// Perfect for "Top 10 users with most requests", "Top providers by revenue", etc.
export interface HBarItem {
    label: string;
    sublabel?: string;
    value: number;
    displayValue?: string;
    color?: string;
    rank?: number;
}

interface HorizontalBarChartProps {
    items: HBarItem[];
    color?: string;
    emptyLabel?: string;
    loading?: boolean;
    suffix?: string;
}

export function HorizontalBarChart({
    items, color = C.orange, emptyLabel = 'Không có dữ liệu', loading = false, suffix = '',
}: HorizontalBarChartProps) {
    const max = Math.max(...items.map(i => i.value), 1);

    if (loading) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded animate-pulse" style={{ background: C.border }} />
                        <div className="flex-1 h-4 rounded animate-pulse" style={{ background: C.border }} />
                        <div className="w-12 h-4 rounded animate-pulse" style={{ background: C.border }} />
                    </div>
                ))}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center py-8 text-sm" style={{ color: C.grayLight }}>
                {emptyLabel}
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            {items.map((item, i) => {
                const pct = max > 0 ? (item.value / max) * 100 : 0;
                const rank = item.rank ?? i + 1;
                return (
                    <div key={i} className="group">
                        <div className="flex items-center gap-2 mb-1">
                            {/* Rank badge */}
                            <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: rank <= 3 ? color : C.bg,
                                    color: rank <= 3 ? '#fff' : C.gray,
                                }}>
                                {rank}
                            </span>
                            {/* Label */}
                            <span className="text-xs font-medium truncate flex-1" style={{ color: C.navy }}>
                                {item.label}
                            </span>
                            {/* Sub-label */}
                            {item.sublabel && (
                                <span className="text-[10px] mr-1 hidden group-hover:inline" style={{ color: C.gray }}>
                                    {item.sublabel}
                                </span>
                            )}
                            {/* Value */}
                            <span className="text-xs font-bold flex-shrink-0" style={{ color: C.navy }}>
                                {item.displayValue ?? item.value.toLocaleString('vi-VN')}{suffix}
                            </span>
                        </div>
                        {/* Bar */}
                        <div className="ml-7 h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── VerticalBarChart ─────────────────────────────────────────────────────────
// Perfect for "requests per status", "disputes per type", etc.
export interface VBarItem {
    label: string;
    value: number;
    color?: string;
    displayValue?: string;
}

interface VerticalBarChartProps {
    items: VBarItem[];
    height?: number;
    defaultColor?: string;
    loading?: boolean;
}

export function VerticalBarChart({
    items, height = 120, defaultColor = C.orange, loading = false,
}: VerticalBarChartProps) {
    const max = Math.max(...items.map(i => i.value), 1);

    if (loading) {
        return (
            <div className="flex items-end gap-2" style={{ height }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex-1 rounded-t-md animate-pulse" style={{
                        height: `${30 + Math.random() * 60}%`, background: C.border,
                    }} />
                ))}
            </div>
        );
    }

    return (
        <div className="flex items-end gap-1.5" style={{ height }}>
            {items.map((item, i) => {
                const barH = max > 0 ? (item.value / max) * 100 : 5;
                const color = item.color ?? defaultColor;
                return (
                    <div key={i} className="flex flex-col items-center flex-1 gap-1 group" style={{ height: '100%' }}>
                        {/* Tooltip on hover */}
                        <span className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color }}>
                            {item.displayValue ?? item.value.toLocaleString('vi-VN')}
                        </span>
                        {/* Bar grow from bottom */}
                        <div className="w-full flex flex-col justify-end" style={{ flex: 1 }}>
                            <div
                                className="w-full rounded-t-md transition-all duration-500"
                                style={{ height: `${barH}%`, background: color, opacity: 0.85, minHeight: item.value > 0 ? 3 : 0 }}
                            />
                        </div>
                        {/* Label */}
                        <span className="text-[10px] text-center leading-tight" style={{ color: C.gray }}>
                            {item.label.length > 8 ? item.label.slice(0, 7) + '…' : item.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── LineSparkChart ───────────────────────────────────────────────────────────
// Sparkline for 7-day or 30-day trends. Lightweight and elegant.
export interface SparkPoint {
    label: string;
    value: number;
}

interface LineSparkChartProps {
    points: SparkPoint[];
    color?: string;
    height?: number;
    width?: number;
    showDots?: boolean;
    showLabels?: boolean;
    showArea?: boolean;
}

export function LineSparkChart({
    points, color = C.orange, height = 80, width = 300, showDots = true, showLabels = false, showArea = true,
}: LineSparkChartProps) {
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
    const uid = React.useId().replace(/:/g, '');

    if (points.length === 0) return null;

    const padX = 12;
    const padY = 16;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    const values = points.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values, 1);
    const range = max - min;

    const toX = (i: number) => padX + (i / Math.max(points.length - 1, 1)) * innerW;
    const toY = (v: number) => height - padY - (range === 0 ? innerH / 2 : ((v - min) / range) * innerH);

    const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`)
        .join(' ');

    // Close area path
    const areaD = `${pathD} L${toX(points.length - 1).toFixed(1)},${height - padY} L${toX(0).toFixed(1)},${height - padY} Z`;

    return (
        <div style={{ position: 'relative', width: '100%', height }}>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.00" />
                    </linearGradient>
                </defs>
                {/* Grid lines */}
                {[0, 0.5, 1].map((f, gi) => (
                    <line key={gi}
                        x1={padX} y1={padY + (1 - f) * innerH}
                        x2={width - padX} y2={padY + (1 - f) * innerH}
                        stroke={C.border} strokeWidth={0.8} strokeDasharray="3,3"
                    />
                ))}
                {/* Area fill */}
                {showArea && <path d={areaD} fill={`url(#grad-${uid})`} />}
                {/* Line */}
                <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                
                {/* Dots & Interactions */}
                {points.map((p, i) => {
                    const cx = toX(i);
                    const cy = toY(p.value);
                    const isHovered = hoveredIdx === i;
                    
                    let tooltipX = cx;
                    if (tooltipX < 30) tooltipX = 30;
                    if (tooltipX > width - 30) tooltipX = width - 30;

                    return (
                        <g key={i} 
                           className="cursor-pointer" 
                           onMouseEnter={() => setHoveredIdx(i)} 
                           onMouseLeave={() => setHoveredIdx(null)}
                           onClick={() => setHoveredIdx(i)}
                        >
                            {/* Hit area for easier hovering */}
                            <circle cx={cx} cy={cy} r={Math.max(12, innerW / points.length / 2)} fill="transparent" />
                            
                            {/* Visible Dot */}
                            {showDots && (
                                <circle 
                                    cx={cx} cy={cy} 
                                    r={isHovered ? 4.5 : 3} 
                                    fill={isHovered ? '#fff' : color} 
                                    stroke={isHovered ? color : '#fff'} 
                                    strokeWidth={isHovered ? 2 : 1.5} 
                                    className="transition-all duration-200"
                                />
                            )}

                            {/* Tooltip & Guideline */}
                            {isHovered && (
                                <g>
                                    <line x1={cx} y1={cy + 5} x2={cx} y2={height - padY} stroke={color} strokeWidth={1} strokeDasharray="2,2" opacity={0.6} />
                                    <rect x={tooltipX - 25} y={cy - 28} width={50} height={20} rx={4} fill={C.navy} />
                                    <polygon points={`${cx - 4},${cy - 8} ${cx + 4},${cy - 8} ${cx},${cy - 4}`} fill={C.navy} />
                                    <text x={tooltipX} y={cy - 14} fill="#fff" fontSize={10} fontWeight="bold" textAnchor="middle">
                                        {p.value.toLocaleString('vi-VN')}
                                    </text>
                                    <text x={tooltipX} y={cy - 33} fill={C.gray} fontSize={9} fontWeight="500" textAnchor="middle">
                                        {p.label}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}
                
                {/* X-axis Labels */}
                {showLabels && points.map((p, i) => {
                    if (points.length > 10 && i % Math.floor(points.length / 5) !== 0 && i !== 0 && i !== points.length - 1) return null;
                    return (
                        <text key={i} x={toX(i)} y={height + 4} textAnchor="middle" fontSize={9} fill={C.gray} 
                            opacity={hoveredIdx === i ? 0 : 1} className="transition-opacity">
                            {p.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────
export interface DonutSlice {
    label: string;
    value: number;
    color: string;
}

export function DonutChart({ slices, size = 120, centerLabel, centerSub }: {
    slices: DonutSlice[]; size?: number; centerLabel?: string; centerSub?: string;
}) {
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
    const total = slices.reduce((s, d) => s + d.value, 0);
    const r = 40;
    const stroke = 13;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    let offset = 0;
    const segments = slices.map((s) => {
        const pct = total > 0 ? s.value / total : 0;
        const dash = circumference * pct;
        const seg = { ...s, dash, gap: circumference - dash, offset };
        offset += dash;
        return seg;
    });

    const displayLabel = hoveredIdx !== null ? slices[hoveredIdx].value.toLocaleString('vi-VN') : (centerLabel || '');
    const displaySub = hoveredIdx !== null ? slices[hoveredIdx].label : (centerSub || '');

    return (
        <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
                {total === 0 ? (
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
                ) : segments.map((seg, i) => (
                    <circle 
                        key={i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={seg.color} 
                        strokeWidth={hoveredIdx === i ? stroke + 3 : stroke}
                        strokeDasharray={`${seg.dash} ${seg.gap}`}
                        strokeDashoffset={-seg.offset}
                        strokeLinecap="butt"
                        className="transition-all duration-300 cursor-pointer origin-center"
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        onClick={() => setHoveredIdx(i)}
                    />
                ))}
            </svg>
            {(displayLabel || displaySub) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-2 text-center">
                    {displayLabel && (
                        <p className="text-lg font-bold leading-none truncate w-full" style={{ color: hoveredIdx !== null ? segments[hoveredIdx].color : C.navy }}>
                            {displayLabel}
                        </p>
                    )}
                    {displaySub && (
                        <p className="text-[9px] font-semibold mt-1 uppercase tracking-wider truncate w-full" style={{ color: C.gray }}>
                            {displaySub.length > 12 ? displaySub.slice(0,10) + '...' : displaySub}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
