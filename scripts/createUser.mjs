import { emitKeypressEvents } from "node:readline";
import { pool } from "../db/client.mjs";
import { createUser } from "../db/users.mjs";

function readPassword() {
  const input = process.stdin;
  if (!input.isTTY || !process.stdout.isTTY) {
    throw new Error("Для скрытого ввода пароля нужен интерактивный терминал");
  }
  return new Promise((resolve, reject) => {
    let password = "";
    const wasRaw = input.isRaw;
    function finish(error) {
      input.removeListener("keypress", onKey);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    }
    function onKey(text, key = {}) {
      if (key.ctrl && (key.name === "c" || key.name === "d")) {
        finish(new Error("Ввод отменён"));
      } else if (key.name === "return" || key.name === "enter") {
        finish();
      } else if (key.name === "backspace") {
        password = Array.from(password).slice(0, -1).join("");
      } else if (!key.ctrl && !key.meta && text && !/[\x00-\x1f\x7f]/.test(text)) {
        password += text;
      }
    }
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.on("keypress", onKey);
    input.resume();
    process.stdout.write("Пароль: ");
  });
}

try {
  const [email, flag, ...extra] = process.argv.slice(2);
  if (!email || email.startsWith("--") || extra.length || (flag && flag !== "--superadmin")) {
    throw new Error("Использование: yarn user:create <email> [--superadmin]");
  }
  const password = await readPassword();
  const user = await createUser({ email, password, is_superadmin: flag === "--superadmin" });
  console.log(`Создан пользователь: ${user.email}${user.is_superadmin ? " (superadmin)" : ""}`);
} catch (error) {
  // Ошибки PostgreSQL могут содержать детали записи: не выводим их в терминал.
  console.error(error.code && error.code !== "EMAIL_EXISTS"
    ? "Не удалось создать пользователя: ошибка базы данных"
    : error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
