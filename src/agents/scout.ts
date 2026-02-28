import path from "node:path";
import { readJsonFile } from "../utils/fs.js";
import { cleanWhitespace, toTitleCase } from "../utils/text.js";
import type { VenueCandidate } from "../types.js";
import { fetchPage } from "../utils/http.js";

interface SeedVenue {
  name: string;
  city: string;
  category: string;
  url: string;
}

export interface ScoutInput {
  city?: string;
  category?: string;
  name?: string;
  url?: string;
  limit?: number;
}

export class Scout {
  private readonly seedsPath = path.resolve(process.cwd(), "seeds.json");

  async run(input: ScoutInput): Promise<VenueCandidate[]> {
    if (input.url) {
      return [
        {
          name: this.deriveNameFromUrl(input.url),
          url: input.url,
          source: "direct"
        }
      ];
    }

    if (input.name) {
      const seeds = await readJsonFile<SeedVenue[]>(this.seedsPath);
      const exactSeed = seeds.find((seed) => {
        const sameName = seed.name.toLowerCase().includes(input.name!.toLowerCase());
        const sameCity = input.city ? seed.city.toLowerCase().includes(input.city.toLowerCase()) : true;
        return sameName && sameCity;
      });

      if (exactSeed) {
        return [{ ...exactSeed, source: "seed" as const }];
      }

      const namedCandidate = await this.searchQuery(
        [input.name, input.city, input.category, "official site"].filter(Boolean).join(" "),
        1,
        input.city,
        input.category
      );
      if (namedCandidate.length > 0) {
        return namedCandidate;
      }
    }

    const seeds = await readJsonFile<SeedVenue[]>(this.seedsPath);
    const filteredSeeds = seeds.filter((seed) => {
      const nameMatch = input.name ? seed.name.toLowerCase().includes(input.name.toLowerCase()) : true;
      const cityMatch = input.city ? seed.city.toLowerCase().includes(input.city.toLowerCase()) : true;
      const categoryMatch = input.category ? seed.category.toLowerCase().includes(input.category.toLowerCase()) : true;
      return nameMatch && cityMatch && categoryMatch;
    });

    const searchCandidates = input.city && input.category
      ? await this.searchQuery(`${input.city} ${input.category} official site`, input.limit ?? 5, input.city, input.category)
      : [];

    const merged = new Map<string, VenueCandidate>();
    for (const venue of filteredSeeds.map((seed) => ({ ...seed, source: "seed" as const }))) {
      merged.set(venue.url, venue);
    }

    for (const venue of searchCandidates) {
      if (!merged.has(venue.url) && this.isUsefulSearchCandidate(venue, input.city, input.category)) {
        merged.set(venue.url, venue);
      }
    }

    return Array.from(merged.values()).slice(0, input.limit ?? 5);
  }

  private async searchQuery(queryText: string, limit: number, city?: string, category?: string): Promise<VenueCandidate[]> {
    try {
      const query = encodeURIComponent(queryText);
      const response = await fetchPage(`https://duckduckgo.com/html/?q=${query}`, 10000);
      const links = Array.from(
        response.html.matchAll(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gim)
      ).slice(0, limit * 2);

      return links.map((match) => {
        const url = this.normalizeDuckDuckGoUrl(match[1]);
        const rawName = match[2].replace(/<[^>]+>/g, " ");
        return {
          name: cleanWhitespace(rawName),
          url,
          city,
          category,
          source: "search" as const
        };
      }).filter((item) => item.url.startsWith("http")).slice(0, limit);
    } catch {
      return [];
    }
  }

  private normalizeDuckDuckGoUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl, "https://duckduckgo.com");
      const uddg = parsed.searchParams.get("uddg");
      return uddg ? decodeURIComponent(uddg) : rawUrl;
    } catch {
      return rawUrl;
    }
  }

  private isUsefulSearchCandidate(candidate: VenueCandidate, city?: string, category?: string): boolean {
    const lowerName = candidate.name.toLowerCase();
    if (city && lowerName === city.toLowerCase()) {
      return false;
    }
    if (category && lowerName === category.toLowerCase()) {
      return false;
    }
    if (lowerName.length < 5) {
      return false;
    }
    return !/(tripadvisor|yelp|facebook|instagram|eventbrite|ticketmaster|maps)/i.test(candidate.url);
  }

  private deriveNameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return toTitleCase(parsed.hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " "));
    } catch {
      return "venue";
    }
  }
}
