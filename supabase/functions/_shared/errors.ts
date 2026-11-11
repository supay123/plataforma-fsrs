export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new AppError(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }
}

export async function handle(
  operation: () => Promise<Response>,
): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
        },
        error.status,
      );
    }

    console.error("Unhandled Edge Function error", error);
    return json(
      {
        error: {
          code: "internal_error",
          message: "The operation could not be completed.",
        },
      },
      500,
    );
  }
}

export function assertNoDatabaseError(
  error: { message: string; code?: string; details?: string } | null,
  fallbackCode = "database_error",
): void {
  if (error) {
    throw new AppError(400, error.code ?? fallbackCode, error.message, {
      details: error.details,
    });
  }
}
