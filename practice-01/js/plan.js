"use strict";

const totalTasks = 14;
const completedTasks = 4;
const dailyLimit = 4;

const isTotalTasksValid =
  Number.isFinite(totalTasks) &&
  Number.isInteger(totalTasks) &&
  totalTasks >= 0 &&
  totalTasks <= 1000;

const isCompletedTasksValid =
  Number.isFinite(completedTasks) &&
  Number.isInteger(completedTasks) &&
  completedTasks >= 0 &&
  completedTasks <= totalTasks;

const isDailyLimitValid =
  Number.isFinite(dailyLimit) &&
  Number.isInteger(dailyLimit) &&
  dailyLimit >= 1 &&
  dailyLimit <= 1000;

if (!isTotalTasksValid) {
  console.log("Ошибка: некорректное общее количество задач");
} else if (!isCompletedTasksValid) {
  console.log("Ошибка: некорректное количество выполненных задач");
} else if (!isDailyLimitValid) {
  console.log("Ошибка: некорректная дневная норма");
} else {
  let remainingTasks = totalTasks - completedTasks;
  let day = 0;

  console.log(`Осталось задач: ${remainingTasks}`);

  if (remainingTasks === 0) {
    console.log("Все задачи уже выполнены");
    console.log("Потребуется дней: 0");
  } else {
    while (remainingTasks > 0) {
      day += 1;

      const tasksToday = Math.min(dailyLimit, remainingTasks);

      remainingTasks -= tasksToday;

      console.log(
        `День ${day}: выполнено ${tasksToday}, осталось ${remainingTasks}`
      );
    }

    console.log(`Потребуется дней: ${day}`);
  }
}