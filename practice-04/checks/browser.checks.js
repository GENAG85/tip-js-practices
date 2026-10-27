import { getVisibleTasks } from "../src/task-selectors.js";
import {
  createTaskElement,
  renderEmptyState,
  renderSummary,
  renderTaskList,
} from "../src/task-view.js";

const results = document.querySelector("#check-results");
const log = document.querySelector("#check-log");
const summary = document.querySelector("#check-summary");
const fixtureRoot = document.querySelector("#test-fixture");
const frame = document.querySelector("#test-frame");

let passed = 0;
let failed = 0;
let loadNumber = 0;

const transcript = [];

const keyFor = (dataset = "demo") =>
  `tip-js-practice-04:checks:${dataset}`;

function assert(condition, message = "Условие не выполнено") {
  if (!condition) {
    throw new Error(message);
  }
}

function same(actual, expected, message = "Результаты отличаются") {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
  );
}

async function check(name, fn) {
  fixtureRoot.replaceChildren();

  const item = document.createElement("li");

  try {
    await fn();
    passed += 1;
    item.className = "check-pass";
    item.textContent = `OK: ${name}`;
  } catch (error) {
    failed += 1;
    item.className = "check-fail";
    item.textContent = `FAIL: ${name} — ${error.message}`;
  }

  results.append(item);
  transcript.push(item.textContent);
  log.textContent = transcript.join("\n");
}

const tasks = () => [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];

const requireNode = (root, selector) => {
  const node = root.querySelector(selector);
  assert(node, `Не найден ${selector}`);
  return node;
};

const visibleIds = (doc) =>
  [...doc.querySelectorAll("#task-list > [data-task-id]")].map(
    (node) => Number(node.dataset.taskId),
  );

const readStats = (doc) =>
  ["total", "completed", "pending", "progress", "visible"].map(
    (name) =>
      requireNode(
        doc,
        `[data-stat="${name}"]`,
      ).textContent.trim(),
  );

const click = (doc, selector) => {
  requireNode(doc, selector).click();
};

function inputValue(doc, selector, value) {
  const node = requireNode(doc, selector);
  node.value = value;

  node.dispatchEvent(
    new node.ownerDocument.defaultView.Event(
      "input",
      { bubbles: true },
    ),
  );
}

function submitForm(doc, { id, title, priority }) {
  if (id !== undefined) {
    inputValue(doc, "#task-id", String(id));
  }

  if (title !== undefined) {
    inputValue(doc, "#task-title", title);
  }

  if (priority !== undefined) {
    inputValue(doc, "#task-priority", priority);
  }

  requireNode(doc, "#task-form").requestSubmit();
}

function storedTasks(dataset = "demo") {
  const raw = localStorage.getItem(keyFor(dataset));
  assert(raw !== null, "Нет записи localStorage");
  return JSON.parse(raw).tasks;
}

function freshApp({ dataset = "demo", keepStorage = false, raw } = {}) {
  loadNumber += 1;

  const key = keyFor(dataset);

  if (!keepStorage) {
    localStorage.removeItem(key);
  }

  if (raw !== undefined) {
    localStorage.setItem(key, raw);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Приложение не загрузилось")),
      8000,
    );

    frame.addEventListener(
      "load",
      () => {
        clearTimeout(timer);

        const doc = frame.contentDocument;
        if (!doc?.querySelector("#task-form")) {
          reject(new Error("Нет формы"));
          return;
        }

        resolve(doc);
      },
      { once: true },
    );

    const variantPart = dataset === "variant"
      ? "&dataset=variant"
      : "";

    frame.src =
      `./index.html?mode=check&run=${loadNumber}${variantPart}`;
  });
}

await check(
  "01 Фильтр all",
  () => {
    same(
      getVisibleTasks(tasks(), "all").map((task) => task.id),
      [1, 4, 7, 10],
    );
  },
);

await check(
  "02 Фильтр pending",
  () => {
    same(
      getVisibleTasks(tasks(), "pending").map((task) => task.id),
      [4, 7],
    );
  },
);

await check(
  "03 Фильтр completed",
  () => {
    same(
      getVisibleTasks(tasks(), "completed").map((task) => task.id),
      [1, 10],
    );
  },
);

await check(
  "04 Карточка имеет три действия",
  () => {
    const node = createTaskElement(tasks()[1]);

    for (const action of ["toggle", "edit", "delete"]) {
      assert(
        node.querySelector(`button[data-action="${action}"]`),
      );
    }

    same(node.querySelectorAll("button").length, 3);
  },
);

await check(
  "05 Название выводится через textContent",
  () => {
    const title = '<img src=x onerror="alert(1)">';
    const node = createTaskElement({
      ...tasks()[0],
      title,
    });

    same(
      node.querySelector(".task-title").textContent,
      title,
    );

    same(
      node.querySelector(".task-title").children.length,
      0,
    );
  },
);

await check(
  "06 renderTaskList не накапливает",
  () => {
    const list = document.createElement("ul");

    renderTaskList(list, tasks());
    renderTaskList(list, tasks().slice(1));

    same(
      [...list.children].map(
        (node) => Number(node.dataset.taskId),
      ),
      [4, 7, 10],
    );
  },
);

await check(
  "07 renderSummary",
  () => {
    const root = document.createElement("div");

    for (const name of ["total", "completed", "pending", "progress", "visible"]) {
      const span = document.createElement("span");
      span.dataset.stat = name;
      root.append(span);
    }

    renderSummary(root, tasks(), 2);

    same(
      [...root.children].map((node) => node.textContent),
      ["4", "2", "2", "50.0%", "2"],
    );
  },
);

await check(
  "08 renderEmptyState",
  () => {
    const message = document.createElement("p");

    renderEmptyState(message, 0, 0);
    assert(!message.hidden);

    renderEmptyState(message, 4, 2);
    assert(message.hidden);
  },
);

await check(
  "09 Стартовый набор",
  async () => {
    const doc = await freshApp();

    same(visibleIds(doc), [1, 4, 7, 10]);
    same(
      readStats(doc),
      ["4", "2", "2", "50.0%", "4"],
    );
  },
);

await check(
  "10 Добавление и сохранение",
  async () => {
    const doc = await freshApp();

    submitForm(doc, {
      id: 20,
      title: "  Изучить localStorage  ",
      priority: "high",
    });

    same(visibleIds(doc), [1, 4, 7, 10, 20]);
    same(
      storedTasks().map((task) => task.id),
      [1, 4, 7, 10, 20],
    );
  },
);

await check(
  "11 Дубликат id отклоняется",
  async () => {
    const doc = await freshApp();

    submitForm(doc, {
      id: 4,
      title: "Дубликат",
      priority: "low",
    });

    same(visibleIds(doc), [1, 4, 7, 10]);

    assert(
      requireNode(doc, "#task-id").getAttribute("aria-invalid") === "true",
    );

    same(
      localStorage.getItem(keyFor()),
      null,
    );
  },
);

await check(
  "12 Пробелы в title отклоняются",
  async () => {
    const doc = await freshApp();

    submitForm(doc, {
      id: 20,
      title: "   ",
      priority: "low",
    });

    assert(
      requireNode(doc, "#task-title").getAttribute("aria-invalid") === "true",
    );
  },
);

await check(
  "13 Нативная валидация пустой формы",
  async () => {
    const doc = await freshApp();

    requireNode(doc, "#task-form").requestSubmit();

    assert(
      !requireNode(doc, "#task-id").validity.valid,
    );
  },
);

await check(
  "14 Edit заполняет форму",
  async () => {
    const doc = await freshApp();

    click(
      doc,
      '[data-task-id="4"] [data-action="edit"]',
    );

    same(requireNode(doc, "#task-id").value, "4");
    assert(requireNode(doc, "#task-id").disabled);
    same(
      requireNode(doc, "#form-submit").textContent,
      "Сохранить изменения",
    );
  },
);

await check(
  "15 Редактирование сохраняет completed",
  async () => {
    const doc = await freshApp();

    click(
      doc,
      '[data-task-id="1"] [data-action="edit"]',
    );

    submitForm(doc, {
      title: "  Изучить формы  ",
      priority: "low",
    });

    assert(
      requireNode(doc, '[data-task-id="1"]').classList.contains("is-completed"),
    );

    same(
      storedTasks().find((task) => task.id === 1),
      {
        id: 1,
        title: "Изучить формы",
        completed: true,
        priority: "low",
      },
    );
  },
);

await check(
  "16 Отмена редактирования",
  async () => {
    const doc = await freshApp();

    click(
      doc,
      '[data-task-id="7"] [data-action="edit"]',
    );

    click(doc, "#cancel-edit");

    assert(!requireNode(doc, "#task-id").disabled);
    same(requireNode(doc, "#task-id").value, "");
    same(
      requireNode(doc, "#form-submit").textContent,
      "Добавить задачу",
    );
  },
);

await check(
  "17 Успех очищает форму",
  async () => {
    const doc = await freshApp();

    submitForm(doc, {
      id: 20,
      title: "Новая",
      priority: "medium",
    });

    same(requireNode(doc, "#task-id").value, "");
    same(requireNode(doc, "#task-title").value, "");
  },
);

await check(
  "18 Toggle сохраняется",
  async () => {
    const doc = await freshApp();

    click(
      doc,
      '[data-task-id="4"] [data-action="toggle"]',
    );

    assert(
      storedTasks().find((task) => task.id === 4).completed,
    );

    same(
      readStats(doc),
      ["4", "3", "1", "75.0%", "4"],
    );
  },
);

await check(
  "19 Delete сохраняется",
  async () => {
    const doc = await freshApp();

    click(
      doc,
      '[data-task-id="7"] [data-action="delete"]',
    );

    same(visibleIds(doc), [1, 4, 10]);
    same(
      storedTasks().map((task) => task.id),
      [1, 4, 10],
    );
  },
);

await check(
  "20 Фильтр сам не пишет storage",
  async () => {
    const doc = await freshApp();

    click(doc, '[data-filter="pending"]');

    same(
      localStorage.getItem(keyFor()),
      null,
    );

    click(
      doc,
      '[data-task-id="4"] [data-action="toggle"]',
    );

    same(visibleIds(doc), [7]);
  },
);

await check(
  "21 Перезагрузка восстанавливает",
  async () => {
    let doc = await freshApp();

    submitForm(doc, {
      id: 20,
      title: "Сохранённая",
      priority: "medium",
    });

    doc = await freshApp({
      keepStorage: true,
    });

    same(visibleIds(doc), [1, 4, 7, 10, 20]);

    assert(
      requireNode(doc, "#storage-status").textContent.includes("восстановлены"),
    );
  },
);

await check(
  "22 Сброс и повреждённый JSON",
  async () => {
    let doc = await freshApp();

    submitForm(doc, {
      id: 20,
      title: "Временная",
      priority: "medium",
    });

    click(doc, "#reset-data");

    same(visibleIds(doc), [1, 4, 7, 10]);
    same(
      localStorage.getItem(keyFor()),
      null,
    );

    doc = await freshApp({
      raw: "{broken-json",
    });

    same(visibleIds(doc), [1, 4, 7, 10]);

    assert(
      requireNode(doc, "#storage-status").classList.contains("is-warning"),
    );
  },
);

await check(
  "23 Ключи demo и variant разделены",
  async () => {
    localStorage.setItem(
      keyFor("demo"),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            id: 91,
            title: "Demo",
            completed: false,
            priority: "low",
          },
        ],
      }),
    );

    localStorage.setItem(
      keyFor("variant"),
      JSON.stringify({
        version: 1,
        tasks: [
          {
            id: 92,
            title: "Variant",
            completed: true,
            priority: "high",
          },
        ],
      }),
    );

    let doc = await freshApp({
      dataset: "demo",
      keepStorage: true,
    });

    same(visibleIds(doc), [91]);

    doc = await freshApp({
      dataset: "variant",
      keepStorage: true,
    });

    same(visibleIds(doc), [92]);
  },
);

localStorage.removeItem(keyFor("demo"));
localStorage.removeItem(keyFor("variant"));

summary.textContent =
  `Всего: ${passed + failed}. Пройдено: ${passed}. Ошибок: ${failed}.`;

summary.className = failed === 0
  ? "check-pass"
  : "check-fail";
