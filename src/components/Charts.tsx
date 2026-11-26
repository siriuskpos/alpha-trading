"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "@/lib/types";

const axis = { fill: "#8B97A8", fontSize: 11, fontFamily: "var(--font-inter), sans-serif" };
const tipStyle = {
  background: "#161C24",
  border: "1px solid #2A3340",
  borderRadius: 12,
  fontSize: 12,
};

function dayLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(date);
}

export function EquityChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232B35" vertical={false} />
        <XAxis dataKey="t" tick={axis} tickFormatter={dayLabel} minTickGap={28} />
        <YAxis tick={axis} width={56} tickFormatter={(v) => Number(v).toFixed(2)} />
        <Tooltip
          contentStyle={tipStyle}
          labelFormatter={(label) => dayLabel(String(label))}
          formatter={(value) => [`${Number(value).toFixed(4)} τ`, "Balance"]}
        />
        <Line type="monotone" dataKey="v" stroke="#6EE0D0" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DailyChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232B35" vertical={false} />
        <XAxis dataKey="t" tick={axis} tickFormatter={dayLabel} minTickGap={28} />
        <YAxis tick={axis} width={56} tickFormatter={(v) => Number(v).toFixed(2)} />
        <Tooltip
          contentStyle={tipStyle}
          labelFormatter={(label) => dayLabel(String(label))}
          formatter={(value) => [`${Number(value).toFixed(4)} τ`, "Realized"]}
        />
        <Bar dataKey="v" radius={[4, 4, 0, 0]}>
          {data.map((row) => (
            <Cell key={row.t} fill={row.v >= 0 ? "#3DD68C" : "#FF6B6B"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SubnetBarChart({ data }: { data: { name: string; tao: number }[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#232B35" horizontal={false} />
        <XAxis type="number" tick={axis} tickFormatter={(v) => Number(v).toFixed(3)} />
        <YAxis type="category" dataKey="name" tick={axis} width={96} />
        <Tooltip contentStyle={tipStyle} formatter={(value) => [`${Number(value).toFixed(4)} τ`, "P/L"]} />
        <Bar dataKey="tao" radius={[0, 4, 4, 0]}>
          {data.map((row) => (
            <Cell key={row.name} fill={row.tao >= 0 ? "#3DD68C" : "#FF6B6B"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PriceChart({ data }: { data: { t: string; v: number }[] }) {
  if (data.length < 2) return null;
  const up = data[data.length - 1].v >= data[0].v;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232B35" vertical={false} />
        <XAxis dataKey="t" tick={axis} tickFormatter={dayLabel} minTickGap={32} />
        <YAxis tick={axis} width={72} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toPrecision(4)} />
        <Tooltip
          contentStyle={tipStyle}
          labelFormatter={(label) => dayLabel(String(label))}
          formatter={(value) => [`${Number(value).toPrecision(6)} τ`, "Price"]}
        />
        <Line type="monotone" dataKey="v" stroke={up ? "#3DD68C" : "#FF6B6B"} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
