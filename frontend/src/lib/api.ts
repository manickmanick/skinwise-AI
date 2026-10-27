const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/$/, "");
let csrfToken: string | null = null;
type ApiOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    credentials: "include",
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      "Couldn't start a secure session. Check that the backend is running.",
    );
  const body = (await response.json()) as { csrfToken: string };
  csrfToken = body.csrfToken;
  return csrfToken;
}

export async function apiRequest<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const suppliedBody = options.body;
  let body: BodyInit | null | undefined;
  const isJsonObject =
    suppliedBody !== null &&
    typeof suppliedBody === "object" &&
    !(suppliedBody instanceof FormData) &&
    !(suppliedBody instanceof Blob) &&
    !(suppliedBody instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(suppliedBody) &&
    !(suppliedBody instanceof URLSearchParams);
  if (isJsonObject) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(suppliedBody);
  } else body = suppliedBody as BodyInit | null | undefined;
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method))
    headers.set("X-CSRF-Token", await getCsrfToken());
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      method,
      body,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "Couldn't reach SkinWise AI. Check that the backend is running and try again.",
    );
  }
  if (
    method === "POST" &&
    ["/auth/login", "/auth/register", "/auth/logout"].includes(path)
  )
    csrfToken = null;
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth/login")
      window.dispatchEvent(new Event("skinwise:session-expired"));
    let message = "Something went wrong. Please try again.";
    try {
      message =
        ((await response.json()) as { message?: string }).message || message;
    } catch {
      /* empty error body */
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function invalidateCsrfToken() {
  csrfToken = null;
}
