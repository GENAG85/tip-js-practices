import assert from "node:assert/strict";
import { updateTask } from "../src/task-service.js";
import { validateTaskDraft } from "../src/form-validation.js";
import {
  STORAGE_VERSION,
  isValidTaskList,
  loadTasks,
  removeSavedTasks,
  saveTasks,
} from "../src/task-storage.js";

const fixture = () => [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
    this.writes = 0;
    this.removes = 0;
  }

  getItem(key) {
    return this.values.has(key)
      ? this.values.get(key)
      : null;
  }

  setItem(key, value) {
    this.writes += 1;
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.removes += 1;
    this.values.delete(String(key));
  }
}

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}\n${error.message}`);
  }
}

const expectFailure = (result) => {
  assert.ok(result && typeof result === "object");
  assert.equal(result.ok, false);
};

const expectTasks = (result) => {
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.tasks));
  return result.tasks;
};

check(
  "01 updateTask меняет title и priority",
  () => {
    const tasks = expectTasks(
      updateTask(
        fixture(),
        4,
        "Новая формулировка",
        "low",
      ),
    );

    assert.deepEqual(
      tasks[1],
      {
        id: 4,
        title: "Новая формулировка",
        completed: false,
        priority: "low",
      },
    );
  },
);

check(
  "02 updateTask trim и completed",
  () => {
    const tasks = expectTasks(
      updateTask(
        fixture(),
        1,
        "  Обновлённая задача  ",
        "high",
      ),
    );

    assert.equal(tasks[0].title, "Обновлённая задача");
    assert.equal(tasks[0].completed, true);
  },
);

check(
  "03 updateTask иммутабелен",
  () => {
    const source = Object.freeze(
      fixture().map((task) => Object.freeze(task)),
    );

    const result = expectTasks(
      updateTask(
        source,
        7,
        "Другая",
        "medium",
      ),
    );

    assert.notEqual(result, source);
    assert.notEqual(result[2], source[2]);
    assert.equal(result[0], source[0]);
  },
);

check(
  "04 updateTask проверяет id",
  () => {
    const invalidIds = [
      0,
      -1,
      1.5,
      "4",
      777,
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const id of invalidIds) {
      expectFailure(
        updateTask(
          fixture(),
          id,
          "Название",
          "low",
        ),
      );
    }
  },
);

check(
  "05 updateTask проверяет title/priority",
  () => {
    const invalidTitles = [
      "",
      "   ",
      "x".repeat(101),
      null,
    ];

    for (const title of invalidTitles) {
      expectFailure(
        updateTask(
          fixture(),
          4,
          title,
          "low",
        ),
      );
    }

    const invalidPriorities = [
      "urgent",
      "HIGH",
      "",
      null,
    ];

    for (const priority of invalidPriorities) {
      expectFailure(
        updateTask(
          fixture(),
          4,
          "Название",
          priority,
        ),
      );
    }
  },
);

check(
  "06 validateTaskDraft нормализует",
  () => {
    assert.deepEqual(
      validateTaskDraft(
        {
          id: "20",
          title: "  Изучить localStorage  ",
          priority: "high",
        },
        fixture(),
      ),
      {
        ok: true,
        value: {
          id: 20,
          title: "Изучить localStorage",
          priority: "high",
        },
      },
    );
  },
);

check(
  "07 validateTaskDraft плохие id",
  () => {
    const invalidIds = [
      "",
      "0",
      "-1",
      "1.5",
      "4abc",
      Number.MAX_SAFE_INTEGER + 1,
    ];

    for (const id of invalidIds) {
      const result = validateTaskDraft(
        {
          id,
          title: "Название",
          priority: "low",
        },
        fixture(),
      );

      expectFailure(result);
      assert.equal(typeof result.errors.id, "string");
    }
  },
);

check(
  "08 validateTaskDraft дубликат",
  () => {
    const result = validateTaskDraft(
      {
        id: "4",
        title: "Название",
        priority: "low",
      },
      fixture(),
    );

    expectFailure(result);
    assert.ok(result.errors.id);
  },
);

check(
  "09 validateTaskDraft title",
  () => {
    const invalidTitles = [
      "",
      "   ",
      "x".repeat(101),
      null,
    ];

    for (const title of invalidTitles) {
      const result = validateTaskDraft(
        {
          id: 20,
          title,
          priority: "low",
        },
        fixture(),
      );

      expectFailure(result);
      assert.ok(result.errors.title);
    }

    assert.equal(
      validateTaskDraft(
        {
          id: 20,
          title: "x".repeat(100),
          priority: "low",
        },
        fixture(),
      ).ok,
      true,
    );
  },
);

check(
  "10 validateTaskDraft priority",
  () => {
    for (const priority of ["low", "medium", "high"]) {
      assert.equal(
        validateTaskDraft(
          {
            id: 20,
            title: "Название",
            priority,
          },
          fixture(),
        ).ok,
        true,
      );
    }

    for (const priority of ["urgent", "HIGH", " high ", "", null]) {
      expectFailure(
        validateTaskDraft(
          {
            id: 20,
            title: "Название",
            priority,
          },
          fixture(),
        ),
      );
    }
  },
);

check(
  "11 editingId важнее draft.id",
  () => {
    assert.deepEqual(
      validateTaskDraft(
        {
          id: "другой",
          title: "  Обновить форму  ",
          priority: "medium",
        },
        fixture(),
        4,
      ),
      {
        ok: true,
        value: {
          id: 4,
          title: "Обновить форму",
          priority: "medium",
        },
      },
    );
  },
);

check(
  "12 редактирование отсутствующего id",
  () => {
    const result = validateTaskDraft(
      {
        id: 777,
        title: "Название",
        priority: "medium",
      },
      fixture(),
      777,
    );

    expectFailure(result);
    assert.ok(result.errors.id);
  },
);

check(
  "13 валидация не мутирует вход",
  () => {
    const draft = Object.freeze({
      id: "20",
      title: "  Название  ",
      priority: "low",
    });

    const tasks = Object.freeze(
      fixture().map((task) => Object.freeze(task)),
    );

    assert.equal(
      validateTaskDraft(draft, tasks).ok,
      true,
    );

    assert.equal(
      draft.title,
      "  Название  ",
    );
  },
);

check(
  "14 isValidTaskList принимает корректное",
  () => {
    assert.equal(isValidTaskList(fixture()), true);
    assert.equal(isValidTaskList([]), true);
  },
);

check(
  "15 isValidTaskList отклоняет ошибки",
  () => {
    const invalidValues = [
      null,
      {},
      [
        {
          id: 1,
          title: "A",
          completed: "false",
          priority: "low",
        },
      ],
      [
        {
          id: 0,
          title: "A",
          completed: false,
          priority: "low",
        },
      ],
      [
        {
          id: 1,
          title: "   ",
          completed: false,
          priority: "low",
        },
      ],
      [
        {
          id: 1,
          title: "A",
          completed: false,
          priority: "urgent",
        },
      ],
      [
        {
          id: 1,
          title: "A",
          completed: false,
          priority: "low",
        },
        {
          id: 1,
          title: "B",
          completed: true,
          priority: "high",
        },
      ],
    ];

    for (const value of invalidValues) {
      assert.equal(isValidTaskList(value), false);
    }
  },
);

check(
  "16 loadTasks без записи даёт копию",
  () => {
    const fallback = fixture();
    const result = loadTasks(
      new MemoryStorage(),
      "tasks",
      fallback,
    );

    assert.equal(result.ok, true);
    assert.equal(result.source, "initial");
    assert.deepEqual(result.tasks, fallback);
    assert.notEqual(result.tasks, fallback);
    assert.notEqual(result.tasks[0], fallback[0]);
  },
);

check(
  "17 loadTasks читает запись",
  () => {
    const saved = fixture().slice(1);
    const storage = new MemoryStorage({
      tasks: JSON.stringify({
        version: STORAGE_VERSION,
        tasks: saved,
      }),
    });

    const result = loadTasks(
      storage,
      "tasks",
      fixture(),
    );

    assert.equal(result.source, "storage");
    assert.deepEqual(result.tasks, saved);
  },
);

check(
  "18 broken JSON fallback",
  () => {
    const result = loadTasks(
      new MemoryStorage({ tasks: "{broken" }),
      "tasks",
      fixture(),
    );

    expectFailure(result);
    assert.equal(result.source, "fallback");
    assert.deepEqual(result.tasks, fixture());
  },
);

check(
  "19 неизвестная версия fallback",
  () => {
    const storage = new MemoryStorage({
      tasks: JSON.stringify({
        version: 999,
        tasks: fixture(),
      }),
    });

    const result = loadTasks(
      storage,
      "tasks",
      fixture(),
    );

    expectFailure(result);
    assert.equal(result.source, "fallback");
  },
);

check(
  "20 плохая схема fallback",
  () => {
    const storage = new MemoryStorage({
      tasks: JSON.stringify({
        version: 1,
        tasks: [
          {
            id: 1,
            title: "A",
            completed: "нет",
            priority: "low",
          },
        ],
      }),
    });

    const result = loadTasks(
      storage,
      "tasks",
      fixture(),
    );

    expectFailure(result);
    assert.deepEqual(result.tasks, fixture());
  },
);

check(
  "21 ошибка getItem ловится",
  () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
    };

    const result = loadTasks(
      storage,
      "tasks",
      fixture(),
    );

    expectFailure(result);
    assert.equal(result.source, "fallback");
  },
);

check(
  "22 saveTasks пишет version/tasks",
  () => {
    const storage = new MemoryStorage();

    assert.deepEqual(
      saveTasks(storage, "tasks", fixture()),
      { ok: true },
    );

    assert.deepEqual(
      JSON.parse(storage.getItem("tasks")),
      {
        version: 1,
        tasks: fixture(),
      },
    );

    assert.equal(storage.writes, 1);
  },
);

check(
  "23 saveTasks не пишет плохой список",
  () => {
    const storage = new MemoryStorage();

    expectFailure(
      saveTasks(
        storage,
        "tasks",
        [{ id: 1 }],
      ),
    );

    assert.equal(storage.writes, 0);
  },
);

check(
  "24 ошибка setItem ловится",
  () => {
    const storage = {
      setItem() {
        throw new Error("quota");
      },
    };

    expectFailure(
      saveTasks(storage, "tasks", fixture()),
    );
  },
);

check(
  "25 removeSavedTasks удаляет один ключ",
  () => {
    const storage = new MemoryStorage({
      tasks: "value",
      other: "keep",
    });

    assert.deepEqual(
      removeSavedTasks(storage, "tasks"),
      { ok: true },
    );

    assert.equal(storage.getItem("tasks"), null);
    assert.equal(storage.getItem("other"), "keep");
    assert.equal(storage.removes, 1);
  },
);

check(
  "26 ошибка removeItem ловится",
  () => {
    const storage = {
      removeItem() {
        throw new Error("blocked");
      },
    };

    expectFailure(
      removeSavedTasks(storage, "tasks"),
    );
  },
);

check(
  "27 loadTasks не делит объекты с fallback",
  () => {
    const fallback = fixture();
    const result = loadTasks(
      new MemoryStorage(),
      "tasks",
      fallback,
    );

    result.tasks[0].title = "Изменено";

    assert.equal(
      fallback[0].title,
      "Изучить функции",
    );
  },
);

console.log(
  `\nПроверок пройдено: ${passed}; не пройдено: ${failed}.`,
);

if (failed > 0) {
  process.exitCode = 1;
}
