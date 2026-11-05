const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export async function request<T>(
  path: string,
  token: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
      ...options?.headers,
    },
  });
  const data = (await response.json()) as T & { message?: string | string[] };
  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(" ")
        : (data.message ?? "Une erreur est survenue."),
    );
  }
  return data;
}

export { API };
