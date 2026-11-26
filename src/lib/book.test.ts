import assert from "node:assert/strict";
import test from "node:test";
import { replayFills, unrealizedOnOpen } from "./book";
import { humanToRao, raoToHuman } from "./money";
import { formatSigned } from "./format";

test("virtual FIFO: cash, realized win, and open unrealized", () => {
  const replay = replayFills(
    [
      {
        id: "1",
        at: "2026-01-01T15:00:00.000Z",
        netuid: 62,
        side: "buy",
        tao: humanToRao("0.4"),
        alpha: humanToRao("100"),
        price: "0.004",
        reason: "first look",
      },
      {
        id: "2",
        at: "2026-01-02T15:00:00.000Z",
        netuid: 62,
        side: "sell",
        tao: humanToRao("0.2"),
        alpha: humanToRao("40"),
        price: "0.005",
        reason: "trim",
      },
    ],
    humanToRao("1"),
  );
  assert.equal(raoToHuman(replay.cash, 4), "0.8");
  assert.equal(raoToHuman(replay.invested, 4), "0.4");
  assert.equal(raoToHuman(replay.realized, 4), "0.04");
  assert.equal(raoToHuman(replay.gained, 4), "0.04");
  assert.equal(replay.closed.length, 1);
  const open = replay.open.get(62);
  assert.ok(open);
  assert.equal(raoToHuman(open.alpha, 4), "60");
  const marked = unrealizedOnOpen(replay.open, new Map([[62, "0.005"]]));
  assert.equal(raoToHuman(marked.total ?? 0n, 4), "0.06");
  const sell = replay.rows.find((row) => row.id === "2");
  assert.equal(sell?.pl != null ? raoToHuman(sell.pl, 4) : null, "0.04");
  const buy = replay.rows.find((row) => row.id === "1");
  assert.equal(buy?.status, "open");
  assert.equal(buy?.pl, null);
});

test("a sell with no matching buy does not invent profit", () => {
  const replay = replayFills(
    [
      {
        id: "s",
        at: "2026-01-03T15:00:00.000Z",
        netuid: 4,
        side: "sell",
        tao: humanToRao("1"),
        alpha: humanToRao("10"),
        price: "0.1",
        reason: "emission",
      },
    ],
    0n,
  );
  assert.equal(replay.realized, 0n);
  assert.equal(replay.closed.length, 0);
  assert.equal(replay.rows[0].unmatchedAlpha, humanToRao("10"));
  assert.equal(replay.rows[0].pl, null);
});

test("losses render with a leading minus", () => {
  assert.equal(formatSigned(-0.026, 4).startsWith("−"), true);
  assert.equal(formatSigned(-0.026, 4).includes("("), false);
});
