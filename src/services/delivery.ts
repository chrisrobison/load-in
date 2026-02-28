import path from "node:path";
import type { AppEnv } from "../lib/env.js";
import type { VenueDossier } from "../types.js";
import { DossierService } from "./dossier.js";

export class DeliveryService {
  constructor(
    private readonly env: AppEnv,
    private readonly dossierService: DossierService
  ) {}

  async packageVenue(dossier: VenueDossier): Promise<{ outDir: string; dossierPath: string; clientReadmePath: string; zipPath: string; deliveryUrl: string }> {
    const outDir = path.resolve(process.cwd(), "out", dossier.venue.slug);
    const dossierPath = await this.dossierService.writeVenueDossier(dossier);
    const clientReadmePath = await this.dossierService.writeClientReadme(outDir, dossier.venue.name);
    const zipPath = path.join(outDir, `${dossier.venue.slug}-delivery.zip`);
    await this.dossierService.writeZip(zipPath, outDir);
    return {
      outDir,
      dossierPath,
      clientReadmePath,
      zipPath,
      deliveryUrl: `${this.env.APP_BASE_URL}/deliveries/${dossier.venue.id}`
    };
  }
}
