import { createApiClient } from "../src/api-client.js";

const baseUrl = process.env.API_URL
  ?? "http://127.0.0.1:5505/api";

const client = createApiClient({
  baseUrl,
  timeoutMs: 2000,
});

async function measureSequential() {
  const startedAt = performance.now();

  await client.requestJson(
    "/debug/delay",
    { query: { ms: 120 } },
  );

  await client.requestJson(
    "/debug/delay",
    { query: { ms: 120 } },
  );

  return performance.now() - startedAt;
}

async function measureParallel() {
  const startedAt = performance.now();

  const first = client.requestJson(
    "/debug/delay",
    { query: { ms: 120 } },
  );

  const second = client.requestJson(
    "/debug/delay",
    { query: { ms: 120 } },
  );

  await Promise.all([
    first,
    second,
  ]);

  return performance.now() - startedAt;
}

for (let run = 1; run <= 3; run += 1) {
  const sequential = await measureSequential();
  const parallel = await measureParallel();

  console.log(
    `Запуск ${run}: последовательно ${sequential.toFixed(1)} мс; `
    + `параллельно ${parallel.toFixed(1)} мс`,
  );
}
