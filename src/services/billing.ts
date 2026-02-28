import Stripe from "stripe";
import type { AppEnv } from "../lib/env.js";
import type { OfferRecord } from "../types.js";

export class BillingService {
  private readonly stripe;

  constructor(private readonly env: AppEnv) {
    this.stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  async createCheckout(offer: OfferRecord, venueName: string): Promise<{ stripeCheckoutId?: string; checkoutUrl: string; simulated: boolean }> {
    if (!this.stripe) {
      return {
        checkoutUrl: `${this.env.APP_BASE_URL}/mock-checkout/${offer.id}`,
        simulated: true
      };
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${this.env.APP_BASE_URL}/deliveries/success?offer=${offer.id}`,
      cancel_url: `${this.env.APP_BASE_URL}/`,
      metadata: {
        offerId: offer.id,
        venueId: offer.venueId
      },
      line_items: [
        {
          price_data: {
            currency: offer.currency,
            product_data: {
              name: `${venueName} Autonomous Fixer Setup`
            },
            unit_amount: offer.amountCents ?? 150000
          },
          quantity: 1
        }
      ]
    });

    return {
      stripeCheckoutId: session.id,
      checkoutUrl: session.url ?? `${this.env.APP_BASE_URL}/`,
      simulated: false
    };
  }
}
