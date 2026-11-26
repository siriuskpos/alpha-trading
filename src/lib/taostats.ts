const BASE = "https://api.taostats.io";

export class TaostatsError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Page<T> = {
  data: T[];
  pagination?: {
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
};

type Query = Record<string, string | number | boolean | undefined>;

export function assertKey(): string {
  const key = process.env.TAOSTATS_API_KEY?.trim();
  if (!key) {
    throw new TaostatsError(
      "Taostats key missing or rate-limited (429). Check .env and wait.",
      503,
    );
  }
  return key;
}

export async function taostatsGet<T>(path: string, query: Query = {}): Promise<Page<T>> {
  const key = assertKey();
  const url = new URL(path, BASE);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") url.searchParams.set(name, String(value));
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: key, Accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    throw new TaostatsError("Could not reach Taostats. Check the network and try again.", 502);
  }
  if (response.status === 401) {
    throw new TaostatsError("Taostats rejected the API key (401). Check .env and wait.", 401);
  }
  if (response.status === 429) {
    throw new TaostatsError("Taostats key missing or rate-limited (429). Check .env and wait.", 429);
  }
  if (!response.ok) {
    let message = `Taostats returned ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep the status sentence */
    }
    throw new TaostatsError(message, response.status);
  }
  return (await response.json()) as Page<T>;
}

export async function taostatsAll<T>(
  path: string,
  query: Query,
  maxPages: number,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let page = 1;
  let truncated = false;
  while (page <= maxPages) {
    const body = await taostatsGet<T>(path, { ...query, page, limit: 200 });
    rows.push(...(body.data ?? []));
    const next = body.pagination?.next_page;
    if (!next) return { rows, truncated };
    if (page >= maxPages) {
      truncated = true;
      break;
    }
    page = next;
  }
  return { rows, truncated };
}
