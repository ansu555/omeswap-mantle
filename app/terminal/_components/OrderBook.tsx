"use client";

import { useEffect, useMemo, useState } from "react";
import type { DexDepth, DexDepthRow, DexMarket, DexTrade } from "@/lib/dex/types";

type Tab = "depth" | "swaps";

type DepthResponse = {
  depth: DexDepth;
};

type TradesResponse = {
  trades: DexTrade[];
};

type MarketResponse = {
  market: DexMarket;
};

const ROW_LIMIT = 10;

export function OrderBook({ marketId }: { marketId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("depth");
  const [asks, setAsks] = useState<DexDepthRow[]>([]);
  const [bids, setBids] = useState<DexDepthRow[]>([]);
  const [trades, setTrades] = useState<DexTrade[]>([]);
  const [spread, setSpread] = useState(0);
  const [market, setMarket] = useState<DexMarket | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "offline">("loading");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!lastUpdated) return;
    setSecondsAgo(0);
    const tick = window.setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [lastUpdated]);

  useEffect(() => {
    let disposed = false;
    const aborter = new AbortController();

    async function loadDepth() {
      if (!disposed) setStatus("loading");

      try {
        const [depthResponse, tradesResponse, marketResponse] = await Promise.all([
          fetch(`/api/dex/depth?market=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
          fetch(`/api/dex/trades?market=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
          fetch(`/api/dex/markets?id=${encodeURIComponent(marketId)}`, {
            signal: aborter.signal,
          }),
        ]);

        if (!depthResponse.ok || !tradesResponse.ok || !marketResponse.ok) {
          throw new Error("Liquidity snapshot failed");
        }

        const depth = (await depthResponse.json()) as DepthResponse;
        const recentTrades = (await tradesResponse.json()) as TradesResponse;
        const marketSnapshot = (await marketResponse.json()) as MarketResponse;

        if (disposed) return;

        setAsks(depth.depth.asks.slice(0, ROW_LIMIT));
        setBids(depth.depth.bids.slice(0, ROW_LIMIT));
        setSpread(depth.depth.spread);
        setTrades(recentTrades.trades);
        setMarket(marketSnapshot.market);
        setStatus("live");
        setLastUpdated(new Date());
      } catch {
        if (!disposed && !aborter.signal.aborted) {
          setStatus("offline");
        }
      }
    }

    loadDepth();
    const timer = window.setInterval(loadDepth, 10000);

    return () => {
      disposed = true;
      aborter.abort();
      window.clearInterval(timer);
    };
  }, [marketId]);

  const maxTotal = useMemo(
    () => Math.max(1, ...asks.map((a) => a.total), ...bids.map((b) => b.total)),
    [asks, bids],
  );
  const sizeLabel = market?.symbol ?? "Token";
  const isPerp = market?.kind === "perp";

  return (
    <div className="w-[340px] shrink-0 border-r border-border bg-background flex flex-col">
      <div className="grid grid-cols-2 border-b border-border text-sm">
        <button
          onClick={() => setActiveTab("depth")}
          className={`py-3 font-medium ${
            activeTab === "depth" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Liquidity Depth
        </button>
        <button
          onClick={() => setActiveTab("swaps")}
          className={`py-3 font-medium ${
            activeTab === "swaps" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Swaps
        </button>
      </div>

      {activeTab === "depth" ? (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-muted-foreground">
            <span>Price</span>
            <span className="text-right">Size ({sizeLabel})</span>
            <span className="text-right">Total ({sizeLabel})</span>
          </div>

          <div className="flex-1 overflow-hidden">
            {(asks.length ? asks : placeholderRows("ask")).map((row, index) => (
              <BookRow key={`a-${row.price}-${index}`} row={row} side="ask" maxTotal={maxTotal} muted={!asks.length} />
            ))}

            <div className="flex items-center justify-between gap-3 py-1.5 px-3 text-[11px] text-muted-foreground border-y border-border bg-panel/40">
              <span className="flex items-center gap-1.5">
                <StatusDot status={status} />
                AMM spread · <span className="tabular text-foreground">{spread ? formatPrice(spread) : "..."}</span>
              </span>
              <span className="tabular">
                {status === "live" && lastUpdated
                  ? secondsAgo < 5
                    ? "just now"
                    : `${secondsAgo}s ago`
                  : status === "loading"
                    ? "updating…"
                    : "offline"}
              </span>
            </div>

            {(bids.length ? bids : placeholderRows("bid")).map((row, index) => (
              <BookRow key={`b-${row.price}-${index}`} row={row} side="bid" maxTotal={maxTotal} muted={!bids.length} />
            ))}
          </div>

          <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Synthetic AMM depth from pool liquidity, not centralized limit orders.
          </div>

          {isPerp && <ComingSoonOverlay />}
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-3 px-3 py-2 text-[11px] text-muted-foreground">
            <span>Price</span>
            <span className="text-right">Size ({sizeLabel})</span>
            <span className="text-right">Time</span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-y border-border bg-panel/40">
            <span className="flex items-center gap-1.5">
              <StatusDot status={status} />
              {status === "live" ? "Onchain swaps" : status === "loading" ? "Loading…" : "Offline"}
            </span>
            <span className="tabular">
              {status === "live" && lastUpdated
                ? secondsAgo < 5
                  ? "just now"
                  : `${secondsAgo}s ago`
                : status === "loading"
                  ? "updating…"
                  : ""}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {(trades.length ? trades : placeholderTrades()).map((trade, index) => (
              <TradeRowView key={`${trade.id}-${index}`} trade={trade} muted={!trades.length} />
            ))}
          </div>
          {isPerp && <ComingSoonOverlay />}
        </div>
      )}
    </div>
  );
}

function BookRow({
  row,
  side,
  maxTotal,
  muted,
}: {
  row: DexDepthRow;
  side: "ask" | "bid";
  maxTotal: number;
  muted?: boolean;
}) {
  const pct = Math.max(3, (row.total / maxTotal) * 100);
  const color = side === "ask" ? "text-bear" : "text-bull";
  const bg = side === "ask" ? "bg-bear/15" : "bg-bull/15";

  return (
    <div className={`relative grid grid-cols-3 px-3 py-[3px] text-xs tabular hover:bg-panel/60 ${muted ? "opacity-40" : ""}`}>
      <div className={`absolute right-0 top-0 bottom-0 ${bg}`} style={{ width: `${pct}%` }} />
      <span className={`${color} relative`}>{row.price ? formatPrice(row.price) : "..."}</span>
      <span className="text-right relative">{row.size ? formatSize(row.size) : "..."}</span>
      <span className="text-right relative">{row.total ? formatSize(row.total) : "..."}</span>
    </div>
  );
}

function TradeRowView({ trade, muted }: { trade: DexTrade; muted?: boolean }) {
  const color = trade.side === "buy" ? "text-bull" : "text-bear";

  return (
    <div className={`grid grid-cols-3 px-3 py-[3px] text-xs tabular hover:bg-panel/60 ${muted ? "opacity-40" : ""}`}>
      <span className={color}>{trade.priceUsd ? formatPrice(trade.priceUsd) : "..."}</span>
      <span className="text-right">{trade.size ? formatSize(trade.size) : "..."}</span>
      <span className="text-right text-muted-foreground">{trade.timestamp ? formatTime(trade.timestamp) : "..."}</span>
    </div>
  );
}

function StatusDot({ status }: { status: "loading" | "live" | "offline" }) {
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${
        status === "live" ? "bg-bull animate-pulse" : status === "loading" ? "bg-primary" : "bg-bear"
      }`}
    />
  );
}

function placeholderRows(side: "ask" | "bid"): DexDepthRow[] {
  return Array.from({ length: ROW_LIMIT }, (_, index) => ({
    price: 0,
    size: 0,
    total: side === "ask" ? ROW_LIMIT - index : index + 1,
    notionalUsd: 0,
  }));
}

function placeholderTrades(): DexTrade[] {
  return Array.from({ length: 36 }, (_, index) => ({
    id: `placeholder-${index}`,
    txHash: "",
    priceUsd: 0,
    size: 0,
    volumeUsd: 0,
    timestamp: "",
    side: index % 2 === 0 ? "buy" : "sell",
  }));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 1 ? 2 : 0,
    maximumFractionDigits: fractionDigitsForPrice(value),
  }).format(value);
}

function formatSize(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 5,
  }).format(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function fractionDigitsForPrice(value: number) {
  const absolute = Math.abs(value);

  if (absolute >= 1) return 2;
  if (absolute >= 0.01) return 4;
  if (absolute >= 0.0001) return 6;
  return 8;
}

function ComingSoonOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-sm bg-background/60">
      <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Coming Soon
      </span>
      <p className="max-w-[200px] text-center text-xs text-muted-foreground leading-relaxed">
        Perp market data is not publicly available yet
      </p>
    </div>
  );
}
