const algorithm = "pbkdf2-sha256";
const iterations = 100_000;
const saltBytes = 16;
const keyBytes = 32;

const encoder = new TextEncoder();
const emptySalt = new Uint8Array(saltBytes);
const emptyKey = new Uint8Array(keyBytes);

async function derivePassword(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  rounds: number,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds },
    key,
    keyBytes * 8,
  );
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const hash = new Uint8Array(await derivePassword(password, salt, iterations));
  return `${algorithm}$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, storedHash?: string) {
  // Unknown accounts take the same KDF path and cannot authenticate.
  if (storedHash === undefined) {
    const candidate = await derivePassword(password, emptySalt, iterations);
    equalKeys(candidate, emptyKey);
    return false;
  }

  const [kind, rounds, encodedSalt, encodedKey] = storedHash.split("$");
  if (
    kind !== algorithm ||
    rounds !== String(iterations) ||
    !encodedSalt ||
    !encodedKey
  ) {
    throw new Error("Invalid stored password hash configuration.");
  }
  const salt = fromBase64(encodedSalt);
  const key = fromBase64(encodedKey);
  if (salt.byteLength !== saltBytes || key.byteLength !== keyBytes) {
    throw new Error("Invalid stored password hash length.");
  }
  const candidate = await derivePassword(password, salt, iterations);
  return equalKeys(candidate, key);
}

function equalKeys(candidate: ArrayBuffer, expected: Uint8Array<ArrayBuffer>) {
  const subtle = crypto.subtle;
  // The Workers extension is not part of Node's standard SubtleCrypto typings.
  if (
    !("timingSafeEqual" in subtle) ||
    typeof subtle.timingSafeEqual !== "function"
  ) {
    throw new Error("Timing-safe comparison requires the Workers runtime.");
  }
  return subtle.timingSafeEqual(candidate, expected) === true;
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
