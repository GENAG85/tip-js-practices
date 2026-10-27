export const STORAGE_VERSION = 1;
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function cloneTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

export function isValidTaskList(value) {
  if (!Array.isArray(value)) return false;

  const ids = new Set();
  for (const task of value) {
    if (!task || typeof task !== "object" || Array.isArray(task)) return false;
    if (!Number.isSafeInteger(task.id) || task.id <= 0 || ids.has(task.id)) return false;
    if (typeof task.title !== "string") return false;
    if (
      task.title.trim() !== task.title ||
      task.title.length < 1 ||
      task.title.length > 100
    ) {
      return false;
    }
    if (typeof task.completed !== "boolean") return false;
    if (!ALLOWED_PRIORITIES.has(task.priority)) return false;
    ids.add(task.id);
  }

  return true;
}

export function loadTasks(storage, key, fallbackTasks) {
  const fallback = Array.isArray(fallbackTasks) ? cloneTasks(fallbackTasks) : [];

  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return { ok: true, source: "initial", tasks: fallback };
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== STORAGE_VERSION) {
      return {
        ok: false,
        source: "fallback",
        tasks: fallback,
        error: "Сохранённые данные имеют неподдерживаемую версию",
      };
    }

    if (!isValidTaskList(parsed.tasks)) {
      return {
        ok: false,
        source: "fallback",
        tasks: fallback,
        error: "Сохранённые данные имеют некорректную структуру",
      };
    }

    return { ok: true, source: "storage", tasks: cloneTasks(parsed.tasks) };
  } catch (error) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: `Не удалось прочитать localStorage: ${error.message}`,
    };
  }
}

export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Некорректный список задач не сохранён" };
  }

  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Не удалось сохранить данные: ${error.message}` };
  }
}

export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Не удалось удалить сохранённые данные: ${error.message}` };
  }
}
