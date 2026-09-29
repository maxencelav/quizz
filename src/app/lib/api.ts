import type { ErrorBody, ErrorCode, ErrorParams } from "../../shared/errors";

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public params: ErrorParams | undefined,
    public status: number,
  ) {
    super(code);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...rest,
      // Expired Access session: the edge answers with a redirect to the login page
      redirect: "manual",
      headers: {
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("network", undefined, 0);
  }
  if (res.type === "opaqueredirect") {
    // Full reload: Access intercepts the navigation and shows its login page
    location.reload();
    throw new ApiError("unauthorized", undefined, 401);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as Partial<ErrorBody>;
    throw new ApiError(body.error ?? "internal", body.params, res.status);
  }
  return data as T;
}
