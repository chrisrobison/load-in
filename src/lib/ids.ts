import { customAlphabet } from "nanoid";

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export function createId(prefix: string): string {
  return `${prefix}_${nano()}`;
}
