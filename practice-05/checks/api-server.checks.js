import assert from "node:assert/strict";
import { createApiServer } from "../api/server.mjs";

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
  assert.ok(address && typeof address === "object");

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

async function readJson(response) {
  const text = await response.text();
  return text.length === 0 ? null : JSON.parse(text);
}

const server = createApiServer();
const baseUrl = await listen(server);

try {
  await check("01. health возвращает 200 и JSON", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
    assert.equal(payload.data.status, "ok");
    assert.match(
      response.headers.get("content-type") ?? "",
      /^application\/json\b/i,
    );
  });

  await check("02. API возвращает все 12 задач", async () => {
    const response = await fetch(`${baseUrl}/tasks`);
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.data.length, 12);
    assert.equal(payload.meta.total, 12);
  });

  await check("03. фильтр completed=false", async () => {
    const response = await fetch(`${baseUrl}/tasks?completed=false`);
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [4, 7, 13, 19, 22, 28, 34],
    );
  });

  await check("04. фильтр completed=true", async () => {
    const response = await fetch(`${baseUrl}/tasks?completed=true`);
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [1, 10, 16, 25, 31],
    );
  });

  await check("05. фильтр priority=high", async () => {
    const response = await fetch(`${baseUrl}/tasks?priority=high`);
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [4, 13, 16, 25, 34],
    );
  });

  await check("06. фильтр categoryId=2", async () => {
    const response = await fetch(`${baseUrl}/tasks?categoryId=2`);
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [4, 16, 22, 25, 28, 34],
    );
  });

  await check("07. поиск q=провер", async () => {
    const response = await fetch(
      `${baseUrl}/tasks?q=${encodeURIComponent("провер")}`,
    );
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [7, 16],
    );
  });

  await check("08. несколько фильтров работают вместе", async () => {
    const response = await fetch(
      `${baseUrl}/tasks?completed=false&priority=high&categoryId=2`,
    );
    const payload = await readJson(response);

    assert.deepEqual(
      payload.data.map((task) => task.id),
      [4, 34],
    );
    assert.equal(payload.meta.total, 2);
  });

  await check("09. неверные query-параметры дают 400", async () => {
    for (const suffix of [
      "unknown=1",
      "priority=high&priority=low",
      "completed=yes",
    ]) {
      const response = await fetch(`${baseUrl}/tasks?${suffix}`);
      const payload = await readJson(response);

      assert.equal(response.status, 400);
      assert.equal(payload.error.code, "INVALID_QUERY");
    }
  });

  await check("10. задача 25 запрашивается по id", async () => {
    const response = await fetch(`${baseUrl}/tasks/25`);
    const payload = await readJson(response);

    assert.equal(response.status, 200);
    assert.equal(payload.data.id, 25);
    assert.equal(payload.data.title, "Исправить обработку ошибок");
  });

  await check("11. отсутствующая задача даёт 404", async () => {
    const response = await fetch(`${baseUrl}/tasks/999`);
    const payload = await readJson(response);

    assert.equal(response.status, 404);
    assert.equal(payload.error.code, "TASK_NOT_FOUND");
    assert.deepEqual(payload.error.details, { id: 999 });
  });

  await check("12. неверный id задачи даёт 400", async () => {
    for (const id of ["0", "-1", "4.5", "abc"]) {
      const response = await fetch(`${baseUrl}/tasks/${id}`);
      const payload = await readJson(response);

      assert.equal(response.status, 400);
      assert.equal(payload.error.code, "INVALID_ID");
    }
  });

  await check("13. API возвращает категории", async () => {
    const response = await fetch(`${baseUrl}/categories`);
    const payload = await readJson(response);

    assert.deepEqual(payload.data, [
      { id: 1, name: "Учёба" },
      { id: 2, name: "Проект" },
      { id: 3, name: "Организация" },
    ]);
    assert.equal(payload.meta.total, 3);
  });

  await check("14. категория запрашивается по id", async () => {
    const response = await fetch(`${baseUrl}/categories/2`);
    const payload = await readJson(response);

    assert.deepEqual(payload.data, {
      id: 2,
      name: "Проект",
    });
  });

  await check("15. отсутствующая категория даёт 404", async () => {
    const response = await fetch(`${baseUrl}/categories/999`);
    const payload = await readJson(response);

    assert.equal(response.status, 404);
    assert.equal(payload.error.code, "CATEGORY_NOT_FOUND");
  });

  await check("16. debug/error возвращает 503", async () => {
    const response = await fetch(`${baseUrl}/debug/error`);
    const payload = await readJson(response);

    assert.equal(response.status, 503);
    assert.equal(payload.error.code, "SERVICE_UNAVAILABLE");
  });

  await check("17. debug-маршруты дают повреждённый JSON и текст", async () => {
    const invalidJson = await fetch(`${baseUrl}/debug/invalid-json`);
    const text = await fetch(`${baseUrl}/debug/text`);

    assert.match(
      invalidJson.headers.get("content-type") ?? "",
      /application\/json/i,
    );
    await assert.rejects(() => invalidJson.json());

    assert.match(
      text.headers.get("content-type") ?? "",
      /text\/plain/i,
    );
  });

  await check("18. CORS, OPTIONS и неверный метод обработаны", async () => {
    const options = await fetch(`${baseUrl}/tasks`, {
      method: "OPTIONS",
    });

    assert.equal(options.status, 204);
    assert.equal(
      options.headers.get("access-control-allow-origin"),
      "*",
    );

    const post = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
    });
    const payload = await readJson(post);

    assert.equal(post.status, 405);
    assert.equal(payload.error.code, "METHOD_NOT_ALLOWED");
  });
} finally {
  await close(server);
}

console.log(`Итог API: успешно ${passed}, ошибок ${failed}.`);

if (failed > 0) {
  process.exitCode = 1;
}
