const venueListEl = document.getElementById("venue-list");
const emptyStateEl = document.getElementById("empty-state");
const detailEl = document.getElementById("detail");
const jobStatusEl = document.getElementById("job-status");
const reconResultsEl = document.getElementById("recon-results");
const singleAuditForm = document.getElementById("single-audit-form");
const cityAuditForm = document.getElementById("city-audit-form");
const previewReconButton = document.getElementById("preview-recon");

let venuesCache = [];
let activeJobPoll = null;

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

function renderVenueList(venues) {
  venuesCache = venues;
  venueListEl.innerHTML = "";
  venues.forEach((venue) => {
    const button = document.createElement("button");
    button.className = "venue-card";
    button.innerHTML = `
      <strong>${venue.name}</strong>
      <p>Score ${venue.score}</p>
      <p>${venue.topLeaks.join(" • ")}</p>
    `;
    button.addEventListener("click", async () => {
      document.querySelectorAll(".venue-card").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      await renderVenueDetail(venue.slug);
    });
    venueListEl.appendChild(button);
  });
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

async function loadVenues(preferredSlug) {
  const venues = await fetchJson("/api/venues");
  if (venues.length === 0) {
    venueListEl.innerHTML = "<p>No outputs yet. Launch an audit from the left.</p>";
    return;
  }

  renderVenueList(venues);
  const target = preferredSlug ? venues.find((venue) => venue.slug === preferredSlug) : venues[0];
  if (target) {
    await renderVenueDetail(target.slug);
    document.querySelectorAll(".venue-card").forEach((el) => el.classList.remove("active"));
    const activeIndex = venues.findIndex((venue) => venue.slug === target.slug);
    document.querySelectorAll(".venue-card")[activeIndex]?.classList.add("active");
  }
}

async function renderVenueDetail(slug) {
  const data = await fetchJson(`/api/venues/${slug}`);
  emptyStateEl.classList.add("hidden");
  detailEl.classList.remove("hidden");

  setText("venue-url", data.audit.venue.finalUrl || data.audit.venue.url || "Public site");
  setText("venue-name", data.audit.venue.name);
  setText("venue-score", String(data.audit.score));
  setText("report", data.report);
  setText("email", data.outreach.email);
  setText("dm", data.outreach.dm);

  const topLeaks = document.getElementById("top-leaks");
  topLeaks.innerHTML = "";
  data.audit.topLeaks.slice(0, 5).forEach((leak) => {
    const item = document.createElement("li");
    item.textContent = `${leak.title}: ${leak.fix}`;
    topLeaks.appendChild(item);
  });

  const impact = document.getElementById("impact");
  impact.innerHTML = `
    <p><strong>${data.analysis.impact.inquiriesPerMonth}</strong></p>
    <p><strong>${data.analysis.impact.eventsPerMonth}</strong></p>
    <ul class="list">${data.analysis.impact.assumptions.map((item) => `<li>${item}</li>`).join("")}</ul>
  `;

  const fixFiles = document.getElementById("fix-files");
  fixFiles.innerHTML = "";
  data.fixFiles.forEach((file) => {
    const item = document.createElement("li");
    item.innerHTML = `<a href="${file.url}" target="_blank" rel="noreferrer">${file.name}</a>`;
    fixFiles.appendChild(item);
  });
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
  jobStatusEl.innerHTML = jobs.slice(0, 5).map((job) => {
    const resultSummary = job.result?.venues?.length
      ? `${job.result.venues.length} venues written`
      : job.result?.candidateCount
        ? `${job.result.candidateCount} candidates`
        : "";
    return `
      <div class="job-card ${job.status}">
        <strong>${job.label}</strong>
        <p>${job.kind} • ${job.status}</p>
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
        const preferredSlug = job.result?.venues?.[0]?.slug;
        await loadVenues(preferredSlug);
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

async function bootstrap() {
  try {
    await Promise.all([loadVenues(), refreshJobs()]);
  } catch (error) {
    venueListEl.innerHTML = `<p>${error.message}</p>`;
  }
}

bootstrap();
