import { STAGING_WEB_ORIGIN, assertBenchmarkRole } from "./staging-reconnect-guard";

type VerifierResponse = {
  ok(): boolean;
  status(): number;
  json(): Promise<unknown>;
};

type VerifierRequestContext = {
  post(
    url: string,
    options?: { data?: unknown; headers?: Record<string, string> },
  ): Promise<VerifierResponse>;
  get(
    url: string,
    options?: { headers?: Record<string, string> },
  ): Promise<VerifierResponse>;
};

type VerifierEndpoints = {
  loginUrl: string;
  refreshUrl: string;
  meUrl: string;
  email: string;
  password: string;
};

type TokenResponse = {
  data?: { accessToken?: string; expiresAt?: string };
};

async function tokensFrom(response: VerifierResponse): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const body = (await response.json()) as TokenResponse;
  const accessToken = body.data?.accessToken;
  const expiresAt = Date.parse(body.data?.expiresAt ?? "");
  if (!accessToken || Number.isNaN(expiresAt)) {
    throw new Error("Staging verifier authentication returned invalid tokens.");
  }
  return { accessToken, expiresAt };
}

export async function createStagingReconnectVerifier(
  request: VerifierRequestContext,
  endpoints: VerifierEndpoints,
) {
  const login = await request.post(endpoints.loginUrl, {
    data: { email: endpoints.email, password: endpoints.password },
  });
  if (!login.ok()) {
    throw new Error(`Staging benchmark login failed with ${login.status()}.`);
  }
  let tokens = await tokensFrom(login);
  const me = await request.get(endpoints.meUrl, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!me.ok()) {
    throw new Error(`Staging benchmark role check failed with ${me.status()}.`);
  }
  assertBenchmarkRole(((await me.json()) as { data?: { role?: unknown } }).data?.role);

  const refresh = async () => {
    const response = await request.post(endpoints.refreshUrl, {
      headers: { Origin: STAGING_WEB_ORIGIN },
    });
    if (!response.ok()) {
      throw new Error(`Staging verifier refresh failed with ${response.status()}.`);
    }
    tokens = await tokensFrom(response);
  };

  return {
    async authorized<T extends VerifierResponse | string>(
      operation: (accessToken: string) => Promise<T>,
    ): Promise<T> {
      if (Date.now() >= tokens.expiresAt) await refresh();
      let response = await operation(tokens.accessToken);
      if (typeof response === "string" || response.status() !== 401) return response;
      await refresh();
      response = await operation(tokens.accessToken);
      return response;
    },
  };
}
