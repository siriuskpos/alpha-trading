import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const instance = new Database(path.join(dir, "alpha-trading.sqlite"));
  instance.pragma("journal_mode = WAL");
  instance.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      coldkey TEXT NOT NULL DEFAULT '',
      thin_pool_tao TEXT NOT NULL DEFAULT '100',
      starting_tao TEXT NOT NULL DEFAULT '1',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      netuid INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS virtual_trades (
      id INTEGER PRIMARY KEY,
      created_at TEXT NOT NULL,
      netuid INTEGER NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
      tao_amount TEXT NOT NULL,
      alpha_amount TEXT NOT NULL,
      price_mid TEXT NOT NULL,
      price_fill TEXT NOT NULL,
      slippage_pct TEXT NOT NULL,
      fee_tao TEXT NOT NULL,
      fee_alpha TEXT NOT NULL,
      reason TEXT NOT NULL,
      pool_tao TEXT NOT NULL,
      thin INTEGER NOT NULL,
      quote_block INTEGER NOT NULL
    );
  `);
  const count = instance.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number };
  if (count.n === 0) {
    instance
      .prepare(
        "INSERT INTO settings (id, coldkey, thin_pool_tao, starting_tao, updated_at) VALUES (1, '', '100', '1', ?)",
      )
      .run(new Date().toISOString());
  }
  db = instance;
  return instance;
}

export type SettingsRow = {
  coldkey: string;
  thin_pool_tao: string;
  starting_tao: string;
};

export type TradeRow = {
  id: number;
  created_at: string;
  netuid: number;
  side: "buy" | "sell";
  tao_amount: string;
  alpha_amount: string;
  price_mid: string;
  price_fill: string;
  slippage_pct: string;
  fee_tao: string;
  fee_alpha: string;
  reason: string;
  pool_tao: string;
  thin: number;
  quote_block: number;
};

export function readSettings(): SettingsRow {
  return getDb().prepare("SELECT coldkey, thin_pool_tao, starting_tao FROM settings WHERE id = 1").get() as SettingsRow;
}

export function readFavorites(): number[] {
  const rows = getDb().prepare("SELECT netuid FROM favorites ORDER BY netuid").all() as { netuid: number }[];
  return rows.map((row) => row.netuid);
}

export function countTrades(): number {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM virtual_trades").get() as { n: number };
  return row.n;
}

export function listTrades(): TradeRow[] {
  return getDb().prepare("SELECT * FROM virtual_trades ORDER BY created_at ASC, id ASC").all() as TradeRow[];
}
