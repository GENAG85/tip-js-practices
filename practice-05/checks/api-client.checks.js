import assert from "node:assert/strict";
import {
  ApiError,
  buildUrl,
  createApiClient,
} from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";

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

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...headers,
      },
    },
  );
}

function task(overrides = {}) {
  return {
    id: 4,
    title: "Подготовить модель задач",
    completed: false,
    priority: "high",
    categoryId: 2,
    ...overrides,
  };
}

function category(overrides = {}) {
  return {
    id: 2,
    name: "Проект",
    ...overrides,
  };
}

async function expectApiError(action, kind) {
  let caught;

  try {
    await action();
  } catch (error) {
    caught = error;
  }

  assert.ok(
    caught instanceof ApiError,
    "Ожидался экземпляр ApiError",
  );
  assert.equal(caught.kind, kind);

  return caught;
}

await check("01. buildUrl соединяет baseUrl и путь", () => {
  assert.equal(
    buildUrl("http://127.0.0.1:5505/api/", "/tasks"),
    "http://127.0.0.1:5505/api/tasks",
  );
});

await check("02. buildUrl кодирует специальные символы", () => {
  const result = buildUrl(
    "https://example.test/api",
    "/tasks",
    { q: "API & ошибки" },
  );

  const url = new URL(result);
  assert.equal(url.searchParams.get("q"), "API & ошибки");
});

await check("03. buildUrl сохраняет false и 0", () => {
  const result = buildUrl(
    "https://example.test/api",
    "/tasks",
    {
      completed: false,
      categoryId: 0,
    },
  );

  const url = new URL(result);
  assert.equal(url.searchParams.get("completed"), "false");
  assert.equal(url.searchParams.get("categoryId"), "0");
});

await check("04. buildUrl пропускает пустые значения и не мутирует query", () => {
  const query = {
    q: "",
    a: undefined,
    b: null,
    priority: "high",
  };
  const snapshot = structuredClone(query);

  const result = buildUrl(
    "https://example.test/api",
    "/tasks",
    query,
  );

  assert.deepEqual(query, snapshot);
  assert.equal(
    result,
    "https://example.test/api/tasks?priority=high",
  );
});

await check("05. buildUrl отклоняет неверный baseUrl", () => {
  assert.throws(
    () => buildUrl("/api", "/tasks"),
    TypeError,
  );
  assert.throws(
    () => buildUrl("ftp://example.test/api", "/tasks"),
    TypeError,
  );
  assert.throws(
    () => buildUrl("https://example.test/api?q=1", "/tasks"),
    TypeError,
  );
});

await check("06. createApiClient проверяет конфигурацию", () => {
  assert.throws(
    () => createApiClient(),
    TypeError,
  );
  assert.throws(
    () => createApiClient({
      baseUrl: "https://example.test/api",
      fetchFn: 123,
    }),
    TypeError,
  );
});

await check("07. requestJson отправляет GET, Accept и signal", async () => {
  const captured = {};

  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async (url, options) => {
      captured.url = url;
      captured.options = options;
      return jsonResponse({ data: [] });
    },
  });

  await client.requestJson("/tasks");

  assert.equal(captured.options.method, "GET");
  assert.equal(
    new Headers(captured.options.headers).get("accept"),
    "application/json",
  );
  assert.ok(captured.options.signal instanceof AbortSignal);
});

await check("08. requestJson возвращает JSON успешного ответа", async () => {
  const payload = { data: [task()] };

  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse(payload),
  });

  assert.deepEqual(
    await client.requestJson("/tasks"),
    payload,
  );
});

await check("09. ответ 204 преобразуется в null", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response(null, { status: 204 }),
  });

  assert.equal(
    await client.requestJson("/empty"),
    null,
  );
});

await check("10. JSON-ошибка 404 становится ApiError http", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse(
      {
        error: {
          code: "TASK_NOT_FOUND",
          message: "Задача не найдена.",
          details: { id: 999 },
        },
      },
      404,
    ),
  });

  const error = await expectApiError(
    () => client.requestJson("/tasks/999"),
    "http",
  );

  assert.equal(error.status, 404);
  assert.equal(error.code, "TASK_NOT_FOUND");
  assert.deepEqual(error.details, { id: 999 });
});

await check("11. HTTP-ошибка без JSON сохраняет статус", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response(
      "Ошибка",
      {
        status: 502,
        headers: { "Content-Type": "text/plain" },
      },
    ),
  });

  const error = await expectApiError(
    () => client.requestJson("/tasks"),
    "http",
  );

  assert.equal(error.status, 502);
});

await check("12. текст вместо JSON даёт invalid-response", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response(
      "text",
      {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      },
    ),
  });

  await expectApiError(
    () => client.requestJson("/tasks"),
    "invalid-response",
  );
});

await check("13. повреждённый JSON даёт invalid-response", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => new Response(
      "{\"data\":",
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  });

  await expectApiError(
    () => client.requestJson("/tasks"),
    "invalid-response",
  );
});

await check("14. сетевой отказ даёт kind network", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => {
      throw new TypeError("network down");
    },
  });

  await expectApiError(
    () => client.requestJson("/tasks"),
    "network",
  );
});

await check("15. тайм-аут даёт kind timeout", async () => {
  const fetchFn = (_url, { signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => resolve(jsonResponse({ data: [] })),
      200,
    );

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn,
    timeoutMs: 20,
  });

  await expectApiError(
    () => client.requestJson("/slow"),
    "timeout",
  );
});

await check("16. внешний AbortSignal даёт kind aborted", async () => {
  const fetchFn = (_url, { signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => resolve(jsonResponse({ data: [] })),
      200,
    );

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });

  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn,
    timeoutMs: 1000,
  });

  const controller = new AbortController();
  const pending = client.requestJson(
    "/slow",
    { signal: controller.signal },
  );

  controller.abort();

  await expectApiError(
    () => pending,
    "aborted",
  );
});

await check("17. HTTP ApiError не маскируется как network", async () => {
  const client = createApiClient({
    baseUrl: "https://example.test/api",
    fetchFn: async () => jsonResponse(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Недоступно.",
        },
      },
      503,
    ),
  });

  const error = await expectApiError(
    () => client.requestJson("/debug/error"),
    "http",
  );

  assert.equal(error.status, 503);
});

await check("18. createTaskApi требует requestJson", () => {
  assert.throws(() => createTaskApi(), TypeError);
  assert.throws(() => createTaskApi({}), TypeError);
  assert.throws(
    () => createTaskApi({ requestJson: 1 }),
    TypeError,
  );
});

await check("19. getTasks передаёт нормализованные фильтры", async () => {
  const calls = [];

  const api = createTaskApi({
    async requestJson(path, options) {
      calls.push({ path, options });

      return {
        data: [task()],
        meta: {
          total: 1,
          filters: options.query,
        },
      };
    },
  });

  const result = await api.getTasks({
    completed: false,
    priority: "high",
    categoryId: 2,
    q: "  клиент  ",
  });

  assert.equal(calls[0].path, "/tasks");
  assert.deepEqual(calls[0].options.query, {
    completed: false,
    priority: "high",
    categoryId: 2,
    q: "клиент",
  });
  assert.equal(result.meta.total, 1);
});

await check("20. getTasks отклоняет неизвестные фильтры", async () => {
  const api = createTaskApi({
    async requestJson() {
      return {
        data: [],
        meta: { total: 0 },
      };
    },
  });

  await assert.rejects(
    () => api.getTasks({ unknown: 1 }),
    TypeError,
  );
});

await check("21. getTasks проверяет типы фильтров", async () => {
  const api = createTaskApi({
    async requestJson() {
      return {
        data: [],
        meta: { total: 0 },
      };
    },
  });

  await assert.rejects(
    () => api.getTasks({ completed: "false" }),
    TypeError,
  );
  await assert.rejects(
    () => api.getTasks({ priority: "urgent" }),
    TypeError,
  );
});

await check("22. getTaskById возвращает проверенную задачу", async () => {
  const api = createTaskApi({
    async requestJson(path) {
      assert.equal(path, "/tasks/4");
      return { data: task() };
    },
  });

  assert.deepEqual(
    await api.getTaskById(4),
    task(),
  );
});

await check("23. getTaskById проверяет id", async () => {
  const api = createTaskApi({
    async requestJson() {
      return { data: task() };
    },
  });

  await assert.rejects(
    () => api.getTaskById(0),
    TypeError,
  );
});

await check("24. getCategories возвращает проверенный массив", async () => {
  const api = createTaskApi({
    async requestJson(path, options) {
      assert.equal(path, "/categories");
      assert.equal(options, undefined);

      return {
        data: [category()],
        meta: { total: 1 },
      };
    },
  });

  assert.deepEqual(
    await api.getCategories(),
    [category()],
  );
});

await check("25. неверные схемы ответа отклоняются", async () => {
  const invalidTaskApi = createTaskApi({
    async requestJson() {
      return {
        data: [task({ completed: "false" })],
        meta: { total: 1 },
      };
    },
  });

  await expectApiError(
    () => invalidTaskApi.getTasks(),
    "invalid-response",
  );

  const duplicateApi = createTaskApi({
    async requestJson() {
      return {
        data: [task(), task()],
        meta: { total: 2 },
      };
    },
  });

  await expectApiError(
    () => duplicateApi.getTasks(),
    "invalid-response",
  );
});

await check("26. loadInitialData запускает оба запроса до ожидания", async () => {
  const started = [];
  let resolveTasks;
  let resolveCategories;

  const taskPromise = new Promise((resolve) => {
    resolveTasks = resolve;
  });

  const categoryPromise = new Promise((resolve) => {
    resolveCategories = resolve;
  });

  const api = createTaskApi({
    requestJson(path) {
      started.push(path);

      if (path === "/tasks") {
        return taskPromise;
      }

      return categoryPromise;
    },
  });

  const pending = api.loadInitialData();

  assert.deepEqual(started, [
    "/tasks",
    "/categories",
  ]);

  resolveTasks({
    data: [task()],
    meta: { total: 1 },
  });

  resolveCategories({
    data: [category()],
    meta: { total: 1 },
  });

  const result = await pending;

  assert.equal(result.tasks.length, 1);
  assert.equal(result.categories.length, 1);
});

console.log(`Итог клиента: успешно ${passed}, ошибок ${failed}.`);

if (failed > 0) {
  process.exitCode = 1;
}
