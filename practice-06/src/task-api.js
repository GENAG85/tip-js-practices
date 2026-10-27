import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set([
  "low",
  "medium",
  "high",
]);

const ALLOWED_FILTERS = new Set([
  "completed",
  "priority",
  "categoryId",
  "q",
]);

function invalidResponse(message) {
  return new ApiError(
    message,
    { kind: "invalid-response" },
  );
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function hasUniqueIds(items) {
  const ids = items.map((item) => item.id);
  return new Set(ids).size === ids.length;
}

function normalizeFilters(filters = {}) {
  if (
    filters === null
    || typeof filters !== "object"
    || Array.isArray(filters)
  ) {
    throw new TypeError("filters должен быть объектом.");
  }

  for (const name of Object.keys(filters)) {
    if (!ALLOWED_FILTERS.has(name)) {
      throw new TypeError(`Неизвестный фильтр: ${name}.`);
    }
  }

  const normalized = {};

  if ("completed" in filters) {
    if (typeof filters.completed !== "boolean") {
      throw new TypeError("completed должен быть boolean.");
    }

    normalized.completed = filters.completed;
  }

  if ("priority" in filters) {
    if (!ALLOWED_PRIORITIES.has(filters.priority)) {
      throw new TypeError("priority должен быть low, medium или high.");
    }

    normalized.priority = filters.priority;
  }

  if ("categoryId" in filters) {
    if (!isPositiveSafeInteger(filters.categoryId)) {
      throw new TypeError("categoryId должен быть положительным целым числом.");
    }

    normalized.categoryId = filters.categoryId;
  }

  if ("q" in filters) {
    if (typeof filters.q !== "string") {
      throw new TypeError("q должен быть строкой.");
    }

    const q = filters.q.trim();

    if (q.length > 100) {
      throw new TypeError("q не должен быть длиннее 100 символов.");
    }

    if (q !== "") {
      normalized.q = q;
    }
  }

  return normalized;
}

function validateTaskCollection(payload) {
  if (
    !payload
    || typeof payload !== "object"
    || !Array.isArray(payload.data)
    || !payload.meta
    || typeof payload.meta !== "object"
  ) {
    throw invalidResponse("Неверная структура ответа со списком задач.");
  }

  if (!payload.data.every(isTask)) {
    throw invalidResponse("В ответе присутствует некорректная задача.");
  }

  if (!hasUniqueIds(payload.data)) {
    throw invalidResponse("В ответе повторяются id задач.");
  }

  if (
    !Number.isSafeInteger(payload.meta.total)
    || payload.meta.total !== payload.data.length
  ) {
    throw invalidResponse("meta.total не соответствует количеству задач.");
  }

  return {
    tasks: payload.data,
    meta: payload.meta,
  };
}

function validateSingleTask(payload) {
  if (
    !payload
    || typeof payload !== "object"
    || !isTask(payload.data)
  ) {
    throw invalidResponse("Неверная структура ответа с задачей.");
  }

  return payload.data;
}

function validateCategories(payload) {
  if (
    !payload
    || typeof payload !== "object"
    || !Array.isArray(payload.data)
  ) {
    throw invalidResponse("Неверная структура ответа с категориями.");
  }

  if (!payload.data.every(isCategory)) {
    throw invalidResponse("В ответе присутствует некорректная категория.");
  }

  if (!hasUniqueIds(payload.data)) {
    throw invalidResponse("В ответе повторяются id категорий.");
  }

  if (
    payload.meta !== undefined
    && (
      !payload.meta
      || typeof payload.meta !== "object"
      || payload.meta.total !== payload.data.length
    )
  ) {
    throw invalidResponse("meta.total не соответствует количеству категорий.");
  }

  return payload.data;
}

function requirePositiveId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id должен быть положительным целым числом.");
  }
}

function dataOptions(signal, extra = {}) {
  return signal === undefined
    ? extra
    : { ...extra, signal };
}

export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("Клиент должен содержать функцию requestJson.");
  }

  async function getTasks(filters = {}, { signal } = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson(
      "/tasks",
      dataOptions(signal, { query }),
    );

    return validateTaskCollection(payload);
  }

  async function getTaskById(id, { signal } = {}) {
    requirePositiveId(id);

    const payload = await client.requestJson(
      `/tasks/${id}`,
      dataOptions(signal),
    );

    return validateSingleTask(payload);
  }

  async function getCategories({ signal } = {}) {
    const payload = await client.requestJson(
      "/categories",
      dataOptions(signal),
    );

    return validateCategories(payload);
  }

  async function loadInitialData(filters = {}, { signal } = {}) {
    const [taskResult, categories] = await Promise.all([
      getTasks(filters, { signal }),
      getCategories({ signal }),
    ]);

    return {
      tasks: taskResult.tasks,
      categories,
      meta: taskResult.meta,
    };
  }

  async function createTask(draft, { signal } = {}) {
    const payload = await client.requestJson(
      "/tasks",
      dataOptions(signal, {
        method: "POST",
        body: draft,
      }),
    );

    return validateSingleTask(payload);
  }

  async function updateTask(id, changes, { signal } = {}) {
    requirePositiveId(id);

    const payload = await client.requestJson(
      `/tasks/${id}`,
      dataOptions(signal, {
        method: "PATCH",
        body: changes,
      }),
    );

    return validateSingleTask(payload);
  }

  async function setTaskCompleted(id, completed, { signal } = {}) {
    requirePositiveId(id);

    if (typeof completed !== "boolean") {
      throw new TypeError("completed должен быть boolean.");
    }

    const payload = await client.requestJson(
      `/tasks/${id}`,
      dataOptions(signal, {
        method: "PATCH",
        body: { completed },
      }),
    );

    return validateSingleTask(payload);
  }

  async function deleteTask(id, { signal } = {}) {
    requirePositiveId(id);

    const result = await client.requestJson(
      `/tasks/${id}`,
      dataOptions(signal, {
        method: "DELETE",
      }),
    );

    if (result !== null) {
      throw invalidResponse("DELETE должен вернуть ответ без тела.");
    }

    return null;
  }

  async function resetDemoData({ signal } = {}) {
    const payload = await client.requestJson(
      "/debug/reset",
      dataOptions(signal, {
        method: "POST",
      }),
    );

    if (
      !payload
      || typeof payload !== "object"
      || !payload.data
      || payload.data.reset !== true
      || !Number.isSafeInteger(payload.data.total)
    ) {
      throw invalidResponse("Неверный ответ операции reset.");
    }

    return payload.data;
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}
