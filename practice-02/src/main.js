import { demoTasks, variantNumber, variantTasks } from "./data.js";
import {
  findTaskById,
  getPendingTasks,
  getTaskTitles,
  getTaskStats,
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
} from "./task-service.js";

function cloneTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

function sameTasks(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function printStats(label, tasks) {
  const { total, completed, pending, progress } = getTaskStats(tasks);
  const progressText = total === 0 ? "Задач пока нет" : `${progress.toFixed(1)}%`;
  console.log(`${label}: всего ${total}; выполнено ${completed}; осталось ${pending}; прогресс ${progressText}`);
}

function applyOperation(currentTasks, result, label) {
  if (!result.ok) {
    console.log(`${label}: ошибка: ${result.error}`);
    return currentTasks;
  }

  const nextTasks = result.tasks;
  printStats(label, nextTasks);
  return nextTasks;
}

console.log("=== ОБЩИЙ СЦЕНАРИЙ ===");
const demoSnapshot = cloneTasks(demoTasks);
let currentTasks = demoTasks;

console.log("Исходные задачи:");
console.table(currentTasks);
console.log("Названия:", getTaskTitles(currentTasks));
console.log("Невыполненные id:", getPendingTasks(currentTasks).map((task) => task.id));
printStats("Исходный набор", currentTasks);

currentTasks = applyOperation(
  currentTasks,
  addTask(currentTasks, 20, "Добавить проверку", "high"),
  "После добавления id 20",
);

currentTasks = applyOperation(
  currentTasks,
  setTaskCompleted(currentTasks, 4, true),
  "После выполнения id 4",
);

currentTasks = applyOperation(
  currentTasks,
  renameTask(currentTasks, 10, "Подготовить инструкцию запуска"),
  "После переименования id 10",
);

currentTasks = applyOperation(
  currentTasks,
  removeTask(currentTasks, 7),
  "После удаления id 7",
);

const beforeFailedOperation = currentTasks;
const failedAdd = addTask(currentTasks, 20, "Дубликат", "low");
console.log(`Проверка ошибки: ${failedAdd.ok ? "ошибка не обнаружена" : failedAdd.error}`);
console.log("Состояние после отказа не заменено:", currentTasks === beforeFailedOperation);

console.log("Итоговые id:", currentTasks.map((task) => task.id));
console.log("Невыполненные итоговые id:", getPendingTasks(currentTasks).map((task) => task.id));
console.log("Задача id 10:", findTaskById(currentTasks, 10));
console.log("demoTasks не изменён:", sameTasks(demoTasks, demoSnapshot));

console.log("\n=== ИНДИВИДУАЛЬНЫЙ СЦЕНАРИЙ ===");
console.log("Вариант:", variantNumber);
console.log("Тема: оформление технической документации");
const variantSnapshot = cloneTasks(variantTasks);
let currentVariantTasks = variantTasks;

console.log("Исходные задачи варианта:");
console.table(currentVariantTasks);
printStats("Шесть исходных задач", currentVariantTasks);

currentVariantTasks = applyOperation(
  currentVariantTasks,
  addTask(currentVariantTasks, 80, "Проверить ссылки в документации", "low"),
  "После добавления id 80",
);

currentVariantTasks = applyOperation(
  currentVariantTasks,
  setTaskCompleted(currentVariantTasks, 11, true),
  "После установки completed=true для id 11",
);

currentVariantTasks = applyOperation(
  currentVariantTasks,
  renameTask(currentVariantTasks, 23, "Подготовить структуру технического руководства"),
  "После переименования id 23",
);

currentVariantTasks = applyOperation(
  currentVariantTasks,
  removeTask(currentVariantTasks, 37),
  "После удаления id 37",
);

const variantBeforeFailure = currentVariantTasks;
const duplicateVariant = addTask(
  currentVariantTasks,
  80,
  "Повторная задача",
  "low",
);
console.log(`Повторное добавление id 80: ${duplicateVariant.ok ? "ошибка не обнаружена" : duplicateVariant.error}`);
console.log("Состояние варианта после отказа не заменено:", currentVariantTasks === variantBeforeFailure);

console.log("Итоговые id варианта:", currentVariantTasks.map((task) => task.id));
printStats("Итоговая сводка варианта", currentVariantTasks);
console.log("variantTasks не изменён:", sameTasks(variantTasks, variantSnapshot));
