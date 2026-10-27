const key = "tip-js-practice-04:lab";

const form = document.querySelector("#lab-form");
const title = document.querySelector("#lab-title");
const log = document.querySelector("#lab-log");

const write = (text) => {
  log.textContent =
    `${new Date().toLocaleTimeString()}  ${text}\n${log.textContent}`;
};

form.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    title.setCustomValidity("");

    const formData = new FormData(form);
    const rawTitle = formData.get("title");

    const normalized = typeof rawTitle === "string"
      ? rawTitle.trim()
      : "";

    if (!normalized) {
      title.setCustomValidity(
        "После trim название не должно быть пустым",
      );

      title.reportValidity();

      write(
        "Прикладная проверка отклонила строку из пробелов.",
      );

      return;
    }

    const value = {
      id: Number(formData.get("id")),
      title: normalized,
      priority: formData.get("priority"),
    };

    localStorage.setItem(
      key,
      JSON.stringify(value),
    );

    write(
      `submit: defaultPrevented=${event.defaultPrevented}; ` +
      `тип id из FormData=${typeof formData.get("id")}; ` +
      `JSON=${localStorage.getItem(key)}`,
    );
  },
);

document
  .querySelector("#read")
  .addEventListener(
    "click",
    () => {
      const raw = localStorage.getItem(key);

      try {
        write(
          `getItem -> ${typeof raw}: ${raw}; ` +
          `parse -> ${JSON.stringify(JSON.parse(raw))}`,
        );
      } catch (error) {
        write(`JSON.parse error: ${error.message}`);
      }
    },
  );

document
  .querySelector("#break")
  .addEventListener(
    "click",
    () => {
      localStorage.setItem(
        key,
        "{broken-json",
      );

      write("Записана повреждённая строка JSON.");
    },
  );

document
  .querySelector("#clear")
  .addEventListener(
    "click",
    () => {
      localStorage.removeItem(key);
      write("Ключ удалён.");
    },
  );
