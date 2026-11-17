const ALGORITHM = "PBKDF2";
const DIGEST = "SHA-256";
const ITERATIONS = 210_000;
const KEY_BYTES = 32;

function normalizeAnswer(answer: string): string {
  return answer.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase(
    "es",
  );
}

function toBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(
  answer: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizeAnswer(answer)),
    ALGORITHM,
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: ALGORITHM, hash: DIGEST, salt: salt as BufferSource, iterations },
    material,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashSecurityAnswer(answer: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(answer, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifySecurityAnswer(
  answer: string,
  encoded: string,
): Promise<boolean> {
  const [scheme, iterationsText, saltText, expectedText] = encoded.split("$");
  const iterations = Number(iterationsText);
  if (
    scheme !== "pbkdf2_sha256" || !Number.isSafeInteger(iterations) ||
    iterations < 100_000 || !saltText || !expectedText
  ) return false;
  try {
    const actual = await derive(answer, fromBase64(saltText), iterations);
    const expected = fromBase64(expectedText);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index++) {
      difference |= actual[index]! ^ expected[index]!;
    }
    return difference === 0;
  } catch {
    return false;
  }
}
