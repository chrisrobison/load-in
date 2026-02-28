# Venue Audit Report: Rickshaw Stop

## Summary
- Rickshaw Stop is leaking revenue first through missing rental and spec details.
- The audit used live public site data from https://rickshawstop.com/.
- There is no strong public signal for upcoming events, which likely hurts both discovery and fill rate.

## Top Leaks (ranked)
## 1. Missing rental and spec details

Why it matters: Planners need capacity, room specs, and event-fit details before they reach out.

Fix: Add a concise private events section with capacity, amenities, and AV/spec highlights.

## 2. Missing or weak SEO metadata

Why it matters: Search results underperform when the page title or description is generic or absent.

Fix: Ship tighter title/meta tags focused on bookings, events, and the venue's city.

## 3. Page likely too heavy

Why it matters: Slow pages depress ticket clicks and booking inquiries, especially on mobile.

Fix: Compress hero media, lazy-load secondary images, and reduce oversized assets.

## 4. No event schema markup detected

Why it matters: Structured event data improves search visibility and helps search engines understand upcoming shows.

Fix: Publish JSON-LD Event markup for upcoming shows or a reusable schema template.


## Generated Fix Pack
- booking inquiry landing page: /Users/cdr/Projects/load-in/out/rickshaw-stop/fix/booking_page.html
- artist submission intake form: /Users/cdr/Projects/load-in/out/rickshaw-stop/fix/artist_submission.html
- event schema snippet: /Users/cdr/Projects/load-in/out/rickshaw-stop/fix/event_schema.json
- SEO quick-fix bundle: /Users/cdr/Projects/load-in/out/rickshaw-stop/fix/seo_suggestions.json
- fill-the-night outreach list: /Users/cdr/Projects/load-in/out/rickshaw-stop/fix/fill_the_night_outreach_list.json

## Estimated impact
- 1-4 additional qualified inquiries/month
- 1-2 additional events/month
- Ranges assume the venue currently gets meaningful direct traffic but lacks one or more conversion-critical paths.
- Inquiry uplift increases when a visible booking CTA and a low-friction form replace phone-only or buried contact flows.
- Event uplift assumes promoter intake plus a visible upcoming-events surface help fill underbooked nights.

## Next steps
Approve and we deploy in 24 hours.
