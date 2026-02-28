# 3-Minute Demo

1. Run `npm run audit -- --url "https://www.theindependentsf.com/"`.
2. Show the console output proving the full pipeline ran: Scout -> Auditor -> Builder -> Analyst -> Closer.
3. Open `./out/the-independent-san-francisco/` and highlight:
   - `report.md`
   - `fix/booking_page.html`
   - `fix/artist_submission.html`
   - `fix/seo_suggestions.json`
   - `outreach_email.txt`
4. Run `npm run dashboard`.
5. In the dashboard, click the venue card and show:
   - audit score + top leaks
   - report preview
   - outreach preview
   - fix pack download links
6. Point out that the system still works with partial data by running `npm run audit -- --city "San Francisco" --category "music venue"` and mentioning the seed fallback.
