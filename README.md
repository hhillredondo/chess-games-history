# Chess games history

A web app for looking through your own chess games. Give it a Chess.com or
Lichess username and it pulls the game archive, then works out things like which
openings you actually win with, how your accuracy holds up when the clock gets
low, and how your games tend to end. There is also a coach panel that will talk
through the numbers with you, backed by Claude.

Built with React and Vite. The game data comes straight from the public
Chess.com and Lichess APIs.

## Running it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

That serves the app on http://localhost:3000. Fetching and analysing games works
straight away, since Vite runs the same handlers locally that run as Lambdas in
production.

The coach panel is the one thing that needs setting up. It calls the Anthropic
API, so give it a key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Without the key everything else still works, and the coach panel just tells you
the key is missing.

## Tests

```bash
npm run test:unit
```
