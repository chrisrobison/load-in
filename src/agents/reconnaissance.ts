import type { VenueCandidate } from "../types.js";
import { Scout, type ScoutInput } from "./scout.js";

export class Reconnaissance {
  private readonly scout = new Scout();

  async run(input: ScoutInput): Promise<VenueCandidate[]> {
    return this.scout.run(input);
  }
}
