"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num } from "@/lib/utils";

type Series = { key: string; label: string; color: string };

const AXIS_TICK = { fontSize: 11, fill: "#6b7772" } as const;
const GRID = "#e3e8e5";
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #d8e0db",
  boxShadow: "0 12px 30px -12px rgba(16,24,20,0.35)",
  fontSize: 12,
  padding: "8px 10px",
  background: "#ffffff",
} as const;

/** Compact tick labels so large values (7,080 diners) don't get clipped. */
function tick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

function ChartFrame({ height = 260, children }: { height?: number; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  xKey,
  series,
  height,
  area = false,
  unit = "",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  height?: number;
  area?: boolean;
  unit?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (!data.length) return <NoData height={height} />;

  const common = (
    <>
      <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={AXIS_TICK}
        tickLine={false}
        axisLine={{ stroke: GRID }}
        minTickGap={16}
        interval="preserveStartEnd"
        padding={{ left: 4, right: 4 }}
      />
      <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={tick} />
      <Tooltip
        contentStyle={TOOLTIP_STYLE}
        cursor={{ stroke: "#cdd5d0", strokeWidth: 1 }}
        // Returning the series name is what stops the tooltip rendering blank rows.
        formatter={(value: unknown, name: unknown) => [`${num(Number(value), 1)}${unit}`, String(name)] as [string, string]}
        labelStyle={{ color: "#343d3a", fontWeight: 600, marginBottom: 2 }}
      />
      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
    </>
  );

  return (
    <ChartFrame height={height}>
      {area ? (
        <AreaChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {common}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${uid}-${s.key})`}
              fillOpacity={1}
              animationDuration={450}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          {common}
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              animationDuration={450}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
          ))}
        </LineChart>
      )}
    </ChartFrame>
  );
}

export function BarsChart({
  data,
  xKey,
  series,
  height,
  horizontal = false,
  stacked = false,
  unit = "",
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  unit?: string;
}) {
  if (!data.length) return <NoData height={height} />;
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 12, left: horizontal ? 8 : 0, bottom: 0 }}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={tick} />
            <YAxis type="category" dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={false} width={116} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={12} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={tick} />
          </>
        )}
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(22,163,74,0.06)" }}
          formatter={(value: unknown, name: unknown) => [`${num(Number(value), 1)}${unit}`, String(name)] as [string, string]}
          labelStyle={{ color: "#343d3a", fontWeight: 600, marginBottom: 2 }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />}
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? "a" : undefined}
            radius={horizontal ? [0, 5, 5, 0] : [5, 5, 0, 0]}
            maxBarSize={horizontal ? 18 : 44}
            animationDuration={450}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function DonutChart({
  data,
  height = 260,
  unit = "kg",
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  unit?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <NoData height={height} />;
  return (
    <div className="relative" style={{ width: "100%", height }}>
      <ChartFrame height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="84%"
            paddingAngle={2}
            animationDuration={450}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [`${num(Number(value), 1)} ${unit}`, String(name)] as [string, string]}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} iconType="circle" iconSize={8} />
        </PieChart>
      </ChartFrame>
      {/* Centre readout — the donut carries the total so the card is informative
          even before the user hovers a slice. */}
      <div className="pointer-events-none absolute inset-x-0 top-[42%] -translate-y-1/2 text-center">
        <p className="text-lg font-semibold tabular-nums tracking-tight text-ink-900">{num(total, 1)}</p>
        <p className="text-[10px] uppercase tracking-wide text-ink-400">{unit} total</p>
      </div>
    </div>
  );
}

function NoData({ height = 260 }: { height?: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-ink-50/60 text-xs text-ink-500"
      style={{ height }}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-300" fill="none" stroke="currentColor" strokeWidth={1.7}>
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path d="M7 15l3.5-4.5 3 3L21 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      No data for the selected range
    </div>
  );
}
