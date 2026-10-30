const API_ROOT = import.meta.env.VITE_API_URL || "/api/v1";
const TOKEN_KEY = "campus_access_token";

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, { ...options, headers });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(`Unable to reach the API for ${path}: ${reason}`, 0);
  }
  if (!response.ok) {
    const responseText = await response.text();
    let message = `API request to ${path} failed (${response.status})`;
    if (responseText.trim()) {
      try {
        const body: unknown = JSON.parse(responseText);
        if (typeof body === "object" && body !== null && "detail" in body) {
          const detail = (body as { detail: unknown }).detail;
          message = typeof detail === "string" ? detail : JSON.stringify(detail);
        } else if (
          typeof body === "object" &&
          body !== null &&
          "message" in body &&
          typeof (body as { message: unknown }).message === "string"
        ) {
          message = (body as { message: string }).message;
        } else {
          message = responseText.trim().slice(0, 1000);
        }
      } catch {
        message = responseText.trim().slice(0, 1000);
      }
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function apiUrl(path: string) {
  return `${API_ROOT}${path}`;
}
