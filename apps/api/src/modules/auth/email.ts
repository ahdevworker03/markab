function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeEmailInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const body = input as Record<string, unknown>;

  return typeof body.email === "string"
    ? { ...body, email: normalizeEmail(body.email) }
    : input;
}

export { normalizeEmail, normalizeEmailInput };
