const ALLOWED_PRIORITIES = new Set([
  "low",
  "medium",
  "high",
]);

export function validateTaskDraft(draft, categories) {
  const errors = {};
  const value = {};

  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return {
      valid: false,
      value: {},
      errors: {
        title: "Введите название задачи.",
        priority: "Выберите приоритет.",
        categoryId: "Выберите категорию.",
      },
    };
  }

  if (typeof draft.title !== "string") {
    errors.title = "Название задачи должно быть строкой.";
  } else {
    const title = draft.title.trim();

    if (title.length < 1 || title.length > 100) {
      errors.title = "Название должно содержать от 1 до 100 символов.";
    } else {
      value.title = title;
    }
  }

  if (!ALLOWED_PRIORITIES.has(draft.priority)) {
    errors.priority = "Приоритет должен быть low, medium или high.";
  } else {
    value.priority = draft.priority;
  }

  const categoryId = typeof draft.categoryId === "string"
    && draft.categoryId.trim() !== ""
    ? Number(draft.categoryId)
    : draft.categoryId;

  const categoryExists = Number.isSafeInteger(categoryId)
    && categoryId > 0
    && Array.isArray(categories)
    && categories.some((category) => category.id === categoryId);

  if (!categoryExists) {
    errors.categoryId = "Выберите существующую категорию.";
  } else {
    value.categoryId = categoryId;
  }

  return {
    valid: Object.keys(errors).length === 0,
    value,
    errors,
  };
}
