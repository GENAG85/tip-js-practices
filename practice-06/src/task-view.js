const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;

  const span = document.createElement("span");
  span.className = "action-label";
  span.textContent = label;

  button.append(span);
  return button;
}

export function createTaskElement(task, category) {
  const item = document.createElement("li");
  item.className = "task-card";
  item.dataset.taskId = String(task.id);

  if (task.completed) {
    item.classList.add("is-completed");
  }

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const status = document.createElement("span");
  status.className = "task-status";
  status.textContent = task.completed
    ? "Выполнено"
    : "В работе";

  const priority = document.createElement("span");
  priority.className = "task-priority";
  priority.textContent = PRIORITY_LABELS[task.priority] ?? task.priority;

  const categoryName = document.createElement("span");
  categoryName.className = "task-category";
  categoryName.textContent = category?.name ?? "Категория не найдена";

  meta.append(
    status,
    priority,
    categoryName,
  );

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    createActionButton(
      "toggle",
      task.completed
        ? "Вернуть в работу"
        : "Выполнена",
    ),
    createActionButton("edit", "Изменить"),
    createActionButton("delete", "Удалить"),
  );

  item.append(
    title,
    meta,
    actions,
  );

  return item;
}

export function renderTaskList(list, tasks, categories) {
  const categoriesById = new Map(
    categories.map((category) => [
      category.id,
      category,
    ]),
  );

  const elements = tasks.map((task) => createTaskElement(
    task,
    categoriesById.get(task.categoryId),
  ));

  list.replaceChildren(...elements);
}
