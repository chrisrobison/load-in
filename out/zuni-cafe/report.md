# Zuni Cafe Audit Report

## Summary
- Zuni Cafe is leaving dining demand on the table because no clear direct ordering path.
- The biggest gains likely come from making reservations, ordering, and private dining paths more obvious.
- Higher-margin group bookings are likely under-promoted because private dining and catering are hard to find.

## Top Leaks
1. **No clear direct ordering path**
Why it matters: Takeout and catering demand leaks to marketplaces when direct ordering is absent or inconsistent.
Fix: Add a direct order CTA and make it consistent across hero, menu, and footer.
Evidence: No strong online ordering or pickup CTA was detected.
2. **Private dining or catering path is unclear**
Why it matters: Restaurants often miss higher-margin group bookings when private dining is not surfaced.
Fix: Add a private dining and catering inquiry page with group size, date, and spend range fields.
Evidence: No private dining, catering, or group event language was detected.
3. **Structured event or local offer markup is missing**
Why it matters: Special dinners, brunches, happy hours, and tasting events become easier to discover with structured data.
Fix: Publish JSON-LD for special events or offer templates for recurring dining promotions.
Evidence: No JSON-LD event schema was detected.
4. **No email capture for promotions and events**
Why it matters: Owned audience capture helps fill slow nights, launches, wine dinners, and seasonal menus.
Fix: Add a newsletter capture with a clear hook like first access to specials or event nights.
Evidence: No newsletter or subscribe path was detected.

## Generated Fix Pack
- reservation landing page: /Users/cdr/Projects/load-in/out/zuni-cafe/fix/booking_page.html
- private dining inquiry page: /Users/cdr/Projects/load-in/out/zuni-cafe/fix/private_dining.html
- SEO quick-fix bundle: /Users/cdr/Projects/load-in/out/zuni-cafe/fix/seo_suggestions.json
- events/promotions schema template: /Users/cdr/Projects/load-in/out/zuni-cafe/fix/event_schema.json

## Estimated impact
- 2-5 additional reservations, catering, or direct-order inquiries/month
- 2-4 additional private dining or slow-night fill opportunities/month
- Assumption: Ranges assume the restaurant already gets direct search, map, or social traffic but leaks guests before booking.
- Assumption: Reservation lift increases when reservations, menu access, and ordering are visible above the fold.
- Assumption: Private-dining lift assumes a clear group-booking path and events/promotions calendar help monetize slower nights.

## Next steps
Approve and we deploy in 24 hours.