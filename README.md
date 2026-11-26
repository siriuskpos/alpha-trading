# Alpha Trading

Local research and paper trading for Bittensor subnet alpha. Market data is read from Taostats. Virtual fills stay in SQLite on this machine. The app never holds a wallet and never sends a real order.

## Run

```bash
cp .env.example .env.local
# Put a Taostats API key in TAOSTATS_API_KEY. Do not prefix it with NEXT_PUBLIC_.
npm install
npm run dev
```

Open http://127.0.0.1:3000.

Times are America/New_York. Virtual and Real stay on separate toggles and are never added together. Real mode reads the public coldkey you type in Settings, using Taostats portfolio and stake-event endpoints.

If a Taostats price or market cap does not match the pool reserves, that cell is left blank and the page says why. FDV is 21,000,000 alpha times the spot price.
