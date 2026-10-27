const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

export function validateTaskDraft(draft, tasks, editingId = null) {
  const errors = {};
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const safeTasks = Array.isArray(tasks) ? tasks : [];

  let id;
  if (editingId === null) {
    const rawId = safeDraft.id;
    const isEmpty = typeof rawId === "string" && rawId.trim() === "";
    id = isEmpty ? Number.NaN : Number(rawId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      errors.id = "Введите положительный целый идентификатор";
    } else if (safeTasks.some((task) => task.id === id)) {
      errors.id = `Задача с id ${id} уже существует`;
    }
  } else {
    id = editingId;
    if (!Number.isSafeInteger(id) || id <= 0) {
      errors.id = "Некорректный идентификатор редактируемой задачи";
    } else if (!safeTasks.some((task) => task.id === id)) {
      errors.id = `Задача с id ${id} не найдена`;
    }
  }

  let title;
  if (typeof safeDraft.title !== "string") {
    errors.title = "Название задачи должно быть строкой";
  } else {
    title = safeDraft.title.trim();
    if (title.length < 1 || title.length > 100) {
      errors.title = "Название после удаления пробелов должно содержать от 1 до 100 символов";
    }
  }

  const priority = safeDraft.priority;
  if (!ALLOWED_PRIORITIES.has(priority)) {
    errors.priority = "Выберите приоритет low, medium или high";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { id, title, priority } };
}
