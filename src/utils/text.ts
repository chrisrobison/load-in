export function toSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "-");
}

export function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []));
}

export function extractPhone(text: string): string | undefined {
  return text.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/)?.[0];
}

export function estimateGenreKeywords(text: string): string[] {
  const keywords = ["punk", "indie", "metal", "edm", "jazz", "comedy", "hip hop", "folk", "rock", "electronic"];
  const lower = text.toLowerCase();
  const found = keywords.filter((keyword) => lower.includes(keyword));
  return found.length > 0 ? found : ["indie", "punk", "metal", "edm", "comedy"];
}

export function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`);
}
