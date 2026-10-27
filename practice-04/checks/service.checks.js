import assert from "node:assert/strict";
import {
  createTask,
  findTaskById,
  getPendingTasks,
  getTaskTitles,
  getTaskStats,
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
} from "../src/task-service.js";

const fixture = () => [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];

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

const fail = (result) => {
  assert.equal(result.ok, false);
};

const frozen = () =>
  Object.freeze(
    fixture().map((task) => Object.freeze(task)),
  );

check(
  "01 createTask создаёт задачу",
  () => {
    assert.deepEqual(
      createTask(20, "Новая", "high").task,
      {
        id: 20,
        title: "Новая",
        completed: false,
        priority: "high",
      },
    );
  },
);

check(
  "02 createTask использует medium по умолчанию",
  () => {
    assert.equal(
      createTask(20, "Новая").task.priority,
      "medium",
    );
  },
);

check(
  "03 createTask обрезает пробелы",
  () => {
    assert.equal(
      createTask(20, "  Новая  ").task.title,
      "Новая",
    );
  },
);

check(
  "04 createTask отклоняет id=0",
  () => {
    fail(createTask(0, "Новая"));
  },
);

check(
  "05 createTask отклоняет строковый id",
  () => {
    fail(createTask("20", "Новая"));
  },
);

check(
  "06 createTask отклоняет пустое название",
  () => {
    fail(createTask(20, "   "));
  },
);

check(
  "07 createTask отклоняет неизвестный приоритет",
  () => {
    fail(createTask(20, "Новая", "urgent"));
  },
);

check(
  "08 findTaskById находит по id",
  () => {
    assert.equal(
      findTaskById(fixture(), 4).title,
      "Подготовить модель задач",
    );
  },
);

check(
  "09 findTaskById возвращает undefined",
  () => {
    assert.equal(
      findTaskById(fixture(), 999),
      undefined,
    );
  },
);

check(
  "10 getPendingTasks возвращает id 4 и 7",
  () => {
    assert.deepEqual(
      getPendingTasks(fixture()).map((task) => task.id),
      [4, 7],
    );
  },
);

check(
  "11 getPendingTasks создаёт новый массив",
  () => {
    const tasks = fixture();
    assert.notEqual(getPendingTasks(tasks), tasks);
  },
);

check(
  "12 getTaskTitles возвращает названия",
  () => {
    assert.deepEqual(
      getTaskTitles(fixture()),
      [
        "Изучить функции",
        "Подготовить модель задач",
        "Проверить методы массивов",
        "Оформить README",
      ],
    );
  },
);

check(
  "13 getTaskStats считает общий набор",
  () => {
    assert.deepEqual(
      getTaskStats(fixture()),
      {
        total: 4,
        completed: 2,
        pending: 2,
        progress: 50,
      },
    );
  },
);

check(
  "14 getTaskStats обрабатывает пустой массив",
  () => {
    assert.deepEqual(
      getTaskStats([]),
      {
        total: 0,
        completed: 0,
        pending: 0,
        progress: 0,
      },
    );
  },
);

check(
  "15 addTask добавляет в конец",
  () => {
    const result = addTask(
      fixture(),
      20,
      "Новая",
      "high",
    );

    assert.deepEqual(
      result.tasks.map((task) => task.id),
      [1, 4, 7, 10, 20],
    );
  },
);

check(
  "16 addTask не меняет вход",
  () => {
    const tasks = fixture();

    addTask(tasks, 20, "Новая");

    assert.deepEqual(
      tasks.map((task) => task.id),
      [1, 4, 7, 10],
    );
  },
);

check(
  "17 addTask отклоняет повтор id",
  () => {
    fail(addTask(fixture(), 4, "Дубликат"));
  },
);

check(
  "18 addTask отклоняет неверный id",
  () => {
    fail(addTask(fixture(), -2, "Новая"));
  },
);

check(
  "19 setTaskCompleted меняет статус",
  () => {
    const result = setTaskCompleted(
      fixture(),
      4,
      true,
    );

    assert.equal(
      findTaskById(result.tasks, 4).completed,
      true,
    );
  },
);

check(
  "20 setTaskCompleted не меняет вход",
  () => {
    const tasks = fixture();

    setTaskCompleted(tasks, 4, true);

    assert.equal(
      findTaskById(tasks, 4).completed,
      false,
    );
  },
);

check(
  "21 setTaskCompleted требует boolean",
  () => {
    fail(setTaskCompleted(fixture(), 4, "true"));
  },
);

check(
  "22 setTaskCompleted отклоняет отсутствующий id",
  () => {
    fail(setTaskCompleted(fixture(), 999, true));
  },
);

check(
  "23 renameTask меняет название",
  () => {
    const result = renameTask(
      fixture(),
      4,
      "Форма",
    );

    assert.equal(
      findTaskById(result.tasks, 4).title,
      "Форма",
    );
  },
);

check(
  "24 renameTask обрезает пробелы",
  () => {
    const result = renameTask(
      fixture(),
      4,
      "  Форма  ",
    );

    assert.equal(
      findTaskById(result.tasks, 4).title,
      "Форма",
    );
  },
);

check(
  "25 renameTask сохраняет остальные поля",
  () => {
    const result = renameTask(
      fixture(),
      1,
      "X",
    );

    const task = findTaskById(result.tasks, 1);

    assert.equal(task.completed, true);
    assert.equal(task.priority, "medium");
  },
);

check(
  "26 renameTask отклоняет отсутствующий id",
  () => {
    fail(renameTask(fixture(), 999, "X"));
  },
);

check(
  "27 removeTask удаляет нужную задачу",
  () => {
    const result = removeTask(fixture(), 7);

    assert.deepEqual(
      result.tasks.map((task) => task.id),
      [1, 4, 10],
    );
  },
);

check(
  "28 removeTask не меняет вход",
  () => {
    const tasks = fixture();

    removeTask(tasks, 7);

    assert.deepEqual(
      tasks.map((task) => task.id),
      [1, 4, 7, 10],
    );
  },
);

check(
  "29 removeTask отклоняет отсутствующий id",
  () => {
    fail(removeTask(fixture(), 999));
  },
);

check(
  "30 addTask работает с frozen массивом",
  () => {
    assert.equal(
      addTask(frozen(), 20, "Новая").ok,
      true,
    );
  },
);

check(
  "31 setTaskCompleted работает с frozen объектами",
  () => {
    assert.equal(
      setTaskCompleted(frozen(), 4, true).ok,
      true,
    );
  },
);

check(
  "32 renameTask работает с frozen объектами",
  () => {
    assert.equal(
      renameTask(frozen(), 4, "X").ok,
      true,
    );
  },
);

check(
  "33 removeTask работает с frozen объектами",
  () => {
    assert.equal(
      removeTask(frozen(), 4).ok,
      true,
    );
  },
);

check(
  "34 getTaskStats даёт 100 процентов",
  () => {
    const tasks = [
      {
        id: 1,
        title: "A",
        completed: true,
        priority: "low",
      },
    ];

    assert.equal(
      getTaskStats(tasks).progress,
      100,
    );
  },
);

check(
  "35 id не зависит от индекса",
  () => {
    assert.equal(
      findTaskById(fixture(), 10).title,
      "Оформить README",
    );
  },
);

console.log(
  `\nПроверок пройдено: ${passed}; не пройдено: ${failed}.`,
);

if (failed > 0) {
  process.exitCode = 1;
}
