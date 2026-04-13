# Feature Ideas — Effort Estimation & Implementation Plan

## 1. Personalised Chess Bot (Trained on User's Game History)

### Concept

A user clicks "Create My Bot" in the app. Their game history is used to fine-tune a chess model that mimics their playstyle. The bot is connected to a Lichess BOT account so anyone can challenge it.

### Is 18,000 Games Enough?

Short answer: **yes, probably — but with caveats.**

- **Maia Chess** (a human-like chess engine from Microsoft/Toronto) was trained on millions of Lichess games, but that was a *general* human-mimicry model across all players. For a *single player's style*, the approach would be to fine-tune an existing model (not train from scratch), which needs far fewer games.
- **Practical floor: ~2,000–5,000 games** should be enough to capture opening preferences, tactical tendencies, and time-management patterns when fine-tuning an existing model like Maia or a small transformer.
- **18,000 games is comfortably above that threshold.** You'd likely get a bot that recognisably plays "like you" — especially in openings and middlegame piece placement. Endgame play will likely regress toward the base model since endgame positions are more sparse per-player.
- **Quality matters more than quantity.** Filtering out bullet games (lots of premoves/mouse-slips) and focusing on rapid/classical would give a cleaner signal. Also filtering out very old games if the player's style has evolved.

### Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Bot Service     │─────▶│  Lichess    │
│  "Create    │      │  (ECS/Lambda)    │      │  BOT API    │
│   My Bot"   │      │                  │      │             │
└─────────────┘      │  - Training job  │      └─────────────┘
                     │  - Inference     │
                     │  - Lichess WS    │
                     └──────────────────┘
```

### Implementation Steps

| Step | Description | Effort |
|------|-------------|--------|
| **1. Research & Model Selection** | Evaluate Maia Chess, Leela Chess Zero (lc0), or a custom transformer. Maia is the most promising starting point for human-like play. Decide on fine-tuning approach. | 1–2 weeks |
| **2. Training Pipeline** | Build a pipeline that takes a user's PGN history, preprocesses it (filter time controls, normalise, extract board states + moves), and fine-tunes the base model. This likely runs on a GPU instance (p3/g4 on AWS or a dedicated GPU service). | 3–4 weeks |
| **3. Lichess BOT Account Automation** | Use the [Lichess BOT API](https://lichess.org/api#tag/Bot) to programmatically create and manage BOT accounts. Each user's bot gets its own Lichess BOT account. You'll need to handle OAuth tokens and account lifecycle. | 1–2 weeks |
| **4. Inference Service** | A long-running service (ECS Fargate or EC2) that connects to Lichess via WebSocket, receives challenges/game-state events, and responds with moves from the fine-tuned model. Must stay online 24/7 for the bot to be playable. | 2–3 weeks |
| **5. Frontend Tab & UI** | Add a "My Bot" tab to the app. Show bot creation status, link to challenge the bot on Lichess, bot stats, and a "retrain" button. | 1 week |
| **6. Infrastructure** | GPU training instances (spot instances to save cost), model artifact storage (S3), inference service (ECS), DynamoDB for bot metadata and user–bot mappings. | 1–2 weeks |

### Cost Considerations

- **Training:** A single user fine-tune on a g4dn.xlarge spot instance should take ~30 min–2 hrs depending on model. Cost: ~$0.50–2.00 per user.
- **Inference:** This is the expensive part. Each bot needs a running process connected to Lichess. Options:
  - **Always-on ECS task per bot:** expensive at scale (~$15–30/month per bot)
  - **Shared inference server:** one service handles multiple bots, routes moves to the right model. Much cheaper but more complex.
  - **Cold-start on challenge:** bot only spins up when challenged, shuts down after game. Adds latency but saves cost.
- **Lichess BOT accounts:** Free, but Lichess may have rate limits on account creation. Reach out to Lichess team if planning to create many.

### Total Effort: ~8–14 weeks for one developer

### Risk Level: High

This is the most ambitious of the three ideas. Key risks: model quality may not feel "personal" enough, GPU costs, keeping inference services running reliably, and Lichess API/account management edge cases.

---

## 2. AI Chess Coach (LLM-Powered Analysis Chat)

### Concept

An AI coach that reads the user's game history and analytics (openings, accuracy, time management, checkmate patterns — all the data already computed in your stats page) and provides personalised advice. Could be a one-shot summary paragraph or an interactive chatbot.

### Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Coach API       │─────▶│  Claude /   │
│  Chat UI    │      │  (Lambda)        │      │  OpenAI API │
└─────────────┘      │                  │      └─────────────┘
                     │  Builds prompt   │
                     │  from analytics  │
                     └──────────────────┘
```

### Implementation Steps

| Step | Description | Effort |
|------|-------------|--------|
| **1. Analytics Summary Builder** | Create a function that aggregates the user's stats into a structured text summary: opening repertoire, win rates by time control, checkmate patterns, rating trends, time management stats. You already compute most of this in `src/lib/analytics/`. | 2–3 days |
| **2. Prompt Engineering** | Design a system prompt that makes Claude (or another LLM) act as a chess coach. Feed it the analytics summary as context. Iterate on prompt quality. | 2–3 days |
| **3. Backend API** | A new Lambda endpoint (`/api/coach`) that receives the user's analytics payload, builds the prompt, calls the LLM API, and streams the response back. Use streaming for good UX. | 3–5 days |
| **4. Chat UI** | Add a "Coach" tab or panel. Two modes: (a) one-click "Get Advice" that returns a paragraph, (b) chat interface for follow-up questions. Use streaming to show the response as it generates. | 3–5 days |
| **5. Game-Specific Analysis** | Allow the user to ask the coach about a specific game. Send the PGN + the coach's general knowledge of the player's tendencies. "Why did I lose this game?" / "What should I have played instead?" | 2–3 days |
| **6. Context Window Management** | 18,000 games won't fit in a single prompt. Strategies: send aggregated stats (not raw games), or let the user select a time range. For game-specific questions, send just that game's PGN + overall stats summary. | 1–2 days |

### Cost Considerations

- **LLM API costs:** A coaching response with a ~2K token analytics summary + ~500 token response ≈ $0.01–0.05 per request (Claude Sonnet). Very cheap.
- **Infrastructure:** Reuses existing Lambda + CloudFront setup. Minimal additional cost.
- **No GPU needed.** This is pure API consumption.

### Total Effort: ~2–3 weeks for one developer

### Risk Level: Low

This builds on infrastructure and data you already have. The main risk is prompt quality — making the coach's advice genuinely useful rather than generic. Iterating on prompts with real user data will be key.

### Recommendation

**Start here.** This is the highest value-to-effort ratio of the three ideas. You already compute the analytics; you're essentially putting a natural-language interface on top of data that exists.

---

## 3. Stockfish-Powered Deep Analytics (Accuracy, Position Eval, etc.)

### Concept

Run Stockfish analysis on user games to provide per-move evaluations, accuracy scores, blunder/mistake/inaccuracy counts, and position evaluation graphs — similar to what Lichess and Chess.com show in their game analysis.

### The Scale Problem

You're right that querying an external Stockfish API for 18,000 games is impractical:
- Each game averages ~40 moves = ~80 positions to evaluate
- 18,000 games × 80 positions = **1,440,000 Stockfish evaluations**
- At ~0.5–1 second per position (depth 20), that's **8–17 days of continuous CPU time** for a single user's full history
- External APIs would cost a fortune and be painfully slow

### Strategy: Analyse On-Demand + Cache Results

Don't analyse all 18,000 games upfront. Instead:
1. **On-demand:** Analyse a game when the user clicks "Analyse" on it
2. **Background batch:** Optionally let users queue their last N games for batch analysis
3. **Cache everything:** Store analysis results in DynamoDB so each game is only analysed once

### Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Frontend   │─────▶│  Analysis API    │─────▶│  Stockfish  │
│  "Analyse"  │      │  (Lambda/ECS)    │      │  Worker     │
│  button     │      └──────────────────┘      │  (ECS/EC2)  │
└─────────────┘               │                └─────────────┘
                              │
                     ┌────────▼─────────┐
                     │  DynamoDB Cache   │
                     │  (analysis results│
                     └──────────────────┘
```

### Implementation Steps

| Step | Description | Effort |
|------|-------------|--------|
| **1. Stockfish Worker Service** | Deploy Stockfish as a service on ECS (or a dedicated EC2 instance). Use the Stockfish WASM build for Lambda if you want serverless, but native binary on ECS will be much faster. Expose an internal API that accepts a FEN and returns eval + best line. | 1–2 weeks |
| **2. Game Analysis Pipeline** | A function that takes a PGN, replays it move-by-move, sends each position to Stockfish, and computes: centipawn loss per move, accuracy %, blunders/mistakes/inaccuracies classification, and eval graph data. | 1–2 weeks |
| **3. Results Cache** | DynamoDB table keyed by game ID. Store the full analysis result (per-move evals, accuracy, classifications). Check cache before running Stockfish. | 2–3 days |
| **4. API Endpoint** | `/api/analyse` endpoint. Accepts a game ID or PGN, checks cache, runs analysis if needed, returns results. Support both sync (single game, wait for result) and async (batch, poll for completion). | 1 week |
| **5. Frontend — Single Game Analysis** | In the game replay modal, add an "Analyse" button. Show: eval bar, move classifications (green/yellow/red), accuracy score, best move arrows. This is a significant UI effort. | 2–3 weeks |
| **6. Frontend — Aggregate Stats** | On the stats page, show aggregate accuracy over time, most common mistake types, positions where the user struggles. Requires batch analysis of enough games to be meaningful. | 1–2 weeks |
| **7. Background Batch Processing** | SQS queue + worker that processes analysis jobs in the background. Let users queue "analyse my last 100 games" and notify when done. | 1 week |

### Cost Considerations

- **ECS Stockfish worker:** A c5.xlarge (~$0.085/hr) can analyse ~3,600 positions/hour at depth 20. One game ≈ 80 positions ≈ ~80 seconds. Cost per game: ~$0.002.
- **DynamoDB:** Negligible for cached results (a few KB per game).
- **At scale:** Analysing 100 games ≈ $0.20 and ~2.2 hours. Analysing all 18,000 ≈ $36 and ~17 days (on one instance). Could parallelise with multiple workers.
- **Alternative — Stockfish WASM in browser:** Run Stockfish client-side in a Web Worker. Zero server cost, but slower (browser single-threaded WASM) and ties up the user's machine. Many chess sites do this for single-game analysis. Could be a good V1 before investing in server-side infrastructure.

### Total Effort: ~7–11 weeks for one developer

### Risk Level: Medium

The Stockfish integration itself is well-understood (many open-source examples). The risks are in the scale of the UI work (eval bars, move annotations, accuracy graphs) and in managing analysis queue/costs at scale.

---

## Summary Comparison

| Feature | Effort | Cost (infra) | Risk | User Value | Recommendation |
|---------|--------|-------------|------|------------|----------------|
| **AI Chess Coach** | 2–3 weeks | Very low ($) | Low | High | **Do first** |
| **Stockfish Analytics** | 7–11 weeks | Medium ($$) | Medium | High | Do second |
| **Personal Chess Bot** | 8–14 weeks | High ($$$) | High | Medium-High | Do third (or as a passion project) |

### Suggested Roadmap

1. **Phase 1 (weeks 1–3):** AI Chess Coach — quick win, builds on existing analytics
2. **Phase 2 (weeks 4–7):** Stockfish single-game analysis (browser WASM as V1, server-side later)
3. **Phase 3 (weeks 8–11):** Stockfish aggregate stats + batch processing
4. **Phase 4 (weeks 12+):** Personal Chess Bot — the moonshot
