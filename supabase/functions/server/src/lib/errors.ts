export class ValidationError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "ValidationError";
  }
}

export function handleApiError(c: any, error: unknown, label: string) {
  if (error instanceof ValidationError) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(label, error);
  return c.json({ error: `${label}: ${error}` }, 500);
}
