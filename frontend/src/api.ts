const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Tire = {
  id: string;
  size: string;
  brand: string;
  season: "All Season" | "Invernali" | "Estive";
  rim: number;
  quantity: number;
  created_at: string;
  updated_at: string;
};

export type Movement = {
  id: string;
  tire_id: string;
  size: string;
  brand: string;
  season: Tire["season"];
  rim: number;
  type: "create" | "add" | "remove" | "delete";
  delta: number;
  quantity_after: number;
  operator: string | null;
  timestamp: string;
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = typeof data?.detail === "string" ? data.detail : JSON.stringify(data?.detail ?? data);
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTires: () => fetch(`${BASE}/api/tires`).then(j<Tire[]>),
  listMovements: (limit = 50) =>
    fetch(`${BASE}/api/movements?limit=${limit}`).then(j<Movement[]>),
  getMeta: () =>
    fetch(`${BASE}/api/brands`).then(
      j<{ brands: string[]; seasons: Tire["season"][] }>,
    ),
  createTire: (payload: {
    size: string;
    brand: string;
    season: Tire["season"];
    quantity: number;
    operator?: string | null;
  }) =>
    fetch(`${BASE}/api/tires`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(j<Tire>),
  updateQty: (id: string, delta: number, operator?: string | null) =>
    fetch(`${BASE}/api/tires/${id}/quantity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, operator: operator ?? null }),
    }).then(j<Tire>),
  deleteTire: (id: string, operator?: string | null) => {
    const q = operator ? `?operator=${encodeURIComponent(operator)}` : "";
    return fetch(`${BASE}/api/tires/${id}${q}`, { method: "DELETE" }).then(
      j<{ ok: boolean }>,
    );
  },
};

export const SEASONS: Tire["season"][] = ["All Season", "Invernali", "Estive"];
