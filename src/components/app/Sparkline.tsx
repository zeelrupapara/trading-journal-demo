import { Line, LineChart, ResponsiveContainer } from "recharts";

type Props = {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
};

export function Sparkline({ data, positive = true, width = 80, height = 28 }: Props) {
  const chartData = data.map((v, i) => ({ i, v }));
  const stroke = positive ? "var(--profit)" : "var(--loss)";
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
