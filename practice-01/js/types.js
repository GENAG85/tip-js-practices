"use strict";

const result1 = "8" + 2;
console.log('1. "8" + 2');
console.log("Результат:", result1);
console.log("Тип:", typeof result1);

const result2 = "8" - 2;
console.log('2. "8" - 2');
console.log("Результат:", result2);
console.log("Тип:", typeof result2);

const result3 = Number("8") + 2;
console.log('3. Number("8") + 2');
console.log("Результат:", result3);
console.log("Тип:", typeof result3);

const result4 = "12" > "3";
console.log('4. "12" > "3"');
console.log("Результат:", result4);
console.log("Тип:", typeof result4);

const result5 = 12 === "12";
console.log('5. 12 === "12"');
console.log("Результат:", result5);
console.log("Тип:", typeof result5);

const result6 = Number("");
console.log('6. Number("")');
console.log("Результат:", result6);
console.log("Тип:", typeof result6);

const result7 = Number("text");
console.log('7. Number("text")');
console.log("Результат:", result7);
console.log("Тип:", typeof result7);

const result8 = Boolean("false");
console.log('8. Boolean("false")');
console.log("Результат:", result8);
console.log("Тип:", typeof result8);

const result9 = typeof null;
console.log("9. typeof null");
console.log("Результат:", result9);
console.log("Тип результата:", typeof result9);

const result10 = typeof NaN;
console.log("10. typeof NaN");
console.log("Результат:", result10);
console.log("Тип результата:", typeof result10);