import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";
import {
  ApiError,
  buildUrl,
  createApiClient,
} from "../src/api-client.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error.message);
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return `http://127.0.0.1:${address.port}/api`;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

await check("01. кириллица, пробел и & корректно кодируются", () => {
  const result = buildUrl(
    "https://example.test/api",
    "/tasks",
    {
      q: "API & ошибки",
      completed: false,
    },
  );

  const url = new URL(result);

  assert.equal(
    url.searchParams.get("q"),
    "API & ошибки",
  );
  assert.equal(
    url.searchParams.get("completed"),
    "false",
  );
});

const server = createApiServer();
const baseUrl = await listen(server);
const client = createApiClient({ baseUrl });

try {
  await check("02. неизвестный маршрут сохраняет HTTP 404", async () => {
    let caught;

    try {
      await client.requestJson("/missing-route");
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof ApiError);
    assert.equal(caught.kind, "http");
    assert.equal(caught.status, 404);
    assert.equal(caught.code, "ROUTE_NOT_FOUND");
  });

  await check("03. тайм-аут с коротким лимитом не считается network", async () => {
    let caught;

    try {
      await client.requestJson(
        "/debug/delay",
        {
          query: { ms: 80 },
          timeoutMs: 10,
        },
      );
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof ApiError);
    assert.equal(caught.kind, "timeout");
  });
} finally {
  await close(server);
}

console.log(`Собственные проверки: успешно ${passed}, ошибок ${failed}.`);

if (failed > 0) {
  process.exitCode = 1;
}
