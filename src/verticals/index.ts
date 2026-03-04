import type { VerticalId } from "../types.js";
import type { VerticalAdapter } from "./base.js";
import { eventVenueAdapter } from "./eventVenue.js";
import { restaurantAdapter } from "./restaurant.js";
import { salonAdapter } from "./salon.js";

const adapters: Record<VerticalId, VerticalAdapter> = {
  event_venue: eventVenueAdapter,
  salon: salonAdapter,
  restaurant: restaurantAdapter
};

export function getVerticalAdapter(vertical?: VerticalId): VerticalAdapter {
  if (!vertical) {
    return adapters.event_venue;
  }
  return adapters[vertical] ?? adapters.event_venue;
}

export function listVerticalAdapters(): VerticalAdapter[] {
  return Object.values(adapters);
}

export function inferVertical(category?: string): VerticalId {
  const value = (category ?? "").toLowerCase();
  if (/(salon|barber|blowout|stylist|hair)/i.test(value)) {
    return "salon";
  }
  if (/(restaurant|bistro|cafe|brunch|kitchen|diner|cocktail)/i.test(value)) {
    return "restaurant";
  }
  return "event_venue";
}
