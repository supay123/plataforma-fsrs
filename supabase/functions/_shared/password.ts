const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%";
const ALPHABET = UPPER + LOWER + DIGITS + SYMBOLS;

function randomChar(alphabet: string): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return alphabet[values[0]! % alphabet.length]!;
}

export function generatePassword(length = 12): string {
  if (length < 8) {
    throw new Error("Generated passwords must be at least 8 chars.");
  }
  const required = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];
  while (required.length < length) required.push(randomChar(ALPHABET));

  for (let index = required.length - 1; index > 0; index--) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const swap = values[0]! % (index + 1);
    [required[index], required[swap]] = [required[swap]!, required[index]!];
  }
  return required.join("");
}

export function generatePin(): string {
  const values = new Uint32Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => String(value % 10)).join("");
}

export function assertPassword(password: string): void {
  if (
    password.length < 8 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new Error(
      "Password must contain at least 8 characters, uppercase, lowercase, and a digit.",
    );
  }
}

export function assertCredential(
  role: "admin" | "teacher" | "student",
  credential: string,
): void {
  if (role === "student" && /^\d{6}$/.test(credential)) return;
  assertPassword(credential);
}

export function generateCredential(
  role: "admin" | "teacher" | "student",
): string {
  return role === "student" ? generatePin() : generatePassword();
}
