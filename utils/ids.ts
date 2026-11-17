import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export function randomCode(len: number): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
/** e.g. GYM-7K3QX9 — collision-checked by the caller via appendUnique */
export const newMemberId = () => `GYM-${randomCode(6)}`;
export const newId = (prefix: string) => `${prefix}-${randomCode(10)}`;
