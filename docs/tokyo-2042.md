# Tokyo 2042 — The Fabrknt Universe

Single source of truth for the worldview shared by **Failsafe**, **Reactor**, and **Dojo**. All three surfaces live inside this universe; their copy, visuals, scenarios, and naming must be coherent with what is written here.

This file is canon. If a venue contradicts it, the venue is wrong.

(Eventually moves to a Fabrknt-level monorepo. Lives in `failsafe/docs/` until then.)

---

## 1 · Setting

The year is **2042**. **Tokyo** is a 12-million-person megalopolis where the financial system has been re-implemented on a stack of L1s and on-chain primitives. Money flows are visible. Risk is observable. The entire urban economy is one large distributed system that anyone with API access can watch in real time.

This is **not** dystopia. It is the next phase of capitalism — public financial infrastructure operated by private Megacorps under composable, auditable, open-source rules.

**Tone:** terse, neutral, Bloomberg-like. The world is *lived-in*, not *fantastical*. Avoid hype, avoid drama, avoid neon for neon's sake.

---

## 2 · The City

- **Population:** 12,000,000 citizens, ~3M active in financial markets daily
- **Total digital assets:** $1.20 trillion in on-chain value
- **Prime Brokers:** 4 Megacorps controlling institutional capital
- **DEX Venues:** 12 public retail venues
- **Insurance Fund cap:** $150M (consortium-funded, multi-Megacorp)
- **System Risk levels:** Low / Elevated / High / Critical

**Districts (lore color, surface optional):**

| District | Function |
|---|---|
| **Marunouchi Trading District** | Megacorp HQs, OTC desks, regulatory liaison floors |
| **Roppongi Vertical Markets** | 200-floor vertical mega-buildings of trading venues, one DEX per ~20 floors |
| **Shibuya Crossing 2.0** | Retail-facing fintech, the public face of the system |
| **Yokohama Edge Compute Zone** | Datacenters running the L1s; physical home of the engines |
| **Underground Markets** | Gray-zone permissionless venues; where Failsafe is rumored to actually run |

The KPI numbers in §2 are **canonical**. Any surface displaying these must match.

---

## 3 · The Financial Stack

Four layers, top to bottom:

1. **Retail Layer** — 12 DEXs serving 3M+ daily users
2. **Institutional Layer** — 4 Prime Brokers handling Megacorp flow
3. **Infrastructure Layer** — L1 execution engines (Fabrknt's products)
4. **Trust Layer** — Oracle Networks + Insurance Fund + audited Megacorp consortia

Stablecoins are the trade unit. Perpetuals dominate derivatives. Spot is still settled, but most volume is leveraged.

---

## 4 · Fabrknt — The Megacorp Behind the Stack

Fabrknt is a Megacorp **inside** the Tokyo 2042 universe, not outside it. It is a real commercial entity in our reality *and* a fictional Megacorp in the lore. This dual existence is the brand's central move.

| | |
|---|---|
| **Tagline** | Megacorp financial infrastructure for Tokyo 2042 |
| **Founded** | 2032 (a decade before "now") |
| **HQ** | Marunouchi, top floor of the Mitsubishi Mirror Tower |
| **Business** | Licenses L1 execution engines and DeFi primitive libraries to other Megacorps, DAOs, and sovereigns |
| **Public face** | Failsafe — the simulator that lets citizens see the system |
| **Voice** | Precise, technical, slightly cold, confident. Never breathless. |

Fabrknt does not operate the markets. Fabrknt builds the engines other Megacorps use to operate them.

---

## 5 · The Engine Portfolio

Fabrknt sells four engine product lines. Each is a real-world rdk-based codebase **and** a canonical product in the universe.

| Engine | Real-world repo | Universe positioning | Customer profile |
|---|---|---|---|
| **OpenHL** | `psyto/rdk` (openhl/) | Perpetual Market Reference Engine. Open-source, Photon-Foundation-audited. | New market makers spinning up a perp DEX. |
| **Princeps** | `psyto/rdk` (princeps/) | Prime Broker Engine. Cross-margin lending + perp + clearing under one risk engine. | Megacorp-grade institutional venues. |
| **Flux** *(working name)* | Solana-Perp engine, TBD | Solana-native perp engine for high-throughput retail. | Solana-native DEXs. |
| **Vector** *(working name)* | Solana-PB engine, TBD | Solana-native prime broker. | Solana institutional venues. |

The 4-engine portfolio is the literal Fabrknt product line and the in-universe Megacorp catalog at the same time.

---

## 6 · The Megacorp Prime Brokers (NPCs)

These are the 4 Prime Brokers featured in scenarios. They are *Fabrknt's customers*, not Fabrknt itself. Each runs one or more Fabrknt engines.

| Broker | Engine they run | Personality | Visual cue |
|---|---|---|---|
| **Tachi Capital** | Princeps | Agile, low-latency, leveraged. Old samurai metaphor, sharp. | Cyan |
| **Kintetsu Synth** | Princeps + OpenHL | Synthetic instruments specialist. Conservative haircuts. | Yellow |
| **Atlas Vector** | Vector (Solana) | Multi-chain vector-of-risk specialist; carries many positions across many ledgers. | Magenta |
| **Black Ice Markets** | OpenHL (forked) | High-frequency, cold-blooded, the wild card. Forks the engine. | Red (only visible during stress) |

In scenarios where "Prime Broker Alpha" / "Prime Broker Beta" appear, those are placeholders that will be replaced with these canonical names.

---

## 7 · The Oracle Network

**Photon Network** — multi-publisher signed price feed protocol.

- 5 major publishers contribute signed observations
- ECDSA-signed per-feed; deviation filter rejects outliers
- Governed by a multi-Megacorp consortium (Fabrknt is one of five seats)
- Failure mode: single publisher compromised → filter rejects → system unaffected
- This is the canonical "Failsafe in action" — the system fails safely by design

When scenarios say "Publisher #4 reports ETH = $99,999," that is Photon Network.

---

## 8 · The Insurance Fund

**The Backstop** — protocol-level absorption layer for liquidation deficits.

- Capacity: $150M
- Funded by Megacorp consortium fees
- Drains during cascades; replenishes from liquidation fees in calm periods
- When fully drawn → ADL (auto-deleveraging) triggers
- Status indicators: % of cap, $ drawn this cycle

The Insurance Fund is **part of the public infrastructure**, not Fabrknt's. Fabrknt's engines plug into it.

---

## 9 · The Three Venues (Surfaces)

The three Fabrknt surfaces are three *places* in Tokyo 2042 that the same person could walk into, each with a different role waiting for them.

### Failsafe — City Control Room
**Path:** `fabrknt.com/failsafe`
**Actor:** Citizen
**Question:** "What happens if X breaks?"
**What you do:** Trigger scenarios, watch the city react, share screenshots.
**Tone:** Curious, slightly anxious, marveling.
**Trigger button verb:** Trigger / Stage.
**Closing CTA:** "Compare how different Fabrknt engines handle this in Reactor ↗"

### Reactor — Engine Test Chamber
**Path:** `fabrknt.com/reactor`
**Actor:** Megacorp Executive
**Question:** "Which engine survives next Tuesday's stress test?"
**What you do:** Select engines (OpenHL / Princeps / Flux / Vector), run the same scenario across two of them in parallel, compare KPI deltas, export PDF for board approval, file license inquiry.
**Tone:** Measured, ROI-focused, slightly skeptical. Executive mode optional (strips lore for pure Bloomberg display).
**Closing CTA:** "Want to build your own? Start in Dojo ↗"

### Dojo — Engineer Training
**Path:** `fabrknt.com/dojo`
**Actor:** Apprentice Engineer
**Question:** "I want to know exactly how this liquidation works."
**What you do:** Run a Failsafe widget. Read the rdk source it called. Modify the primitive (e.g., change `liquidation_fee_bps`). Re-run. See the diff.
**Tone:** Building, patient, learning. The student-becomes-builder arc.
**Closing CTA:** "Take your build into Reactor to compare against canonical engines ↗"

The cross-CTAs form a closed loop: **Failsafe → Reactor → Dojo → Failsafe**.

---

## 10 · Canonical Scenarios

The Failsafe scenarios are canonical *events* in Tokyo 2042 history. They are referenced by name across all three venues.

### The Yield Spike of 2042-Q3 (scenario: `treasury_shock`)

Tokyo Fed announces unscheduled +3pp policy rate hike. Tokenized treasury collateral haircuts widen from 5% to 12% in minutes. ETH spot drags -11%. Three leveraged longs at Tachi Capital and Black Ice liquidate. Insurance Fund draws $63K.

### The USDC Reserve Audit Crisis of 2042-Q4 (scenario: `stablecoin_depeg`)

USDC issuer reserve audit flagged. AMM spreads widen. USDC depegs 6% in 90 seconds. Vault NAV impaired (share price 9,400 bps). Stablecoin-margined positions across Kintetsu and Daiwa liquidate. Insurance Fund fully drawn.

### The Publisher #4 Incident of 2042-Q1 (scenario: `oracle_attack`)

Photon Network Publisher #4 reports ETH = $99,999. Deviation filter rejects the outlier. Index settles at $2,001 from the remaining three honest feeds. **Zero liquidations. Insurance Fund untouched.** Canonical "Failsafe held" event — the prototype defense pattern that gave the simulator its name.

Future scenarios get the same treatment: a date, a Megacorp involved, a canonical outcome that matches the rdk math.

---

## 11 · Style Notes

### Voice

- Present tense ("the system is"), not future ("could be")
- Numbers over adjectives — "$63K drawn" over "a significant draw"
- Megacorp-named events over generic events — "The Yield Spike of 2042-Q3" over "a treasury shock"
- Short paragraphs. Long sentences are fine inside them.

### What we DON'T do

- No anime characters, no human illustrations, no stock photography
- No exclamation points in product copy
- No "amazing," "incredible," "revolutionary"
- No "imagine if" / "what if you could" hype framing — the universe is real, just show it
- No glorifying market crashes — the simulator is for understanding, not entertainment

### Loanwords

Japanese Megacorp / district names are encouraged (Tachi, Kintetsu, Daiwa, Marunouchi, Roppongi). Don't lean too hard — half the names are still English.

### Numbers

Canonical city stats from §2 must match across surfaces. If a scenario changes one (e.g., DIGITAL ASSETS drops during a cascade), the change must derive deterministically from the scenario events.

---

## 12 · Visual Canon (to be expanded in Phase 1 as `@failsafe/ui`)

- **Background:** Pure black (`#050507`)
- **Neon accents:** cyan `#00f0ff`, magenta `#ff00aa`, yellow `#facc15`, crit red `#ff3b3b`
- **Typography:** JetBrains Mono everywhere, uppercase tracking-widest for labels
- **Skyline:** isometric-ish, 4 buildings sized by broker, windows lit per status
- **Scanline overlay:** subtle, 2-pixel rhythm
- **Glow:** text-shadow on neon-colored text, never overpower

Detailed design tokens move into `@failsafe/ui` during Phase 1.

---

## 13 · What This Document Does NOT Cover

Deferred:
- Individual Megacorp CEOs / executives (named characters)
- Specific event timelines (full history beyond the 3 canonical scenarios)
- Detailed economics of the in-universe currency
- Legal / regulatory backdrop of Tokyo 2042
- Music / sound design canon

These get added as surfaces need them. Don't over-canonize at v0.

---

## Changelog

- **2026-06-14 v0.1** — initial canon. Failsafe shipped, Reactor + Dojo pending. Engine names: OpenHL ✓, Princeps ✓, Flux / Vector working names.
