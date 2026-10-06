const ALLOWED_PRIORITIES = ["low", "medium", "high"];

function validateId(id) {
  if (!Number.isSafeInteger(id) || id <= 0) {
    return "Идентификатор должен быть положительным безопасным целым числом";
  }
  return null;
}

function normalizeTitle(title) {
  if (typeof title !== "string") {
    return { ok: false, error: "Название задачи должно быть строкой" };
  }

  const normalized = title.trim();

  if (normalized.length < 1 || normalized.length > 100) {
    return { ok: false, error: "Длина названия после удаления краевых пробелов должна быть от 1 до 100 символов" };
  }

  return { ok: true, title: normalized };
}

function validatePriority(priority) {
  if (!ALLOWED_PRIORITIES.includes(priority)) {
    return "Приоритет должен быть одним из значений: low, medium, high";
  }
  return null;
}

export function createTask(id, title, priority = "medium") {
  const idError = validateId(id);
  if (idError) {
    return { ok: false, error: idError };
  }

  const titleResult = normalizeTitle(title);
  if (!titleResult.ok) {
    return titleResult;
  }

  const priorityError = validatePriority(priority);
  if (priorityError) {
    return { ok: false, error: priorityError };
  }

  return {
    ok: true,
    task: {
      id,
      title: titleResult.title,
      completed: false,
      priority,
    },
  };
}

export function findTaskById(tasks, id) {
  return tasks.find((task) => task.id === id);
}

export function getPendingTasks(tasks) {
  return tasks.filter((task) => task.completed === false);
}

export function getTaskTitles(tasks) {
  return tasks.map((task) => task.title);
}

export function getTaskStats(tasks) {
  const total = tasks.length;
  let completed = 0;

  for (const task of tasks) {
    if (task.completed === true) {
      completed += 1;
    }
  }

  const pending = total - completed;
  const progress = total === 0 ? 0 : (completed / total) * 100;

  return { total, completed, pending, progress };
}

export function addTask(tasks, id, title, priority = "medium") {
  const createResult = createTask(id, title, priority);
  if (!createResult.ok) {
    return createResult;
  }

  if (findTaskById(tasks, id) !== undefined) {
    return { ok: false, error: `Задача с id ${id} уже существует` };
  }

  return {
    ok: true,
    tasks: [...tasks, createResult.task],
  };
}

export function setTaskCompleted(tasks, id, completed) {
  const idError = validateId(id);
  if (idError) {
    return { ok: false, error: idError };
  }

  if (typeof completed !== "boolean") {
    return { ok: false, error: "Поле completed должно иметь тип boolean" };
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: `Задача с id ${id} не найдена` };
  }

  const nextTasks = tasks.map((task) =>
    task.id === id ? { ...task, completed } : task,
  );

  return { ok: true, tasks: nextTasks };
}

export function renameTask(tasks, id, title) {
  const idError = validateId(id);
  if (idError) {
    return { ok: false, error: idError };
  }

  const titleResult = normalizeTitle(title);
  if (!titleResult.ok) {
    return titleResult;
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: `Задача с id ${id} не найдена` };
  }

  const nextTasks = tasks.map((task) =>
    task.id === id ? { ...task, title: titleResult.title } : task,
  );

  return { ok: true, tasks: nextTasks };
}

export function removeTask(tasks, id) {
  const idError = validateId(id);
  if (idError) {
    return { ok: false, error: idError };
  }

  if (findTaskById(tasks, id) === undefined) {
    return { ok: false, error: `Задача с id ${id} не найдена` };
  }

  return {
    ok: true,
    tasks: tasks.filter((task) => task.id !== id),
  };
}
