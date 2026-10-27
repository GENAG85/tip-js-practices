import http from "node:http";
import { pathToFileURL } from "node:url";
import { categories as seedCategories, tasks as seedTasks } from "./data.js";

const HOST = "127.0.0.1";
const DEFAULT_PORT = 5505;
const MAX_BODY_BYTES = 16 * 1024;
const PRIORITIES = new Set(["low", "medium", "high"]);
const FILTER_NAMES = new Set(["completed", "priority", "categoryId", "q"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Expose-Headers": "Location",
    "Access-Control-Max-Age": "600",
  };
}

function sendJson(res, status, payload, head = false, extraHeaders = {}) {
  const body = JSON.stringify(payload);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
    ...extraHeaders,
  });

  res.end(head ? undefined : body);
}

function sendEmpty(res, status, extraHeaders = {}) {
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...corsHeaders(),
    ...extraHeaders,
  });

  res.end();
}

function sendRaw(res, status, body, contentType, head = false) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...corsHeaders(),
  });

  res.end(head ? undefined : body);
}

function sendError(
  res,
  status,
  code,
  message,
  details,
  head = false,
  headers = {},
) {
  const error = {
    code,
    message,
  };

  if (details !== undefined) {
    error.details = details;
  }

  sendJson(
    res,
    status,
    { error },
    head,
    headers,
  );
}

function oneValue(searchParams, name) {
  const values = searchParams.getAll(name);

  if (values.length > 1) {
    throw new TypeError(`Параметр ${name} нельзя повторять.`);
  }

  return values[0] ?? null;
}

function parsePositiveId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const value = Number(raw);
  return Number.isSafeInteger(value)
    ? value
    : null;
}

function parseFilters(searchParams) {
  for (const name of searchParams.keys()) {
    if (!FILTER_NAMES.has(name)) {
      throw new TypeError(`Неизвестный параметр ${name}.`);
    }
  }

  const filters = {};
  const completedRaw = oneValue(searchParams, "completed");
  const priorityRaw = oneValue(searchParams, "priority");
  const categoryRaw = oneValue(searchParams, "categoryId");
  const qRaw = oneValue(searchParams, "q");

  if (completedRaw !== null) {
    if (completedRaw !== "true" && completedRaw !== "false") {
      throw new TypeError("completed должен быть true или false.");
    }

    filters.completed = completedRaw === "true";
  }

  if (priorityRaw !== null) {
    if (!PRIORITIES.has(priorityRaw)) {
      throw new TypeError("priority имеет неверное значение.");
    }

    filters.priority = priorityRaw;
  }

  if (categoryRaw !== null) {
    const categoryId = parsePositiveId(categoryRaw);

    if (categoryId === null) {
      throw new TypeError("categoryId должен быть положительным целым числом.");
    }

    filters.categoryId = categoryId;
  }

  if (qRaw !== null) {
    const q = qRaw.trim();

    if (q.length > 100) {
      throw new TypeError("q не должен быть длиннее 100 символов.");
    }

    if (q !== "") {
      filters.q = q;
    }
  }

  return filters;
}

function validateTaskDraft(body, categories) {
  const errors = {};
  const normalized = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      errors: { body: "Тело запроса должно быть объектом." },
      normalized,
    };
  }

  for (const key of Object.keys(body)) {
    if (!["title", "priority", "categoryId"].includes(key)) {
      errors[key] = `Поле ${key} нельзя передавать при создании.`;
    }
  }

  if (typeof body.title !== "string") {
    errors.title = "Название должно быть строкой.";
  } else {
    const title = body.title.trim();

    if (title.length < 1 || title.length > 100) {
      errors.title = "Название должно содержать от 1 до 100 символов.";
    } else {
      normalized.title = title;
    }
  }

  if (!PRIORITIES.has(body.priority)) {
    errors.priority = "Приоритет должен быть low, medium или high.";
  } else {
    normalized.priority = body.priority;
  }

  if (
    !Number.isSafeInteger(body.categoryId)
    || !categories.some((category) => category.id === body.categoryId)
  ) {
    errors.categoryId = "Категория не найдена.";
  } else {
    normalized.categoryId = body.categoryId;
  }

  return {
    errors,
    normalized,
  };
}

function validateTaskPatch(body, categories) {
  const errors = {};
  const normalized = {};

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      errors: { body: "Тело запроса должно быть объектом." },
      normalized,
    };
  }

  const keys = Object.keys(body);
  const allowed = new Set([
    "title",
    "priority",
    "categoryId",
    "completed",
  ]);

  if (keys.length === 0) {
    errors.body = "PATCH должен содержать хотя бы одно поле.";
  }

  for (const key of keys) {
    if (!allowed.has(key)) {
      errors[key] = `Неизвестное поле ${key}.`;
    }
  }

  if ("title" in body) {
    if (typeof body.title !== "string") {
      errors.title = "Название должно быть строкой.";
    } else {
      const title = body.title.trim();

      if (title.length < 1 || title.length > 100) {
        errors.title = "Название должно содержать от 1 до 100 символов.";
      } else {
        normalized.title = title;
      }
    }
  }

  if ("priority" in body) {
    if (!PRIORITIES.has(body.priority)) {
      errors.priority = "Приоритет должен быть low, medium или high.";
    } else {
      normalized.priority = body.priority;
    }
  }

  if ("categoryId" in body) {
    if (
      !Number.isSafeInteger(body.categoryId)
      || !categories.some((category) => category.id === body.categoryId)
    ) {
      errors.categoryId = "Категория не найдена.";
    } else {
      normalized.categoryId = body.categoryId;
    }
  }

  if ("completed" in body) {
    if (typeof body.completed !== "boolean") {
      errors.completed = "completed должен быть boolean.";
    } else {
      normalized.completed = body.completed;
    }
  }

  return {
    errors,
    normalized,
  };
}

async function readJsonBody(req) {
  const contentType = req.headers["content-type"] ?? "";

  if (!/^application\/json\b/i.test(contentType)) {
    const error = new Error("Ожидается application/json.");
    error.status = 415;
    error.code = "UNSUPPORTED_MEDIA_TYPE";
    throw error;
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      const error = new Error("Тело запроса слишком большое.");
      error.status = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }

    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");

  try {
    return text === ""
      ? null
      : JSON.parse(text);
  } catch {
    const error = new Error("Не удалось разобрать JSON.");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

function cloneSeedTasks() {
  return seedTasks.map((task) => ({ ...task }));
}

function cloneSeedCategories() {
  return seedCategories.map((category) => ({ ...category }));
}

export function createApiServer() {
  let tasks = cloneSeedTasks();
  const categories = cloneSeedCategories();
  let nextId = 35;

  function resetState() {
    tasks = cloneSeedTasks();
    nextId = 35;
  }

  return http.createServer(async (req, res) => {
    const head = req.method === "HEAD";
    let url;

    try {
      url = new URL(req.url, `http://${HOST}`);
    } catch {
      sendError(res, 400, "BAD_REQUEST", "Неверный URL.");
      return;
    }

    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      sendEmpty(res, 204);
      return;
    }

    if (!pathname.startsWith("/api")) {
      sendError(res, 404, "ROUTE_NOT_FOUND", `Маршрут ${pathname} не найден.`);
      return;
    }

    const route = pathname.slice(4) || "/";

    try {
      if (route === "/health") {
        if (req.method !== "GET" && !head) {
          sendError(
            res,
            405,
            "METHOD_NOT_ALLOWED",
            "Метод не поддерживается.",
            undefined,
            head,
            { Allow: "GET, HEAD, OPTIONS" },
          );
          return;
        }

        sendJson(
          res,
          200,
          { data: { status: "ok" } },
          head,
        );
        return;
      }

      if (route === "/debug/error" && req.method === "GET") {
        sendError(
          res,
          503,
          "SERVICE_UNAVAILABLE",
          "Учебный сервис временно недоступен.",
        );
        return;
      }

      if (route === "/debug/invalid-json" && req.method === "GET") {
        sendRaw(
          res,
          200,
          "{broken",
          "application/json; charset=utf-8",
        );
        return;
      }

      if (route === "/debug/text" && req.method === "GET") {
        sendRaw(
          res,
          200,
          "plain text",
          "text/plain; charset=utf-8",
        );
        return;
      }

      if (route === "/debug/delay" && req.method === "GET") {
        const raw = url.searchParams.get("ms") ?? "100";
        const ms = Number(raw);

        if (!Number.isInteger(ms) || ms < 0 || ms > 5000) {
          sendError(
            res,
            400,
            "INVALID_QUERY",
            "ms должен быть целым числом от 0 до 5000.",
          );
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, ms));
        sendJson(res, 200, { data: { delayedMs: ms } });
        return;
      }

      if (route === "/debug/reset") {
        if (req.method !== "POST") {
          sendError(
            res,
            405,
            "METHOD_NOT_ALLOWED",
            "Метод не поддерживается.",
            undefined,
            false,
            { Allow: "POST, OPTIONS" },
          );
          return;
        }

        resetState();
        sendJson(
          res,
          200,
          { data: { reset: true, total: tasks.length } },
        );
        return;
      }

      if (route === "/categories") {
        if (req.method !== "GET" && !head) {
          sendError(
            res,
            405,
            "METHOD_NOT_ALLOWED",
            "Метод не поддерживается.",
            undefined,
            head,
            { Allow: "GET, HEAD, OPTIONS" },
          );
          return;
        }

        sendJson(
          res,
          200,
          {
            data: categories,
            meta: { total: categories.length },
          },
          head,
        );
        return;
      }

      if (route === "/tasks") {
        if (req.method === "GET" || head) {
          let filters;

          try {
            filters = parseFilters(url.searchParams);
          } catch (error) {
            sendError(
              res,
              400,
              "INVALID_QUERY",
              error.message,
            );
            return;
          }

          let filtered = [...tasks];

          if ("completed" in filters) {
            filtered = filtered.filter((task) => task.completed === filters.completed);
          }

          if ("priority" in filters) {
            filtered = filtered.filter((task) => task.priority === filters.priority);
          }

          if ("categoryId" in filters) {
            filtered = filtered.filter((task) => task.categoryId === filters.categoryId);
          }

          if ("q" in filters) {
            const query = filters.q.toLocaleLowerCase("ru-RU");
            filtered = filtered.filter((task) => task.title.toLocaleLowerCase("ru-RU").includes(query));
          }

          sendJson(
            res,
            200,
            {
              data: filtered,
              meta: {
                total: filtered.length,
                filters,
              },
            },
            head,
          );
          return;
        }

        if (req.method === "POST") {
          let body;

          try {
            body = await readJsonBody(req);
          } catch (error) {
            sendError(
              res,
              error.status ?? 400,
              error.code ?? "INVALID_JSON",
              error.message,
            );
            return;
          }

          const result = validateTaskDraft(body, categories);

          if (Object.keys(result.errors).length > 0) {
            sendError(
              res,
              400,
              "VALIDATION_ERROR",
              "Данные задачи не прошли проверку.",
              result.errors,
            );
            return;
          }

          const task = {
            id: nextId,
            title: result.normalized.title,
            completed: false,
            priority: result.normalized.priority,
            categoryId: result.normalized.categoryId,
          };

          nextId += 1;
          tasks.push(task);

          sendJson(
            res,
            201,
            { data: task },
            false,
            { Location: `/api/tasks/${task.id}` },
          );
          return;
        }

        sendError(
          res,
          405,
          "METHOD_NOT_ALLOWED",
          "Метод не поддерживается.",
          undefined,
          head,
          { Allow: "GET, HEAD, POST, OPTIONS" },
        );
        return;
      }

      const taskMatch = route.match(/^\/tasks\/(.+)$/);

      if (taskMatch) {
        const id = parsePositiveId(taskMatch[1]);

        if (id === null) {
          sendError(
            res,
            400,
            "INVALID_ID",
            "Идентификатор задачи некорректен.",
          );
          return;
        }

        const index = tasks.findIndex((task) => task.id === id);

        if (index === -1) {
          sendError(
            res,
            404,
            "TASK_NOT_FOUND",
            `Задача с id ${id} не найдена.`,
            { id },
          );
          return;
        }

        if (req.method === "GET" || head) {
          sendJson(
            res,
            200,
            { data: tasks[index] },
            head,
          );
          return;
        }

        if (req.method === "PATCH") {
          let body;

          try {
            body = await readJsonBody(req);
          } catch (error) {
            sendError(
              res,
              error.status ?? 400,
              error.code ?? "INVALID_JSON",
              error.message,
            );
            return;
          }

          const result = validateTaskPatch(body, categories);

          if (Object.keys(result.errors).length > 0) {
            sendError(
              res,
              400,
              "VALIDATION_ERROR",
              "Данные задачи не прошли проверку.",
              result.errors,
            );
            return;
          }

          tasks[index] = {
            ...tasks[index],
            ...result.normalized,
          };

          sendJson(
            res,
            200,
            { data: tasks[index] },
          );
          return;
        }

        if (req.method === "DELETE") {
          tasks.splice(index, 1);
          sendEmpty(res, 204);
          return;
        }

        sendError(
          res,
          405,
          "METHOD_NOT_ALLOWED",
          "Метод не поддерживается.",
          undefined,
          head,
          { Allow: "GET, HEAD, PATCH, DELETE, OPTIONS" },
        );
        return;
      }

      sendError(
        res,
        404,
        "ROUTE_NOT_FOUND",
        `Маршрут /api${route} не найден.`,
      );
    } catch (error) {
      sendError(
        res,
        500,
        "INTERNAL_ERROR",
        "Внутренняя ошибка учебного API.",
        { message: error.message },
      );
    }
  });
}

export function readPort(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new TypeError("Порт API должен быть целым числом от 1 до 65535.");
  }

  return port;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  let port;

  try {
    port = readPort(process.argv[2] ?? process.env.API_PORT);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const server = createApiServer();

  server.once("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `API: порт ${port} занят.`
        : error.message,
    );
    process.exitCode = 1;
  });

  server.listen(port, HOST, () => {
    console.log(`Учебный API ПР6: http://${HOST}:${port}/api`);
    console.log("Остановка: Ctrl+C.");
  });
}
