"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { explain, getScript, SCENARIOS, type ScenarioId } from "@/lib/scenario";
import type { EventWithId, SimEvent, SystemRisk } from "@/lib/types";

const SIM_URL = process.env.NEXT_PUBLIC_SIM_URL || "http://localhost:7777";
type Mode = "live" | "demo" | "unknown";

const INITIAL_KPIS = {
  population: "12,000,000",
  digitalAssetsUsd: 1_200_000_000_000,
  primeBrokers: 4,
  dexs: 12,
  risk: "Low" as SystemRisk,
  insuranceFundUsd: 150_000_000,
  insuranceFundCapUsd: 150_000_000,
};

const RISK_STYLE: Record<SystemRisk, { label: string; cls: string; glow: string }> = {
  Low: { label: "LOW", cls: "text-[var(--color-ok)]", glow: "" },
  Elevated: { label: "ELEVATED", cls: "text-[var(--color-yellow)]", glow: "glow-cyan" },
  High: { label: "HIGH", cls: "text-[var(--color-magenta)]", glow: "glow-magenta" },
  Critical: { label: "CRITICAL", cls: "text-[var(--color-crit)]", glow: "glow-crit" },
};

function formatUsd(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function eventColor(ev: SimEvent): string {
  switch (ev.kind) {
    case "OracleUpdate":
      return "text-[var(--color-cyan)]";
    case "MarketEvent":
      return "text-[var(--color-yellow)]";
    case "BrokerAlert":
      return ev.severity === "Crit"
        ? "text-[var(--color-crit)]"
        : "text-[var(--color-magenta)]";
    case "Liquidation":
      return "text-[var(--color-crit)]";
    case "Insurance":
      return "text-[var(--color-magenta)]";
    case "System":
      return RISK_STYLE[ev.risk].cls;
  }
}

function eventLabel(ev: SimEvent): string {
  switch (ev.kind) {
    case "OracleUpdate":
      return `ORACLE · ${ev.symbol}  ${ev.prev.toFixed(2)}% → ${ev.next.toFixed(2)}%`;
    case "MarketEvent":
      return `MARKET · ${ev.title}`;
    case "BrokerAlert":
      return `${ev.severity.toUpperCase()} · ${ev.broker} · ${ev.title}`;
    case "Liquidation":
      return `LIQ · ${ev.position_id} · ${formatUsd(ev.notional_usd)} @ $${ev.price.toFixed(2)} (${ev.method})`;
    case "Insurance":
      return `INSURANCE · drew ${formatUsd(ev.drawn_usd)} · balance ${formatUsd(ev.balance_usd)}`;
    case "System":
      return `SYSTEM · risk ${RISK_STYLE[ev.risk].label} · ${ev.message}`;
  }
}

export default function Page() {
  const [events, setEvents] = useState<EventWithId[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<EventWithId | null>(null);
  const [kpis, setKpis] = useState(INITIAL_KPIS);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState<Mode>("unknown");
  const [speed, setSpeed] = useState(1);
  const [scenario, setScenario] = useState<ScenarioId>("treasury_shock");
  const [dials, setDials] = useState({
    volatility: 0.11,
    leverage: 10,
    collateral_ratio: 0.02,
  });
  const idRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    fetch(`${SIM_URL}/api/health`, { signal: ctrl.signal })
      .then((r) => {
        if (active) setMode(r.ok ? "live" : "demo");
      })
      .catch(() => {
        if (active) setMode("demo");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      ctrl.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  function reset() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    idRef.current = 0;
    autoFollowRef.current = true;
    setEvents([]);
    setKpis(INITIAL_KPIS);
    setSelected(null);
    setRunning(false);
    setDone(false);
    setElapsed(0);
  }

  function pushEvent(raw: SimEvent) {
    const withId: EventWithId = { ...raw, id: idRef.current++ };
    setEvents((prev) => [...prev, withId]);
    applyEvent(withId);
    if (autoFollowRef.current) {
      setSelected(withId);
    }
  }

  function selectEvent(ev: EventWithId | null) {
    autoFollowRef.current = false;
    setSelected(ev);
  }

  function finishRun() {
    setRunning(false);
    setDone(true);
    if (tickerRef.current) clearInterval(tickerRef.current);
  }

  function trigger() {
    if (running) return;
    reset();
    setRunning(true);
    const start = performance.now();
    tickerRef.current = setInterval(() => {
      setElapsed(performance.now() - start);
    }, 50);

    requestAnimationFrame(() => {
      timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    if (mode === "live") {
      runLive();
    } else {
      runScripted();
    }
  }

  function runLive() {
    const wsUrl = SIM_URL.replace(/^http/, "ws") + "/api/events";
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      runScripted();
      return;
    }
    wsRef.current = ws;
    let gotAny = false;
    const fallback = setTimeout(() => {
      if (!gotAny) {
        ws.close();
        wsRef.current = null;
        setMode("demo");
        runScripted();
      }
    }, 1500);
    timersRef.current.push(fallback);

    ws.onopen = () => {
      fetch(`${SIM_URL}/api/scenario/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: scenario, speed, dials }),
      }).catch(() => {});
    };

    ws.onmessage = (e) => {
      gotAny = true;
      try {
        const raw = JSON.parse(e.data) as SimEvent;
        pushEvent(raw);
        if (raw.kind === "System" && raw.risk === "Critical") {
          const t = setTimeout(() => {
            finishRun();
            ws.close();
            wsRef.current = null;
          }, 500);
          timersRef.current.push(t);
        }
      } catch {}
    };

    ws.onerror = () => {
      if (!gotAny) {
        setMode("demo");
        runScripted();
      }
    };
  }

  function runScripted() {
    const script = getScript(scenario);
    script.forEach((ev) => {
      const realT = ev.t_ms / speed;
      const t = setTimeout(
        () => pushEvent({ ...ev, t_ms: Math.round(realT) }),
        realT,
      );
      timersRef.current.push(t);
    });
    const last = script[script.length - 1];
    const finish = setTimeout(finishRun, last.t_ms / speed + 600);
    timersRef.current.push(finish);
  }

  function applyEvent(ev: EventWithId) {
    setKpis((k) => {
      const next = { ...k };
      if (ev.kind === "System") next.risk = ev.risk;
      if (ev.kind === "Insurance") next.insuranceFundUsd = ev.balance_usd;
      if (ev.kind === "BrokerAlert" && ev.severity === "Crit") {
        next.primeBrokers = Math.max(0, k.primeBrokers - 0);
      }
      return next;
    });
  }

  const riskStyle = RISK_STYLE[kpis.risk];

  return (
    <main className="min-h-screen relative grid-bg">
      <StatusBar elapsed={elapsed} running={running} done={done} mode={mode} />

      <section className="relative z-10 px-6 pt-12 pb-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[0.95]">
            <span className="block glow-cyan text-[var(--color-cyan)]">
              Break the financial system.
            </span>
            <span className="block glow-magenta text-[var(--color-magenta)]">
              Safely.
            </span>
          </h1>
          <p className="mt-4 text-sm text-[var(--color-fg)]/70 max-w-2xl">
            Run digital markets. Trigger failures. Understand why they happen.
            A live sandbox of a cyberpunk-era financial system, driven by a real
            DeFi L1 engine.
          </p>
        </div>
      </section>

      <section
        ref={timelineRef}
        className="relative z-10 px-6 pb-6 max-w-7xl mx-auto scroll-mt-12"
      >
        <TriggerBar
          running={running}
          done={done}
          scenario={scenario}
          onTrigger={trigger}
          onReset={reset}
        />

        <div className="mt-4 space-y-3">
          <CitySkyline events={events} />
          <KpiGrid kpis={kpis} riskStyle={riskStyle} />
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Timeline
            events={events}
            selected={selected}
            onSelect={selectEvent}
            autoFollowing={autoFollowRef.current && (running || done)}
          />
          <DetailPanel
            selected={selected}
            autoFollowing={autoFollowRef.current && running}
          />
        </div>
      </section>

      <section className="relative z-10 px-6 pb-12 max-w-7xl mx-auto border-t border-[var(--color-grid)] pt-6">
        <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/40 mb-3">
          Configure
        </div>
        <div className="space-y-3">
          <ScenarioPicker
            scenario={scenario}
            onChange={setScenario}
            disabled={running}
          />
          <ControlsRow
            speed={speed}
            onSpeedChange={setSpeed}
            scenario={scenario}
            mode={mode}
            dials={dials}
            onDialsChange={setDials}
            disabled={running}
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}

function StatusBar({
  elapsed,
  running,
  done,
  mode,
}: {
  elapsed: number;
  running: boolean;
  done: boolean;
  mode: Mode;
}) {
  const status = running ? "CASCADE LIVE" : done ? "CASCADE CONTAINED" : "STANDBY";
  const statusCls = running
    ? "text-[var(--color-crit)] glow-crit"
    : done
    ? "text-[var(--color-magenta)] glow-magenta"
    : "text-[var(--color-cyan)] glow-cyan";
  const modeBadge =
    mode === "live"
      ? { label: "LIVE rdk", cls: "text-[var(--color-cyan)] border-[var(--color-cyan)]/50" }
      : mode === "demo"
      ? { label: "DEMO", cls: "text-[var(--color-fg)]/50 border-[var(--color-grid)]" }
      : { label: "…", cls: "text-[var(--color-fg)]/30 border-[var(--color-grid)]" };
  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-black/60 border-b border-[var(--color-grid)]">
      <div className="max-w-6xl mx-auto px-6 h-10 flex items-center justify-between text-[11px] tracking-widest uppercase">
        <div className="flex items-center gap-3">
          <span className="text-[var(--color-cyan)] glow-cyan font-bold">FAILSAFE</span>
          <span className="text-[var(--color-fg)]/40">·</span>
          <span className="text-[var(--color-fg)]/70">
            Digital Finance Crisis Simulator
          </span>
          <span className="text-[var(--color-fg)]/40">v0.1</span>
          <span className={`ml-1 px-1.5 py-0.5 border text-[10px] tracking-widest ${modeBadge.cls}`}>
            {modeBadge.label}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[var(--color-fg)]/50">
            T+{(elapsed / 1000).toFixed(2)}s
          </span>
          <span className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              running ? "bg-[var(--color-crit)]" : done ? "bg-[var(--color-magenta)]" : "bg-[var(--color-cyan)]"
            } pulse-dot`} />
            <span className={statusCls}>{status}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function CityHeader() {
  return (
    <div className="mb-6 flex items-end justify-between border-b border-[var(--color-grid)] pb-3">
      <div>
        <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
          Jurisdiction
        </div>
        <div className="text-2xl font-bold tracking-tight">
          TOKYO <span className="text-[var(--color-cyan)] glow-cyan">2042</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
          Engine
        </div>
        <div className="text-xs text-[var(--color-fg)]/80">
          rdk · CLOB · Oracle · Liquidation · Insurance
        </div>
      </div>
    </div>
  );
}

type BrokerStatus = "healthy" | "warn" | "crit" | "liq";

const BROKERS: { name: string; x: number; w: number; h: number; windows: [number, number] }[] = [
  { name: "Prime Broker Alpha", x: 60, w: 110, h: 170, windows: [4, 7] },
  { name: "Prime Broker Beta", x: 200, w: 130, h: 200, windows: [5, 8] },
  { name: "Prime Broker Gamma", x: 360, w: 90, h: 140, windows: [3, 6] },
  { name: "Prime Broker Delta", x: 480, w: 120, h: 220, windows: [4, 9] },
];

function statusColor(s: BrokerStatus) {
  switch (s) {
    case "healthy": return { stroke: "var(--color-cyan)", fill: "rgba(0,240,255,0.06)", win: "var(--color-cyan)" };
    case "warn":    return { stroke: "var(--color-yellow)", fill: "rgba(250,204,21,0.08)", win: "var(--color-yellow)" };
    case "crit":    return { stroke: "var(--color-magenta)", fill: "rgba(255,0,170,0.10)", win: "var(--color-magenta)" };
    case "liq":     return { stroke: "var(--color-crit)", fill: "rgba(255,59,59,0.18)", win: "var(--color-crit)" };
  }
}

function CitySkyline({ events }: { events: EventWithId[] }) {
  const statuses = useMemo(() => {
    const map = new Map<string, BrokerStatus>();
    for (const b of BROKERS) map.set(b.name, "healthy");
    let lastLiqAt = 0;
    for (const ev of events) {
      if (ev.kind === "BrokerAlert") {
        const cur = map.get(ev.broker) ?? "healthy";
        if (ev.severity === "Crit") map.set(ev.broker, "crit");
        else if (ev.severity === "Warn" && cur === "healthy") map.set(ev.broker, "warn");
      }
      if (ev.kind === "Liquidation") {
        map.set(ev.broker, "liq");
        lastLiqAt = ev.t_ms;
      }
    }
    return { map, lastLiqAt };
  }, [events]);

  return (
    <div className="mb-6 border border-[var(--color-grid)] bg-[var(--color-bg-panel)]/40 p-3">
      <div className="flex items-center justify-between mb-2 text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
        <span>City Map · Tokyo Financial District</span>
        <span className="text-[var(--color-fg)]/30">{BROKERS.length} prime brokers</span>
      </div>
      <svg viewBox="0 0 660 260" className="w-full h-24 md:h-32">
        <defs>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,240,255,0.15)" />
            <stop offset="100%" stopColor="rgba(0,240,255,0)" />
          </linearGradient>
        </defs>
        <line x1="0" y1="244" x2="660" y2="244" stroke="var(--color-grid)" strokeWidth="1" />
        <rect x="0" y="244" width="660" height="16" fill="url(#ground)" />
        {BROKERS.map((b) => {
          const status = statuses.map.get(b.name) ?? "healthy";
          const c = statusColor(status);
          const top = 244 - b.h;
          const winRows = b.windows[1];
          const winCols = b.windows[0];
          const padX = 12;
          const padY = 16;
          const cellW = (b.w - padX * 2) / winCols;
          const cellH = (b.h - padY * 2) / winRows;
          const winW = cellW * 0.55;
          const winH = cellH * 0.45;
          const isLiq = status === "liq";
          return (
            <g key={b.name} className={isLiq ? "flicker" : ""}>
              <rect
                x={b.x}
                y={top}
                width={b.w}
                height={b.h}
                fill={c.fill}
                stroke={c.stroke}
                strokeWidth="1.5"
              />
              {Array.from({ length: winRows }).flatMap((_, row) =>
                Array.from({ length: winCols }).map((_, col) => {
                  const dim = (row + col) % 3 === 0 && status === "healthy";
                  return (
                    <rect
                      key={`${row}-${col}`}
                      x={b.x + padX + col * cellW + (cellW - winW) / 2}
                      y={top + padY + row * cellH + (cellH - winH) / 2}
                      width={winW}
                      height={winH}
                      fill={c.win}
                      opacity={dim ? 0.25 : 0.7}
                    />
                  );
                })
              )}
              <text
                x={b.x + b.w / 2}
                y={252}
                textAnchor="middle"
                fontSize="8"
                fontFamily="JetBrains Mono, monospace"
                fill={c.stroke}
                letterSpacing="2"
              >
                {b.name.split(" ")[2].toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function KpiGrid({
  kpis,
  riskStyle,
}: {
  kpis: typeof INITIAL_KPIS;
  riskStyle: { label: string; cls: string; glow: string };
}) {
  const fundPct = (kpis.insuranceFundUsd / kpis.insuranceFundCapUsd) * 100;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      <Tile label="POPULATION" value={kpis.population} />
      <Tile label="DIGITAL ASSETS" value={formatUsd(kpis.digitalAssetsUsd)} accent="cyan" />
      <Tile label="PRIME BROKERS" value={String(kpis.primeBrokers)} />
      <Tile label="DEX VENUES" value={String(kpis.dexs)} />
      <Tile
        label="INSURANCE FUND"
        value={formatUsd(kpis.insuranceFundUsd)}
        sub={`${fundPct.toFixed(0)}% of cap`}
        accent={fundPct < 100 ? "magenta" : "cyan"}
      />
      <Tile
        label="SYSTEM RISK"
        value={riskStyle.label}
        valueCls={`${riskStyle.cls} ${riskStyle.glow}`}
        accent={kpis.risk === "Critical" ? "crit" : kpis.risk === "Low" ? "cyan" : "magenta"}
      />
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  valueCls,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  valueCls?: string;
  accent?: "default" | "cyan" | "magenta" | "crit";
}) {
  const [flash, setFlash] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 500);
      return () => clearTimeout(t);
    }
  }, [value]);
  const border =
    accent === "cyan"
      ? "border-glow-cyan"
      : accent === "crit"
      ? "border-glow-crit"
      : accent === "magenta"
      ? "border border-[var(--color-magenta)]/40"
      : "border border-[var(--color-grid)]";
  return (
    <div className={`p-4 bg-[var(--color-bg-panel)]/60 transition-colors ${border} ${flash ? "tile-flash" : ""}`}>
      <div className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-fg)]/50">
        {label}
      </div>
      <div
        key={value}
        className={`mt-1 text-xl font-bold tracking-tight fade-in-up ${valueCls ?? ""}`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[10px] text-[var(--color-fg)]/40">{sub}</div>
      )}
    </div>
  );
}

type Dials = {
  volatility: number;
  leverage: number;
  collateral_ratio: number;
};

const DIAL_DEFAULTS: Dials = {
  volatility: 0.11,
  leverage: 10,
  collateral_ratio: 0.02,
};

function ControlsRow({
  speed,
  onSpeedChange,
  scenario,
  mode,
  dials,
  onDialsChange,
  disabled,
}: {
  speed: number;
  onSpeedChange: (s: number) => void;
  scenario: ScenarioId;
  mode: Mode;
  dials: Dials;
  onDialsChange: (d: Dials) => void;
  disabled: boolean;
}) {
  const ignored = scenario === "oracle_attack";
  const demoOnly = mode === "demo";
  const dialsDisabled = disabled || ignored;
  const noteText = ignored
    ? "Oracle Attack tests deviation filter only — dials do not apply."
    : demoOnly
    ? "Dials affect live rdk runs. DEMO mode replays a fixed script."
    : null;
  return (
    <div className="border border-[var(--color-grid)] bg-[var(--color-bg-panel)]/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <SpeedToggle speed={speed} onSpeedChange={onSpeedChange} disabled={disabled} />
        <div className="h-6 w-px bg-[var(--color-grid)] hidden lg:block" />
        <CompactDial
          label="VOL"
          value={dials.volatility}
          min={0.01}
          max={0.30}
          step={0.005}
          format={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={(v) => onDialsChange({ ...dials, volatility: v })}
          disabled={dialsDisabled}
        />
        <CompactDial
          label="LEV"
          value={dials.leverage}
          min={2}
          max={50}
          step={1}
          format={(v) => `${v.toFixed(0)}x`}
          onChange={(v) => onDialsChange({ ...dials, leverage: v })}
          disabled={dialsDisabled}
        />
        <CompactDial
          label="MM"
          value={dials.collateral_ratio}
          min={0.001}
          max={0.10}
          step={0.001}
          format={(v) => `${(v * 100).toFixed(2)}%`}
          onChange={(v) => onDialsChange({ ...dials, collateral_ratio: v })}
          disabled={dialsDisabled}
        />
        <button
          onClick={() => onDialsChange(DIAL_DEFAULTS)}
          disabled={disabled}
          className="ml-auto text-[10px] tracking-widest uppercase text-[var(--color-fg)]/40 hover:text-[var(--color-fg)] disabled:opacity-30"
        >
          Reset dials
        </button>
      </div>
      {noteText && (
        <div className="mt-2 text-[10px] tracking-widest uppercase text-[var(--color-fg)]/40">
          {noteText}
        </div>
      )}
    </div>
  );
}

function CompactDial({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--color-fg)]/50">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-24 md:w-32 accent-[var(--color-cyan)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      />
      <span className="text-[11px] tabular-nums text-[var(--color-cyan)] glow-cyan w-14 text-right">
        {format(value)}
      </span>
    </div>
  );
}

function ScenarioPicker({
  scenario,
  onChange,
  disabled,
}: {
  scenario: ScenarioId;
  onChange: (id: ScenarioId) => void;
  disabled: boolean;
}) {
  const active = SCENARIOS.find((s) => s.id === scenario)!;
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {SCENARIOS.map((s) => {
          const sel = s.id === scenario;
          return (
            <button
              key={s.id}
              onClick={() => onChange(s.id)}
              disabled={disabled}
              className={`text-left px-4 py-3 transition border
                ${sel
                  ? "border-[var(--color-cyan)]/60 bg-[var(--color-cyan)]/5"
                  : "border-[var(--color-grid)] hover:border-[var(--color-fg)]/30"}
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <div className={`text-xs tracking-[0.2em] uppercase font-bold ${sel ? "text-[var(--color-cyan)] glow-cyan" : "text-[var(--color-fg)]/80"}`}>
                {s.label}
              </div>
              <div className="mt-1 text-[10px] text-[var(--color-fg)]/40 leading-snug">
                {s.tagline}
              </div>
            </button>
          );
        })}
      </div>
      <div className="sr-only">Selected: {active.label}</div>
    </div>
  );
}

function TriggerBar({
  running,
  done,
  scenario,
  onTrigger,
  onReset,
}: {
  running: boolean;
  done: boolean;
  scenario: ScenarioId;
  onTrigger: () => void;
  onReset: () => void;
}) {
  const meta = SCENARIOS.find((s) => s.id === scenario)!;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onTrigger}
        disabled={running}
        className={`group relative px-10 py-5 tracking-[0.25em] uppercase text-base font-bold transition
          ${running
            ? "border border-[var(--color-grid)] text-[var(--color-fg)]/40 cursor-not-allowed"
            : "border-glow-cyan text-[var(--color-cyan)] hover:bg-[var(--color-cyan)] hover:text-black"}`}
      >
        ▶ {meta.verb} {meta.label}
      </button>
      {(running || done) && (
        <button
          onClick={onReset}
          className="px-5 py-3 text-xs tracking-widest uppercase text-[var(--color-fg)]/60 hover:text-[var(--color-fg)] border border-[var(--color-grid)] hover:border-[var(--color-fg)]/30"
        >
          Reset
        </button>
      )}
      <div className="text-[10px] tracking-widest uppercase text-[var(--color-fg)]/40 ml-auto">
        {meta.tagline}
      </div>
    </div>
  );
}

const SPEED_PRESETS = [0.5, 1, 2] as const;

function SpeedToggle({
  speed,
  onSpeedChange,
  disabled,
}: {
  speed: number;
  onSpeedChange: (s: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/40">
        Speed
      </span>
      <div className="flex">
        {SPEED_PRESETS.map((p) => {
          const active = p === speed;
          return (
            <button
              key={p}
              onClick={() => onSpeedChange(p)}
              disabled={disabled}
              className={`px-3 py-2 text-[11px] tracking-widest font-bold transition border-y border-r first:border-l first:rounded-l-sm last:rounded-r-sm
                ${active
                  ? "border-[var(--color-cyan)]/60 text-[var(--color-cyan)] glow-cyan bg-[var(--color-cyan)]/5"
                  : "border-[var(--color-grid)] text-[var(--color-fg)]/50 hover:text-[var(--color-fg)] hover:border-[var(--color-fg)]/30"}
                ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {p}x
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Timeline({
  events,
  selected,
  onSelect,
  autoFollowing,
}: {
  events: EventWithId[];
  selected: EventWithId | null;
  onSelect: (ev: EventWithId | null) => void;
  autoFollowing: boolean;
}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    if (autoFollowing && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events.length, autoFollowing]);
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--color-grid)] pb-2 mb-3">
        <div className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
          <span>Event Timeline</span>
          {autoFollowing && (
            <span className="text-[var(--color-cyan)] glow-cyan tracking-widest">
              · auto-following
            </span>
          )}
        </div>
        <div className="text-[10px] tracking-widest uppercase text-[var(--color-fg)]/40">
          {events.length} events
        </div>
      </div>
      {events.length === 0 ? (
        <div className="px-4 py-10 border border-dashed border-[var(--color-grid)] text-center text-[var(--color-fg)]/30 text-sm">
          No events. Trigger a market shock to begin.
        </div>
      ) : (
        <ol ref={listRef} className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
          {events.map((ev) => {
            const isSel = selected?.id === ev.id;
            return (
              <li key={ev.id} className="fade-in-up">
                <button
                  onClick={() => onSelect(isSel ? null : ev)}
                  className={`w-full text-left px-3 py-2 border flex items-center gap-3 transition
                    ${isSel
                      ? "border-[var(--color-cyan)]/60 bg-[var(--color-cyan)]/5"
                      : "border-[var(--color-grid)] hover:border-[var(--color-fg)]/30 hover:bg-white/[0.02]"}`}
                >
                  <span className="w-16 text-[10px] tabular-nums text-[var(--color-fg)]/40">
                    T+{(ev.t_ms / 1000).toFixed(2)}s
                  </span>
                  <span className={`flex-1 text-xs ${eventColor(ev)}`}>
                    {eventLabel(ev)}
                  </span>
                  <span className="text-[10px] tracking-widest uppercase text-[var(--color-fg)]/30">
                    {isSel ? "−" : "why?"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function DetailPanel({
  selected,
  autoFollowing,
}: {
  selected: EventWithId | null;
  autoFollowing: boolean;
}) {
  const e = selected ? explain(selected) : null;
  return (
    <aside>
      <div className="flex items-center justify-between border-b border-[var(--color-grid)] pb-2 mb-3">
        <div className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
          <span>Why did this happen?</span>
          {autoFollowing && (
            <span className="text-[var(--color-cyan)] glow-cyan tracking-widest">
              · live
            </span>
          )}
        </div>
      </div>
      {!selected || !e ? (
        <div className="px-4 py-12 border border-dashed border-[var(--color-grid)] text-center text-[var(--color-fg)]/30 text-sm">
          Click any event in the timeline.
        </div>
      ) : (
        <div className="p-5 bg-[var(--color-bg-panel)]/60 border border-[var(--color-grid)] space-y-4 fade-in-up">
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
              Summary
            </div>
            <p className="mt-1 text-sm text-[var(--color-fg)]/85 leading-relaxed">
              {e.summary}
            </p>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
              Cause
            </div>
            <p className="mt-1 text-sm text-[var(--color-fg)]/85 leading-relaxed">
              {e.cause}
            </p>
          </div>
          <div className="pt-3 border-t border-[var(--color-grid)]">
            <div className="text-[10px] tracking-[0.3em] uppercase text-[var(--color-fg)]/50">
              Implementation
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <code className="text-xs text-[var(--color-cyan)] glow-cyan">
                {e.impl.crate}::{e.impl.symbol}
              </code>
              <span className="text-[11px] text-[var(--color-fg)]/40">
                {e.impl.path}
              </span>
            </div>
            <button
              className="mt-3 px-3 py-2 text-[10px] tracking-widest uppercase text-[var(--color-fg)]/70 border border-[var(--color-grid)] hover:border-[var(--color-cyan)]/50 hover:text-[var(--color-cyan)]"
              onClick={() => {
                navigator.clipboard?.writeText(e.impl.path);
              }}
            >
              Copy path
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--color-grid)] py-6 px-6">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-[10px] tracking-widest uppercase text-[var(--color-fg)]/40">
        <div>FAILSAFE · v0.1</div>
        <div>Driven by rdk — Reth DeFi Kit</div>
        <div>Not a market. A simulator.</div>
      </div>
    </footer>
  );
}
