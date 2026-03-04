import path from "node:path";
import { readJsonFile } from "../utils/fs.js";
import { cleanWhitespace, toTitleCase } from "../utils/text.js";
import type { VenueCandidate, VerticalId } from "../types.js";
import { fetchPage } from "../utils/http.js";
import { getVerticalAdapter, inferVertical } from "../verticals/index.js";

interface SeedVenue {
  name: string;
  city: string;
  category: string;
  url: string;
  vertical?: VerticalId;
}

export interface ScoutInput {
  city?: string;
  category?: string;
  name?: string;
  url?: string;
  vertical?: VerticalId;
  limit?: number;
}

export class Scout {
  private readonly seedsPath = path.resolve(process.cwd(), "seeds.json");

  async run(input: ScoutInput): Promise<VenueCandidate[]> {
    const vertical = input.vertical ?? inferVertical(input.category);
    const adapter = getVerticalAdapter(vertical);
    const category = input.category ?? adapter.defaultCategory;

    if (input.url) {
      return [
        {
          name: this.deriveNameFromUrl(input.url),
          url: input.url,
          category,
          vertical,
          source: "direct"
        }
      ];
    }

    if (input.name) {
      const seeds = await readJsonFile<SeedVenue[]>(this.seedsPath);
      const exactSeed = seeds.find((seed) => {
        const sameName = seed.name.toLowerCase().includes(input.name!.toLowerCase());
        const sameCity = input.city ? seed.city.toLowerCase().includes(input.city.toLowerCase()) : true;
        const sameVertical = seed.vertical ? seed.vertical === vertical : true;
        return sameName && sameCity && sameVertical;
      });

      if (exactSeed) {
        return [{ ...exactSeed, category: exactSeed.category ?? category, vertical: exactSeed.vertical ?? vertical, source: "seed" as const }];
      }

      const namedCandidate = await this.searchQuery(
        [input.name, input.city, category, ...adapter.scoutKeywords.slice(0, 1), "official site"].filter(Boolean).join(" "),
        1,
        input.city,
        category,
        vertical
      );
      if (namedCandidate.length > 0) {
        return namedCandidate;
      }
    }

    const seeds = await readJsonFile<SeedVenue[]>(this.seedsPath);
    const filteredSeeds = seeds.filter((seed) => {
      const nameMatch = input.name ? seed.name.toLowerCase().includes(input.name.toLowerCase()) : true;
      const cityMatch = input.city ? seed.city.toLowerCase().includes(input.city.toLowerCase()) : true;
      const categoryMatch = category ? seed.category.toLowerCase().includes(category.toLowerCase()) : true;
      const verticalMatch = seed.vertical ? seed.vertical === vertical : vertical === inferVertical(seed.category);
      return nameMatch && cityMatch && categoryMatch && verticalMatch;
    });

    const searchCandidates = input.city && category
      ? await this.searchQuery(`${input.city} ${category} ${adapter.scoutKeywords[0]} official site`, input.limit ?? 5, input.city, category, vertical)
      : [];

    const merged = new Map<string, VenueCandidate>();
    for (const venue of filteredSeeds.map((seed) => ({ ...seed, vertical: seed.vertical ?? inferVertical(seed.category), source: "seed" as const }))) {
      merged.set(venue.url, venue);
    }

    for (const venue of searchCandidates) {
      if (!merged.has(venue.url) && this.isUsefulSearchCandidate(venue, input.city, category)) {
        merged.set(venue.url, venue);
      }
    }

    return Array.from(merged.values()).slice(0, input.limit ?? 5);
  }

  private async searchQuery(queryText: string, limit: number, city?: string, category?: string, vertical?: VerticalId): Promise<VenueCandidate[]> {
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
          vertical,
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
