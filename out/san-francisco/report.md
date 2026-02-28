# Venue Audit Report: San Francisco

## Summary
- San Francisco is leaking revenue first through no clear booking cta.
- The audit used live public site data from https://duckduckgo.com/y.js?ad_domain=tickets-center.com&ad_provider=bingv7aa&ad_type=txad&click_metadata=Sw--WpIlwuqGosF0sd_X0zeaH88HjK-i9JoktbBnpayuaHXhAsxeJb1mq48GCkDVIQuQVuBpnf38rs4SSYyALyj6_Z37wDj7kjbbTGpVSoNGftZq7lTg-E1oLByW30_hf-IgpH1gkwDUivL170MAdzUH-yiyY-X0Cq3TokVl57A.30qFbYKUURSLY1urVTl_Aw&rut=6d17ef141cb0a2a5f16f5698deeb4a9c2afd2366e78e261f0a9e929bc688c4fe&u3=https://www.bing.com/aclick?ld=e8f-VSyx0oja08-WMmC_akWTVUCUyNnaajQq6FwpyC_STkHMFWxEF3AHmjxy1UXoA6DdUJLfBltGA9SdT-Y5JLZ_VqHTtbmhxYCoMjoEB5UWR0h3T6379EU0RcM2cKiYuQ_UpkH65u3d_14xdhvu2oVwIMrIm8GtxOHWjMaKJH4yVz1n6UD6HK0AURcopJSspdWnHbeo6dUXIBt2ha9XS5XCQdDs0&u=aHR0cHMlM2ElMmYlMmZ0aWNrZXRzLWNlbnRlci5jb20lMmZmb3JiaWRkZW4tZ3JlYXQtYW1lcmljYW4tbXVzaWMtaGFsbCUzZmFjY2lkJTNkMTM4ODkwNDE5JTI2bmlkJTNkMiUyNmNhbXBhaWduaWQlM2Q1NjkyOTIwNTclMjZhZGdyb3VwaWQlM2QxMTcyMDgxNDYzNTIwMDE2JTI2Y2lkJTNkNzMyNTUzMTAzMzk1MjclMjZrd2lkJTNkNzMyNTU1NDMzNDI1NjclMjZha3dkJTNkZm9yYmlkZGVuJTI1MjBjb25jZXJ0JTI1MjB0aWNrZXRzJTI2ZG10JTNkYiUyNmJtdCUzZGJiJTI2ZGlzdCUzZHMlMjZ1cSUzZFNhbiUyNTIwRnJhbmNpc2NvJTI1MjBtdXNpYyUyNTIwdmVudWUlMjUyMG9mZmljaWFsJTI1MjBzaXRlJTI2ZGV2aWNlJTNkYyUyNm1zY2xraWQlM2Q1MTUyMGYwOGRhZWUxZTE4ZjE4NDY2YWE0ZmE1ZDhjNyUyNmxvY19waHlzaWNhbF9tcyUzZDg3Mzc5JTI2bG9jX2ludGVyZXN0X21zJTNkNDM4OTYlMjZleGlkJTNkJTI2dnglM2Qw&rlid=51520f08daee1e18f18466aa4fa5d8c7&vqd=4-96201925290310343571309764877091865376&iurl={1}IG=056238321D854FC59E8C6D35143A8C17&CID=0DF01F18FF17653530BA0816FE80641C&ID=DevEx,5039.1.
- There is no strong public signal for upcoming events, which likely hurts both discovery and fill rate.

## Top Leaks (ranked)
## 1. No clear booking CTA

Why it matters: Buyers cannot immediately see how to book the room, which increases drop-off from high-intent traffic.

Fix: Add a primary 'Request a date' CTA on the homepage and every private events page.

## 2. High inquiry friction

Why it matters: If prospects only see sparse contact information, fewer of them complete a booking inquiry.

Fix: Publish a short venue inquiry form with event type, preferred dates, and expected attendance.

## 3. No obvious upcoming events feed

Why it matters: An empty events presence makes the venue look inactive and hurts both ticket sales and room demand.

Fix: Promote upcoming events prominently and keep a crawlable event list live.

## 4. Missing rental and spec details

Why it matters: Planners need capacity, room specs, and event-fit details before they reach out.

Fix: Add a concise private events section with capacity, amenities, and AV/spec highlights.

## 5. No promoter or artist intake path

Why it matters: Without a submission flow, the venue misses inbound opportunities to fill weak nights.

Fix: Add a lightweight artist/promoter intake form with draw, genre, and date range.


## Generated Fix Pack
- booking inquiry landing page: /Users/cdr/Projects/load-in/out/san-francisco/fix/booking_page.html
- artist submission intake form: /Users/cdr/Projects/load-in/out/san-francisco/fix/artist_submission.html
- event schema snippet: /Users/cdr/Projects/load-in/out/san-francisco/fix/event_schema.json
- SEO quick-fix bundle: /Users/cdr/Projects/load-in/out/san-francisco/fix/seo_suggestions.json
- fill-the-night outreach list: /Users/cdr/Projects/load-in/out/san-francisco/fix/fill_the_night_outreach_list.json

## Estimated impact
- 4-8 additional qualified inquiries/month
- 2-4 additional events/month
- Ranges assume the venue currently gets meaningful direct traffic but lacks one or more conversion-critical paths.
- Inquiry uplift increases when a visible booking CTA and a low-friction form replace phone-only or buried contact flows.
- Event uplift assumes promoter intake plus a visible upcoming-events surface help fill underbooked nights.

## Next steps
Approve and we deploy in 24 hours.
