const singleAuditForm = document.getElementById("single-audit-form");
const cityAuditForm = document.getElementById("city-audit-form");
const previewReconButton = document.getElementById("preview-recon");
const launchStatusEl = document.getElementById("launch-status");
const tabBarEl = document.getElementById("tab-bar");
const tabPanelsEl = document.getElementById("tab-panels");
const singleVerticalEl = document.getElementById("single-vertical");
const cityVerticalEl = document.getElementById("city-vertical");
const cityCategoryEl = document.getElementById("city-category");

const tabs = [];
let activeTabId = null;
let globalData = {
  jobs: [],
  leads: [],
  verticals: []
};

function makeTab(id, type, title, closable = true, data = {}) {
  return { id, type, title, closable, data, refreshHandle: null };
}

function ensureBaseTabs() {
  if (!tabs.find((tab) => tab.id === "jobs-root")) {
    tabs.push(makeTab("jobs-root", "jobs-root", "Jobs", false));
  }
  if (!tabs.find((tab) => tab.id === "leads-root")) {
    tabs.push(makeTab("leads-root", "leads-root", "Leads", false));
  }
  if (!activeTabId) {
    activeTabId = "jobs-root";
  }
}

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

function setLaunchStatus(message, variant = "muted") {
  launchStatusEl.className = variant;
  launchStatusEl.textContent = message;
}

function upsertTab(nextTab) {
  const existing = tabs.find((tab) => tab.id === nextTab.id);
  if (existing) {
    existing.title = nextTab.title;
    existing.data = { ...existing.data, ...nextTab.data };
  } else {
    tabs.push(nextTab);
  }
  activeTabId = nextTab.id;
  renderWorkspace();
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) {
    return;
  }
  const [tab] = tabs.splice(index, 1);
  if (tab.refreshHandle) {
    clearInterval(tab.refreshHandle);
  }
  if (activeTabId === id) {
    activeTabId = tabs[Math.max(0, index - 1)]?.id ?? "jobs-root";
  }
  renderWorkspace();
}

function activateTab(id) {
  activeTabId = id;
  renderWorkspace();
}

function renderWorkspace() {
  ensureBaseTabs();

  tabBarEl.innerHTML = "";
  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.className = `tab-pill ${tab.id === activeTabId ? "active" : ""}`;
    button.innerHTML = `
      <span>${tab.title}</span>
      ${tab.closable ? `<span class="tab-close" data-close="${tab.id}">×</span>` : ""}
    `;
    button.addEventListener("click", (event) => {
      const closeId = event.target?.dataset?.close;
      if (closeId) {
        event.stopPropagation();
        closeTab(closeId);
        return;
      }
      activateTab(tab.id);
    });
    tabBarEl.appendChild(button);
  });

  tabPanelsEl.innerHTML = "";
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (!activeTab) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "workspace-panel";
  if (activeTab.type === "jobs-root") {
    panel.appendChild(renderJobsRoot());
  } else if (activeTab.type === "leads-root") {
    panel.appendChild(renderLeadsRoot());
  } else if (activeTab.type === "job-detail" || activeTab.type === "live-job") {
    panel.appendChild(renderJobDetail(activeTab));
  } else if (activeTab.type === "lead-detail") {
    panel.appendChild(renderLeadDetail(activeTab));
  }
  tabPanelsEl.appendChild(panel);
}

function renderCardList(items, formatter, emptyText) {
  const wrap = document.createElement("div");
  wrap.className = "card-list";
  if (!items.length) {
    wrap.innerHTML = `<p class="muted">${emptyText}</p>`;
    return wrap;
  }
  items.forEach((item) => wrap.appendChild(formatter(item)));
  return wrap;
}

function renderJobsRoot() {
  const wrap = document.createElement("div");
  wrap.className = "panel-stack";
  const header = document.createElement("div");
  header.className = "workspace-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">Permanent Tab</p>
      <h2>Jobs</h2>
    </div>
    <p class="muted">${globalData.jobs.length} jobs</p>
  `;
  wrap.appendChild(header);
  wrap.appendChild(renderCardList(globalData.jobs, renderJobCard, "No jobs yet."));
  return wrap;
}

function renderLeadsRoot() {
  const wrap = document.createElement("div");
  wrap.className = "panel-stack";
  const header = document.createElement("div");
  header.className = "workspace-header";
  header.innerHTML = `
    <div>
      <p class="eyebrow">Permanent Tab</p>
      <h2>Leads</h2>
    </div>
    <p class="muted">${globalData.leads.length} leads</p>
  `;
  wrap.appendChild(header);
  wrap.appendChild(renderCardList(globalData.leads, renderLeadCard, "No leads yet."));
  return wrap;
}

function renderJobCard(job) {
  const button = document.createElement("button");
  button.className = "workspace-card job-card-card";
  button.innerHTML = `
    <strong>${job.label}</strong>
    <p>${job.kind} • ${job.status}${job.result?.stage ? ` • ${job.result.stage}` : ""}</p>
    <p>${job.input?.vertical ? `${job.input.vertical} • ` : ""}${job.result?.candidateCount ? `${job.result.candidateCount} candidates` : job.error || "Open details"}</p>
  `;
  button.addEventListener("click", () => {
    upsertTab(makeTab(`job-${job.id}`, "job-detail", `Job: ${job.label}`, true, { jobId: job.id }));
    void refreshJobTab(`job-${job.id}`);
  });
  return button;
}

function renderLeadCard(lead) {
  const button = document.createElement("button");
  button.className = "workspace-card lead-card";
  button.innerHTML = `
    <strong>${lead.name}</strong>
    <p>${lead.city || "Unknown city"} • ${lead.vertical || "event_venue"} • ${lead.status}</p>
    <p>Score ${lead.score ?? "N/A"} • ${lead.topLeaks.join(" • ") || "No leak data yet"}</p>
  `;
  button.addEventListener("click", () => {
    upsertTab(makeTab(`lead-${lead.id}`, "lead-detail", `Lead: ${lead.name}`, true, { leadId: lead.id }));
    void refreshLeadTab(`lead-${lead.id}`);
  });
  return button;
}

function renderJobDetail(tab) {
  const job = tab.data.job;
  const events = tab.data.activity?.events || [];
  const wrap = document.createElement("div");
  wrap.className = "panel-stack";
  wrap.innerHTML = `
    <div class="workspace-header">
      <div>
        <p class="eyebrow">${tab.type === "live-job" ? "Live Activity" : "Job Detail"}</p>
        <h2>${job?.label || "Loading job..."}</h2>
      </div>
      <p class="muted">${job ? `${job.kind} • ${job.status}` : ""}</p>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  grid.innerHTML = `
    <article class="panel"><h3>Status</h3><div class="stack-block">${job ? `
      <p><strong>${job.status}</strong></p>
      <p>${job.result?.stage ? `Stage: ${job.result.stage}` : "No active stage"}</p>
      <p>${job.result?.candidateCount ? `${job.result.candidateCount} candidates` : job.error || ""}</p>
    ` : `<p class="muted">Loading...</p>`}</div></article>
    <article class="panel"><h3>Activity stream</h3><ul class="timeline compact">${events.length ? events.map((event) => `
      <li>
        <strong>${event.stage}</strong> • ${event.eventType}${event.decision ? ` • ${event.decision}` : ""}
        <br><span class="muted">${event.createdAt}</span>
      </li>
    `).join("") : `<li class="muted">No activity yet.</li>`}</ul></article>
    <article class="panel wide"><h3>Result</h3><pre class="pre">${job ? escapeHtml(JSON.stringify(job.result || {}, null, 2)) : "Loading..."}</pre></article>
  `;
  wrap.appendChild(grid);
  return wrap;
}

function renderLeadDetail(tab) {
  const data = tab.data.lead;
  const wrap = document.createElement("div");
  wrap.className = "panel-stack";
  if (!data) {
    wrap.innerHTML = `<p class="muted">Loading lead...</p>`;
    return wrap;
  }

  wrap.innerHTML = `
    <div class="workspace-header">
      <div>
        <p class="eyebrow">Lead Detail</p>
        <h2>${data.venue.name}</h2>
        <p class="muted">${data.venue.vertical || "event_venue"} • ${data.profile?.finalUrl || data.venue.canonicalUrl || "Public site"}</p>
      </div>
      <div class="score-chip">${data.audit?.score ?? "N/A"}</div>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "detail-grid";
  grid.innerHTML = `
    <article class="panel"><h3>Top leaks</h3><ul class="list">${(data.audit?.topLeaks || []).map((leak) => `<li>${leak.title}: ${leak.fix}</li>`).join("") || "<li class=\"muted\">None</li>"}</ul></article>
    <article class="panel"><h3>Qualification</h3><div class="stack-block">${data.qualification ? `
      <p><strong>${data.qualification.reason}</strong></p>
      <ul class="list">${(data.qualification.rationale || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    ` : `<p class="muted">No qualification decision recorded yet.</p>`}</div></article>
    <article class="panel"><h3>Contacts</h3><ul class="list">${(data.contacts || []).map((contact) => `<li>${contact.kind}: ${contact.value}<br><span class="muted">${contact.roleHint || "unknown"} • confidence ${contact.confidence.toFixed(2)}</span></li>`).join("") || "<li class=\"muted\">None</li>"}</ul></article>
    <article class="panel"><h3>Threads</h3><div class="panel-header"><span></span><button type="button" class="inline-action" data-send-lead="${data.venue.id}">Send draft</button></div><ul class="list">${(data.threads || []).map((thread) => `<li>${thread.status}<br><span class="muted">${thread.subject || "No subject"}</span></li>`).join("") || "<li class=\"muted\">None</li>"}</ul></article>
    <article class="panel wide"><h3>Audit report</h3><pre class="pre">${escapeHtml(data.report || "No report generated yet.")}</pre></article>
    <article class="panel"><h3>Outreach email</h3><pre class="pre">${escapeHtml(data.outreach?.email || "No outreach email generated yet.")}</pre></article>
    <article class="panel"><h3>Short DM</h3><pre class="pre">${escapeHtml(data.outreach?.dm || "No DM generated yet.")}</pre></article>
    <article class="panel"><h3>Billing + delivery</h3><div class="stack-block">
      <p><strong>Offers:</strong> ${(data.offers || []).length}</p>
      <p><strong>Checkouts:</strong></p>
      <ul class="list">${(data.checkouts || []).map((checkout) => `<li>${checkout.status}${checkout.checkoutUrl ? ` • <a href="${checkout.checkoutUrl}" target="_blank" rel="noreferrer">checkout</a>` : ""}</li>`).join("") || "<li class=\"muted\">None</li>"}</ul>
      <p><strong>Deliveries:</strong></p>
      <ul class="list">${(data.deliveries || []).map((delivery) => `<li>${delivery.status}${delivery.deliveryUrl ? ` • <a href="${delivery.deliveryUrl}" target="_blank" rel="noreferrer">portal</a>` : ""}</li>`).join("") || "<li class=\"muted\">None</li>"}</ul>
    </div></article>
    <article class="panel"><h3>Fix pack</h3><ul class="list">${(data.assets || []).map((asset) => `<li>${asset.url ? `<a href="${asset.url}" target="_blank" rel="noreferrer">${asset.type}</a>` : asset.type}</li>`).join("") || "<li class=\"muted\">None</li>"}</ul></article>
    <article class="panel wide"><h3>Dossier timeline</h3><ul class="timeline">${(data.stageEvents || []).map((event) => `<li><strong>${event.stage}</strong> • ${event.eventType}${event.decision ? ` • ${event.decision}` : ""}<br><span class="muted">${event.createdAt}</span></li>`).join("") || "<li class=\"muted\">No stage events recorded.</li>"}</ul></article>
  `;
  grid.querySelector(`[data-send-lead="${data.venue.id}"]`)?.addEventListener("click", () => void sendDraftForLead(data));
  wrap.appendChild(grid);
  return wrap;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function refreshGlobalData() {
  const [jobs, leads, verticals] = await Promise.all([
    fetchJson("/api/jobs"),
    fetchJson("/api/venues"),
    fetchJson("/api/verticals")
  ]);
  globalData = { jobs, leads, verticals };
  renderWorkspace();
}

function getVerticalDefaultCategory(verticalId) {
  return globalData.verticals.find((item) => item.id === verticalId)?.defaultCategory || "music venue";
}

function syncCategoryToVertical() {
  if (!cityCategoryEl.dataset.userEdited || cityCategoryEl.value.trim().length === 0) {
    cityCategoryEl.value = getVerticalDefaultCategory(cityVerticalEl.value);
  }
}

async function refreshJobTab(tabId) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) {
    return;
  }
  const payload = await fetchJson(`/api/jobs/${tab.data.jobId}/activity`);
  tab.data.job = payload.job;
  tab.data.activity = payload;
  if ((payload.job.status === "completed" || payload.job.status === "failed") && tab.refreshHandle) {
    clearInterval(tab.refreshHandle);
    tab.refreshHandle = null;
  }
  await refreshGlobalData();
  renderWorkspace();
}

async function refreshLeadTab(tabId) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) {
    return;
  }
  tab.data.lead = await fetchJson(`/api/venues/${tab.data.leadId}`);
  await refreshGlobalData();
  renderWorkspace();
}

function startLiveJobTab(job, titlePrefix) {
  const tabId = `live-${job.id}`;
  upsertTab(makeTab(tabId, "live-job", `${titlePrefix}: ${job.label}`, true, { jobId: job.id, job }));
  const tab = tabs.find((item) => item.id === tabId);
  if (tab?.refreshHandle) {
    clearInterval(tab.refreshHandle);
  }
  tab.refreshHandle = setInterval(() => {
    void refreshJobTab(tabId);
  }, 1500);
  void refreshJobTab(tabId);
}

async function sendDraftForLead(leadData) {
  const thread = (leadData.threads || []).find((item) => item.status === "drafted" || item.status === "queued");
  if (!thread) {
    setLaunchStatus("No draft thread available for this lead.", "error");
    return;
  }
  try {
    await fetchJson("/api/outreach/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.id })
    });
    setLaunchStatus("Draft sent.");
    const tab = tabs.find((item) => item.type === "lead-detail" && item.data.leadId === leadData.venue.id);
    if (tab) {
      await refreshLeadTab(tab.id);
    }
  } catch (error) {
    setLaunchStatus(error.message, "error");
  }
}

singleAuditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.getElementById("single-query").value.trim();
  const city = document.getElementById("single-city").value.trim();
  const vertical = singleVerticalEl.value;
  const payload = query.startsWith("http://") || query.startsWith("https://")
    ? { url: query, city, vertical }
    : { name: query, city, vertical };

  setLaunchStatus("Launching venue audit...");
  try {
    const job = await fetchJson("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    startLiveJobTab(job, "Live");
  } catch (error) {
    setLaunchStatus(error.message, "error");
  }
});

previewReconButton.addEventListener("click", async () => {
  const city = document.getElementById("city-name").value.trim();
  const category = cityCategoryEl.value.trim();
  const vertical = cityVerticalEl.value;
  const limit = Number(document.getElementById("city-limit").value || "5");
  setLaunchStatus("Launching reconnaissance...");
  try {
    const job = await fetchJson("/api/reconnaissance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, category, vertical, limit })
    });
    startLiveJobTab(job, "Live");
  } catch (error) {
    setLaunchStatus(error.message, "error");
  }
});

cityAuditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = document.getElementById("city-name").value.trim();
  const category = cityCategoryEl.value.trim();
  const vertical = cityVerticalEl.value;
  const limit = Number(document.getElementById("city-limit").value || "5");

  setLaunchStatus("Launching city-wide audit...");
  try {
    const job = await fetchJson("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, category, vertical, limit })
    });
    startLiveJobTab(job, "Live");
  } catch (error) {
    setLaunchStatus(error.message, "error");
  }
});

async function bootstrap() {
  ensureBaseTabs();
  cityCategoryEl.addEventListener("input", () => {
    cityCategoryEl.dataset.userEdited = "true";
  });
  cityVerticalEl.addEventListener("change", () => {
    cityCategoryEl.dataset.userEdited = "";
    syncCategoryToVertical();
  });
  await refreshGlobalData();
  syncCategoryToVertical();
}

bootstrap();
