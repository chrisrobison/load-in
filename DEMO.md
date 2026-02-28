# 3-Minute Demo

1. Run `npm run audit -- --url "https://www.theindependentsf.com/"`.
2. Show the console output and mention that the run is also persisted into `data/autonomous_fixer.sqlite`.
3. Open `./out/the-independent/` and highlight:
   - `report.md`
   - `dossier.md`
   - `fix/booking_page.html`
   - `fix/artist_submission.html`
   - `fix/seo_suggestions.json`
   - `outreach_email.txt`
4. Run `npm run dashboard`.
5. In the dashboard, click the venue card and show:
   - audit score + top leaks
   - qualification state + contacts
   - dossier timeline
   - report preview
   - outreach, billing, and delivery state
   - fix pack download links
6. Trigger a city-wide run from the UI or with `npm run audit -- --city "San Francisco" --category "music venue"` and show the persisted job history.
7. If SMTP and Stripe are configured, demonstrate send -> reply/payment -> delivery. If not, use the simulated state transition endpoints and point out the same dossier updates.
