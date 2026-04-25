import { useEffect, useRef } from "react";

type Props = {
  symbol: string;
  height?: number;
  interval?: "1" | "5" | "15" | "30" | "60" | "240" | "D" | "W";
};

/**
 * Embeds the TradingView Advanced Chart widget.
 * Loads the external script lazily into a unique container per mount.
 */
export function TradingViewChart({ symbol, height = 420, interval = "60" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    container.innerHTML = "";

    const widgetEl = document.createElement("div");
    widgetEl.className = "tradingview-widget-container__widget";
    widgetEl.style.height = "100%";
    widgetEl.style.width = "100%";
    container.appendChild(widgetEl);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0,0,0,0)",
      gridColor: "rgba(255,255,255,0.06)",
      hide_side_toolbar: false,
      allow_symbol_change: true,
      withdateranges: true,
      details: false,
      hotlist: false,
      calendar: false,
      studies: ["STD;EMA"],
      support_host: "https://www.tradingview.com",
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container rounded-md overflow-hidden border border-border"
      style={{ height }}
    />
  );
}
