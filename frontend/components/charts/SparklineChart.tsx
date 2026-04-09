"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { PriceBar } from "@/types/openbb";

interface Props {
  data: PriceBar[];
  positive: boolean;
}

export default function SparklineChart({ data, positive }: Props) {
  const color = positive ? "#22c55e" : "#ef4444";
  const chartData = data.map((d) => ({ v: d.close }));

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
