import { getDb } from "./db/client.js";
import { DossierRepository } from "./db/repositories/dossierRepository.js";
import { JobRepository } from "./db/repositories/jobRepository.js";
import { OutreachRepository } from "./db/repositories/outreachRepository.js";
import { VenueRepository } from "./db/repositories/venueRepository.js";
import { getEnv } from "./lib/env.js";
import { BillingService } from "./services/billing.js";
import { BusinessService } from "./services/business.js";
import { ContactFinder } from "./services/contactFinder.js";
import { DeliveryService } from "./services/delivery.js";
import { DossierService } from "./services/dossier.js";
import { InboxPoller } from "./services/inboxPoller.js";
import { MailerService } from "./services/mailer.js";
import { QualificationService } from "./services/qualification.js";

let appContext: ReturnType<typeof createAppContext> | null = null;

export function createAppContext() {
  const env = getEnv();
  const db = getDb();
  const venueRepository = new VenueRepository(db);
  const jobRepository = new JobRepository(db);
  const dossierRepository = new DossierRepository(db);
  const outreachRepository = new OutreachRepository(db);
  const dossierService = new DossierService();
  const mailerService = new MailerService(env);
  const billingService = new BillingService(env);
  const deliveryService = new DeliveryService(env, dossierService);
  const inboxPoller = new InboxPoller(env, outreachRepository, dossierRepository, venueRepository);
  const businessService = new BusinessService(
    env,
    venueRepository,
    outreachRepository,
    dossierRepository,
    mailerService,
    billingService,
    deliveryService,
    dossierService
  );

  return {
    env,
    db,
    repositories: {
      venueRepository,
      jobRepository,
      dossierRepository,
      outreachRepository
    },
    services: {
      contactFinder: new ContactFinder(),
      qualificationService: new QualificationService(env),
      dossierService,
      mailerService,
      billingService,
      deliveryService,
      inboxPoller,
      businessService
    }
  };
}

export function getAppContext() {
  if (!appContext) {
    appContext = createAppContext();
  }
  return appContext;
}
