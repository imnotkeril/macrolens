/**
 * fetch() for privileged backend endpoints (train models, refresh data, run agents).
 * The backend requires `X-API-Key`; the key is entered once and kept in this browser's
 * localStorage (never bundled into the app).
 */
const STORAGE_KEY = "macrolens_admin_key";

function readKey(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveKey(key: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* storage unavailable: key is used for this request only */
  }
}

function withKey(init: RequestInit | undefined, key: string): RequestInit {
  const headers = new Headers(init?.headers);
  if (key) headers.set("X-API-Key", key);
  return { ...init, headers };
}

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (typeof window === "undefined") return fetch(input, init);
  let res = await fetch(input, withKey(init, readKey()));
  if (res.status === 401) {
    const entered = window.prompt("Admin API key required for this action:")?.trim();
    if (entered) {
      saveKey(entered);
      res = await fetch(input, withKey(init, entered));
    }
  }
  return res;
}
