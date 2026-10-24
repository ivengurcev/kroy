import { pool } from "./client.mjs";
import { hashPassword } from "./passwords.mjs";

function normalizeEmail(email) {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Email не может быть пустым");
  }
  return email.trim().toLowerCase();
}

export async function createUser({ email, password, is_superadmin = false }) {
  const normalizedEmail = normalizeEmail(email);
  if (typeof is_superadmin !== "boolean") throw new Error("is_superadmin должен быть boolean");
  const passwordHash = await hashPassword(password);
  try {
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (email, password_hash, is_superadmin)
       VALUES ($1, $2, $3)
       RETURNING id, email, is_superadmin, status, created_at`,
      [normalizedEmail, passwordHash, is_superadmin],
    );
    return user;
  } catch (error) {
    if (error.code === "23505" && error.constraint === "users_email_lower_idx") {
      const duplicate = new Error("Пользователь с таким email уже существует");
      duplicate.code = "EMAIL_EXISTS";
      throw duplicate;
    }
    throw error;
  }
}

export async function findUserByEmail(email) {
  const { rows: [user] } = await pool.query(
    "SELECT id, email, password_hash, is_superadmin, status, created_at FROM users WHERE lower(email) = $1",
    [normalizeEmail(email)],
  );
  return user ?? null;
}
