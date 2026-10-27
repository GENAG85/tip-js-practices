import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) {
    return "Не удалось выполнить операцию.";
  }

  if (error.kind === "timeout") {
    return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  }

  if (error.kind === "network") {
    return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  }

  if (error.kind === "invalid-response") {
    return "Сервер вернул ответ неожиданного формата.";
  }

  if (error.kind === "http" && error.status === 404) {
    return "Запись уже отсутствует на сервере. Обновите список.";
  }

  if (error.kind === "http") {
    return error.message || `Сервер вернул ошибку ${error.status}.`;
  }

  return "Не удалось выполнить операцию.";
}

const API_METHODS = [
  "loadInitialData",
  "getTasks",
  "createTask",
  "updateTask",
  "setTaskCompleted",
  "deleteTask",
  "resetDemoData",
];

const VIEW_METHODS = [
  "setListState",
  "setTasks",
  "setCategories",
  "setTotal",
  "setFormTask",
  "showFormErrors",
  "setMutationPending",
  "notify",
];

function hasMethods(value, names) {
  return value
    && typeof value === "object"
    && names.every((name) => typeof value[name] === "function");
}

export function createAppController({
  api,
  view,
  validateDraft = validateTaskDraft,
} = {}) {
  if (!hasMethods(api, API_METHODS)) {
    throw new TypeError("Передан некорректный объект api.");
  }

  if (!hasMethods(view, VIEW_METHODS)) {
    throw new TypeError("Передан некорректный объект view.");
  }

  if (typeof validateDraft !== "function") {
    throw new TypeError("validateDraft должен быть функцией.");
  }

  let tasks = [];
  let categories = [];
  let filters = {};
  let editingId = null;
  let activeLoad = null;
  let loadSequence = 0;
  let destroyed = false;

  function isCurrentLoad(sequence) {
    return !destroyed && sequence === loadSequence;
  }

  async function loadCurrentTasks() {
    if (destroyed) {
      return;
    }

    if (activeLoad) {
      activeLoad.abort();
    }

    const controller = new AbortController();
    activeLoad = controller;
    const sequence = ++loadSequence;

    view.setListState("loading");

    try {
      if (categories.length === 0) {
        const result = await api.loadInitialData(
          filters,
          { signal: controller.signal },
        );

        if (!isCurrentLoad(sequence)) {
          return;
        }

        tasks = result.tasks;
        categories = result.categories;
        view.setCategories(categories);
        view.setTasks(tasks, categories);
        view.setTotal(result.meta.total);
      } else {
        const result = await api.getTasks(
          filters,
          { signal: controller.signal },
        );

        if (!isCurrentLoad(sequence)) {
          return;
        }

        tasks = result.tasks;
        view.setTasks(tasks, categories);
        view.setTotal(result.meta.total);
      }

      if (!isCurrentLoad(sequence)) {
        return;
      }

      view.setListState(
        tasks.length === 0
          ? "empty"
          : "ready",
      );
    } catch (error) {
      if (!isCurrentLoad(sequence)) {
        return;
      }

      if (error instanceof ApiError && error.kind === "aborted") {
        return;
      }

      view.setTotal(0);
      view.setListState(
        "error",
        messageForError(error),
      );
    } finally {
      if (activeLoad === controller) {
        activeLoad = null;
      }
    }
  }

  async function runMutation(action, successMessage) {
    view.setMutationPending(true);

    try {
      await action();
      view.notify(successMessage, "success");
      await loadCurrentTasks();
    } catch (error) {
      view.notify(
        messageForError(error),
        "error",
      );
    } finally {
      view.setMutationPending(false);
    }
  }

  async function start(initialFilters = {}) {
    filters = { ...initialFilters };
    await loadCurrentTasks();
  }

  async function applyFilters(nextFilters = {}) {
    filters = { ...nextFilters };
    await loadCurrentTasks();
  }

  async function refresh() {
    await loadCurrentTasks();
  }

  async function submit(draft) {
    const result = validateDraft(
      draft,
      categories,
    );

    view.showFormErrors(result.errors);

    if (!result.valid) {
      return;
    }

    if (editingId === null) {
      await runMutation(
        () => api.createTask(result.value),
        "Задача добавлена.",
      );

      view.setFormTask(null);
      view.showFormErrors({});
      return;
    }

    const id = editingId;

    await runMutation(
      () => api.updateTask(id, result.value),
      "Изменения сохранены.",
    );

    editingId = null;
    view.setFormTask(null);
    view.showFormErrors({});
  }

  function beginEdit(id) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      view.notify(
        "Задача не найдена в текущем списке.",
        "error",
      );
      return;
    }

    editingId = id;
    view.showFormErrors({});
    view.setFormTask(task);
  }

  function cancelEdit() {
    editingId = null;
    view.showFormErrors({});
    view.setFormTask(null);
  }

  async function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);

    if (!task) {
      view.notify(
        "Задача не найдена в текущем списке.",
        "error",
      );
      return;
    }

    await runMutation(
      () => api.setTaskCompleted(
        id,
        !task.completed,
      ),
      "Статус задачи изменён.",
    );
  }

  async function deleteTask(id) {
    await runMutation(
      () => api.deleteTask(id),
      "Задача удалена.",
    );

    if (editingId === id) {
      cancelEdit();
    }
  }

  async function resetData() {
    await runMutation(
      () => api.resetDemoData(),
      "Учебные данные восстановлены.",
    );

    editingId = null;
    view.setFormTask(null);
    view.showFormErrors({});
  }

  function destroy() {
    destroyed = true;
    loadSequence += 1;

    if (activeLoad) {
      activeLoad.abort();
      activeLoad = null;
    }
  }

  return {
    start,
    applyFilters,
    refresh,
    submit,
    beginEdit,
    cancelEdit,
    toggleTask,
    deleteTask,
    resetData,
    destroy,
  };
}
