export class ApiError extends Error {
  constructor(
    message,
    {
      kind,
      status = null,
      code = null,
      details = null,
      url = null,
      cause,
    } = {},
  ) {
    super(
      message,
      cause === undefined
        ? undefined
        : { cause },
    );

    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim() === "") {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }

  let url;

  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError("baseUrl должен быть абсолютным URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("baseUrl должен использовать http или https.");
  }

  if (url.search !== "" || url.hash !== "") {
    throw new TypeError("baseUrl не должен содержать query или hash.");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function buildUrl(baseUrl, path, query = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (typeof path !== "string" || path.trim() === "") {
    throw new TypeError("path должен быть непустой строкой.");
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(path)) {
    throw new TypeError("path должен быть относительным.");
  }

  if (!isPlainObject(query)) {
    throw new TypeError("query должен быть обычным объектом.");
  }

  const cleanPath = path.replace(/^\/+/, "");
  const url = new URL(`${normalizedBaseUrl}/${cleanPath}`);

  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    url.searchParams.set(name, String(value));
  }

  return url.toString();
}

function createCombinedSignal(externalSignal, timeoutSignal) {
  if (externalSignal === undefined) {
    return timeoutSignal;
  }

  if (!(externalSignal instanceof AbortSignal)) {
    throw new TypeError("signal должен быть экземпляром AbortSignal.");
  }

  return AbortSignal.any([
    externalSignal,
    timeoutSignal,
  ]);
}

function classifyFetchError(error, externalSignal, timeoutSignal, url) {
  if (externalSignal?.aborted) {
    return new ApiError(
      "Запрос был отменён.",
      {
        kind: "aborted",
        url,
        cause: error,
      },
    );
  }

  if (timeoutSignal.aborted) {
    return new ApiError(
      "Превышено время ожидания ответа.",
      {
        kind: "timeout",
        url,
        cause: error,
      },
    );
  }

  return new ApiError(
    "Не удалось получить ответ от сервера.",
    {
      kind: "network",
      url,
      cause: error,
    },
  );
}

async function readHttpError(response, url) {
  let payload = null;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }

  const apiError = payload?.error;

  const message = typeof apiError?.message === "string"
    ? apiError.message
    : `HTTP ${response.status}`;

  const code = typeof apiError?.code === "string"
    ? apiError.code
    : null;

  const details = apiError && "details" in apiError
    ? apiError.details
    : null;

  return new ApiError(
    message,
    {
      kind: "http",
      status: response.status,
      code,
      details,
      url,
    },
  );
}

export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);

  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs должен быть положительным целым числом.");
  }

  async function requestJson(
    path,
    {
      query = {},
      signal,
      timeoutMs: requestTimeoutMs = timeoutMs,
    } = {},
  ) {
    if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new TypeError("timeoutMs должен быть положительным целым числом.");
    }

    const url = buildUrl(
      normalizedBaseUrl,
      path,
      query,
    );

    const timeoutSignal = AbortSignal.timeout(requestTimeoutMs);
    const combinedSignal = createCombinedSignal(signal, timeoutSignal);

    let response;

    try {
      response = await fetchFn(
        url,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: combinedSignal,
        },
      );
    } catch (error) {
      throw classifyFetchError(
        error,
        signal,
        timeoutSignal,
        url,
      );
    }

    if (!(response instanceof Response)) {
      throw new ApiError(
        "fetchFn должен вернуть объект Response.",
        {
          kind: "invalid-response",
          url,
        },
      );
    }

    if (!response.ok) {
      throw await readHttpError(response, url);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      throw new ApiError(
        "Ожидался ответ в формате JSON.",
        {
          kind: "invalid-response",
          url,
        },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ApiError(
        "Не удалось разобрать JSON-ответ.",
        {
          kind: "invalid-response",
          url,
          cause: error,
        },
      );
    }
  }

  return {
    requestJson,
  };
}
