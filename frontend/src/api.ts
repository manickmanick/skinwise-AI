const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export interface HealthResponse {
  status: string;
  application: string;
  message: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend request failed: HTTP ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}