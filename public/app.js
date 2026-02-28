const venueListEl = document.getElementById("venue-list");
const emptyStateEl = document.getElementById("empty-state");
const detailEl = document.getElementById("detail");
const jobStatusEl = document.getElementById("job-status");
const reconResultsEl = document.getElementById("recon-results");
const singleAuditForm = document.getElementById("single-audit-form");
const cityAuditForm = document.getElementById("city-audit-form");
const previewReconButton = document.getElementById("preview-recon");
const sendThreadButton = document.getElementById("send-thread-button");

let activeJobPoll = null;
let currentVenue = null;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `Failed to fetch ${url}`;
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  return response.json();
}

function setStatus(container, message, variant = "muted") {
  container.className = variant;
  container.textContent = message;
}

function setText(id, value) {
  document.getElementById(id).textContent = value || "";
}

function renderVenueList(venues) {
  venueListEl.innerHTML = "";
  venues.forEach((venue) => {
    const button = document.createElement("button");
    button.className = "venue-card";
    button.innerHTML = `
      <strong>${venue.name}</strong>
      <p>${venue.city || "Unknown city"} • ${venue.status}</p>
      <p>Score ${venue.score ?? "N/A"}</p>
      <p>${venue.topLeaks.join(" • ") || "No leak data yet"}</p>
    `;
    button.addEventListener("click", async () => {
      document.querySelectorAll(".venue-card").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      await renderVenueDetail(venue.id);
    });
    venueListEl.appendChild(button);
  });
}

async function loadVenues(preferredId) {
  const venues = await fetchJson("/api/venues");
  if (venues.length === 0) {
    venueListEl.innerHTML = "<p>No persisted venues yet. Launch an audit from the left.</p>";
    return;
  }

  renderVenueList(venues);
  const target = preferredId ? venues.find((venue) => venue.id === preferredId) : venues[0];
  if (target) {
    await renderVenueDetail(target.id);
    document.querySelectorAll(".venue-card").forEach((el) => el.classList.remove("active"));
    const activeIndex = venues.findIndex((venue) => venue.id === target.id);
    document.querySelectorAll(".venue-card")[activeIndex]?.classList.add("active");
  }
}

function renderList(id, items, formatter) {
  const el = document.getElementById(id);
  el.innerHTML = "";
  if (!items || items.length === 0) {
    el.innerHTML = "<li class=\"muted\">None</li>";
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = formatter(item);
    el.appendChild(li);
  });
}

async function renderVenueDetail(id) {
  const data = await fetchJson(`/api/venues/${id}`);
  currentVenue = data;
  emptyStateEl.classList.add("hidden");
  detailEl.classList.remove("hidden");

  setText("venue-url", data.profile?.finalUrl || data.venue.canonicalUrl || "Public site");
  setText("venue-name", data.venue.name);
  setText("venue-status", `Status: ${data.venue.status}`);
  setText("venue-score", String(data.audit?.score ?? "N/A"));
  setText("report", data.report || "No report generated yet.");
  setText("email", data.outreach?.email || "No outreach email generated yet.");
  setText("dm", data.outreach?.dm || "No DM generated yet.");

  renderList("top-leaks", data.audit?.topLeaks || [], (leak) => `${leak.title}: ${leak.fix}`);
  const qualification = document.getElementById("qualification");
  qualification.innerHTML = data.qualification
    ? `
      <p><strong>${data.qualification.reason}</strong></p>
      <ul class="list">${(data.qualification.rationale || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    `
    : "<p class=\"muted\">No qualification decision recorded yet.</p>";

  const impact = document.getElementById("impact");
  impact.innerHTML = data.analysis
    ? `
      <p><strong>${data.analysis.impact.inquiriesPerMonth}</strong></p>
      <p><strong>${data.analysis.impact.eventsPerMonth}</strong></p>
      <ul class="list">${data.analysis.impact.assumptions.map((item) => `<li>${item}</li>`).join("")}</ul>
    `
    : "<p class=\"muted\">No analysis yet.</p>";

  renderList("contacts", data.contacts || [], (contact) =>
    `${contact.kind}: ${contact.value}<br><span class="muted">${contact.roleHint || "unknown"} • confidence ${contact.confidence.toFixed(2)}</span>`
  );
  renderList("threads", data.threads || [], (thread) =>
    `<strong>${thread.status}</strong><br><span class="muted">${thread.subject || "No subject"}</span>`
  );
  renderList("fix-files", data.assets || [], (asset) =>
    asset.url ? `<a href="${asset.url}" target="_blank" rel="noreferrer">${asset.type}</a>` : asset.type
  );
  renderList("timeline", data.stageEvents || [], (event) =>
    `<strong>${event.stage}</strong> • ${event.eventType}${event.decision ? ` • ${event.decision}` : ""}<br><span class="muted">${event.createdAt}</span>`
  );

  const billing = document.getElementById("billing");
  const checkoutItems = (data.checkouts || []).map((checkout) =>
    `<li>${checkout.status}${checkout.checkoutUrl ? ` • <a href="${checkout.checkoutUrl}" target="_blank" rel="noreferrer">checkout</a>` : ""}</li>`
  ).join("");
  const deliveryItems = (data.deliveries || []).map((delivery) =>
    `<li>${delivery.status}${delivery.deliveryUrl ? ` • <a href="${delivery.deliveryUrl}" target="_blank" rel="noreferrer">portal</a>` : ""}</li>`
  ).join("");
  billing.innerHTML = `
    <p><strong>Offers:</strong> ${(data.offers || []).length}</p>
    <p><strong>Checkouts:</strong></p>
    <ul class="list">${checkoutItems || "<li class=\"muted\">None</li>"}</ul>
    <p><strong>Deliveries:</strong></p>
    <ul class="list">${deliveryItems || "<li class=\"muted\">None</li>"}</ul>
  `;
}

function renderReconResults(payload) {
  if (!payload.candidates || payload.candidates.length === 0) {
    reconResultsEl.innerHTML = "<p class=\"muted\">No venue candidates found.</p>";
    return;
  }
  reconResultsEl.innerHTML = `
    <p><strong>${payload.count}</strong> venue candidates found.</p>
    <ul class="list">
      ${payload.candidates.map((candidate) => `<li><strong>${candidate.name}</strong><br><a href="${candidate.url}" target="_blank" rel="noreferrer">${candidate.url}</a></li>`).join("")}
    </ul>
  `;
}

function renderJobs(jobs) {
  if (!jobs.length) {
    setStatus(jobStatusEl, "No jobs launched yet.");
    return;
  }

  jobStatusEl.className = "";
  jobStatusEl.innerHTML = jobs.slice(0, 6).map((job) => {
    const stage = job.result?.stage ? ` • ${job.result.stage}` : "";
    const resultSummary = job.result?.venues?.length
      ? `${job.result.venues.length} venues written`
      : job.result?.candidateCount
        ? `${job.result.candidateCount} candidates`
        : "";
    return `
      <div class="job-card ${job.status}">
        <strong>${job.label}</strong>
        <p>${job.kind} • ${job.status}${stage}</p>
        <p>${resultSummary || job.error || "Working..."}</p>
      </div>
    `;
  }).join("");
}

async function refreshJobs() {
  const jobs = await fetchJson("/api/jobs");
  renderJobs(jobs);
  return jobs;
}

function startPollingJob(jobId) {
  if (activeJobPoll) {
    clearInterval(activeJobPoll);
  }

  activeJobPoll = setInterval(async () => {
    try {
      const job = await fetchJson(`/api/jobs/${jobId}`);
      await refreshJobs();
      if (job.status === "completed" || job.status === "failed") {
        clearInterval(activeJobPoll);
        activeJobPoll = null;
        const preferredId = job.result?.venues?.[0]?.id;
        await loadVenues(preferredId);
        if (job.status === "failed") {
          setStatus(jobStatusEl, job.error || "Audit job failed.", "error");
        }
      }
    } catch (error) {
      clearInterval(activeJobPoll);
      activeJobPoll = null;
      setStatus(jobStatusEl, error.message, "error");
    }
  }, 2000);
}

singleAuditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.getElementById("single-query").value.trim();
  const city = document.getElementById("single-city").value.trim();
  const payload = query.startsWith("http://") || query.startsWith("https://")
    ? { url: query, city }
    : { name: query, city };

  setStatus(jobStatusEl, "Launching venue audit...", "muted");
  try {
    const job = await fetchJson("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await refreshJobs();
    startPollingJob(job.id);
  } catch (error) {
    setStatus(jobStatusEl, error.message, "error");
  }
});

previewReconButton.addEventListener("click", async () => {
  const city = document.getElementById("city-name").value.trim();
  const category = document.getElementById("city-category").value.trim();
  const limit = Number(document.getElementById("city-limit").value || "5");
  setStatus(reconResultsEl, "Running reconnaissance...", "muted");
  try {
    const payload = await fetchJson("/api/reconnaissance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, category, limit })
    });
    renderReconResults(payload);
  } catch (error) {
    setStatus(reconResultsEl, error.message, "error");
  }
});

cityAuditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = document.getElementById("city-name").value.trim();
  const category = document.getElementById("city-category").value.trim();
  const limit = Number(document.getElementById("city-limit").value || "5");

  setStatus(jobStatusEl, "Launching city-wide audit...", "muted");
  try {
    const job = await fetchJson("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, category, limit })
    });
    await refreshJobs();
    startPollingJob(job.id);
  } catch (error) {
    setStatus(jobStatusEl, error.message, "error");
  }
});

sendThreadButton.addEventListener("click", async () => {
  const thread = currentVenue?.threads?.find((item) => item.status === "drafted" || item.status === "queued");
  if (!thread) {
    setStatus(jobStatusEl, "No draft thread available for this venue.", "error");
    return;
  }
  try {
    await fetchJson("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.id })
    });
    await renderVenueDetail(currentVenue.venue.id);
    await refreshJobs();
  } catch (error) {
    setStatus(jobStatusEl, error.message, "error");
  }
});

async function bootstrap() {
  try {
    await Promise.all([loadVenues(), refreshJobs()]);
  } catch (error) {
    venueListEl.innerHTML = `<p>${error.message}</p>`;
  }
}

bootstrap();
