function showScreen(id) {
  const current = document.querySelector(".screen.active");
  const next    = document.getElementById(id);
  if (current === next) return;

  if (current) {
    
    current.classList.add("leaving");
    setTimeout(() => {
      current.classList.remove("active", "visible", "leaving");
      
      next.classList.add("active");
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          next.classList.add("visible");
        });
      });
    }, 260);
  } else {
    next.classList.add("active");
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        next.classList.add("visible");
      });
    });
  }
}

function goToWelcome() { showScreen("screen-welcome"); }
function goToKiosk()   { showScreen("screen-kiosk"); loadKioskStats(); }

function goToForm() {
  
  visitor.name = "";
  visitor.email = "";
  visitor.isNew = true;
  visitor.prevData = null;
  
  document.getElementById("visitorForm").reset();
  document.querySelectorAll('input[name="reason"]').forEach(r => r.checked = false);
  showScreen("screen-form");
}

function showAdminPage() {
  showScreen("screen-admin");
  if (sessionStorage.getItem("admin_logged_in")) showDashboard();
}

function showDashboard() {
  window.location.href = "admin-dashboard.html";
}

const visitor = {
  name:    "",
  email:   "",
  program: "",
  usertype: "",
  isNew:   true,
  prevData: null  
};

function showBlockedPopup() {
  
  localStorage.removeItem("visitor_email");
  localStorage.removeItem("visitor_name");
  localStorage.removeItem("login_intent");
  visitor.email = ""; visitor.name = ""; visitor.isNew = true; visitor.prevData = null;
  document.getElementById("kiosk-logged-in").classList.add("hidden");
  document.getElementById("kiosk-default-state").classList.remove("hidden");
  
  document.getElementById("blocked-popup").classList.add("show");
}

function closeBlockedPopup() {
  document.getElementById("blocked-popup").classList.remove("show");
  
  goToWelcome();
}

async function checkReturningVisitor(email, name) {
  visitor.email = email;
  visitor.name  = name || "";

  
  showScreen("screen-welcome-neu");
  document.getElementById("wn-loading").classList.remove("hidden");
  document.getElementById("wn-proceed-btn").style.display = "none";
  document.getElementById("wn-sub").textContent = "Checking your visitor profile…";

  try {
    const existing = await sbGet(
      `visitors?select=name,email,user_type,program,status&email=eq.${encodeURIComponent(email)}&limit=1`
    );

    
    const blocked = existing.find(r => r.status === "blocked");
    if (blocked) {
      showBlockedPopup();
      return;
    }

    
    if (existing.length > 0) {
      visitor.isNew    = false;
      visitor.prevData = existing[0];
      visitor.name     = visitor.name || existing[0].name || "";
      visitor.program  = existing[0].program || "";
      visitor.usertype = existing[0].user_type || "";

      document.getElementById("wn-loading").classList.add("hidden");
      document.getElementById("wn-sub").textContent = `Hello, ${visitor.name || email}! Your profile is ready.`;
      document.getElementById("wn-proceed-btn").style.display = "inline-flex";
    } else {
      visitor.isNew = true;
      document.getElementById("wn-loading").classList.add("hidden");
      document.getElementById("wn-sub").textContent = "Welcome! Let's get you checked in.";
      document.getElementById("wn-proceed-btn").style.display = "inline-flex";
    }
  } catch(e) {
    console.error("Visitor check error:", e);
    visitor.isNew = true;
    document.getElementById("wn-loading").classList.add("hidden");
    document.getElementById("wn-sub").textContent = "Welcome! Let's get you checked in.";
    document.getElementById("wn-proceed-btn").style.display = "inline-flex";
  }
}

function proceedFromWelcomeNeu() {
  if (visitor.isNew) {
    
    if (visitor.name)  document.getElementById("v-name").value  = visitor.name;
    if (visitor.email) document.getElementById("v-email").value = visitor.email;
    showScreen("screen-form");
  } else {
    
    const nameDisplay = visitor.name || visitor.email;
    document.getElementById("wb-name-display").textContent = `Great to see you again, ${nameDisplay}!`;
    document.getElementById("ret-greeting").textContent    = `Welcome back, ${nameDisplay}!`;
    showScreen("screen-welcome-back");
  }
}

const SB_HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Prefer": "return=representation"
};

function authHeaders() {
  const token = sessionStorage.getItem("admin_token") || SUPABASE_ANON_KEY;
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${token}`,
    "Prefer": "return=representation"
  };
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST", headers: SB_HEADERS, body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH", headers: authHeaders(), body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function sbDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE", headers: authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
}

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekStart() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
}

async function loadKioskStats() {
  try {
    const [all, todayR, weekR, monthR] = await Promise.all([
      sbGet("visitors?select=id"),
      sbGet(`visitors?select=id&visit_date=eq.${todayStr()}`),
      sbGet(`visitors?select=id&visit_date=gte.${weekStart()}`),
      sbGet(`visitors?select=id&visit_date=gte.${monthStart()}`)
    ]);
    document.getElementById("stat-today").textContent  = todayR.length;
    document.getElementById("stat-week").textContent   = weekR.length;
    document.getElementById("stat-month").textContent  = monthR.length;
    document.getElementById("stat-total").textContent  = all.length;
  } catch(e) { console.error("Stats:", e); }
}

document.getElementById("visitorForm").addEventListener("submit", async e => {
  e.preventDefault();

  const name     = document.getElementById("v-name").value.trim();
  const usertype = document.getElementById("v-usertype").value;
  const program  = document.getElementById("v-program").value;
  const email    = document.getElementById("v-email").value.trim().toLowerCase();
  const reasonEl = document.querySelector('input[name="reason"]:checked');
  const msgEl    = document.getElementById("form-msg");

  if (!email.endsWith("@neu.edu.ph")) {
    showMsg(msgEl, "error", "❌ Please use your @neu.edu.ph institutional email.");
    return;
  }
  if (!reasonEl) {
    showMsg(msgEl, "error", "❌ Please select a purpose of visit.");
    return;
  }
  const reason = reasonEl.value;

  
  
  if (!visitor.email && email) {
    visitor.name    = name;
    visitor.email   = email;
    visitor.usertype = usertype;
    visitor.program  = program;

    
    try {
      const existing = await sbGet(
        `visitors?select=name,email,user_type,program,status&email=eq.${encodeURIComponent(email)}&limit=1`
      );
      const blocked = existing.find(r => r.status === "blocked");
      if (blocked) {
        showMsg(msgEl, "error", "⛔ Access Denied. Your account has been blocked. Please contact the library administrator.");
        return;
      }
      if (existing.length > 0) {
        
        visitor.isNew    = false;
        visitor.prevData = existing[0];
        visitor.name     = name || existing[0].name || "";
        visitor.program  = program || existing[0].program || "";
        visitor.usertype = usertype || existing[0].user_type || "";
        const nameDisplay = visitor.name || email;
        document.getElementById("wb-name-display").textContent = `Great to see you again, ${nameDisplay}!`;
        document.getElementById("ret-greeting").textContent    = `Welcome back, ${nameDisplay}!`;
        
        const retRadio = document.querySelector(`input[name="ret-reason"][value="${reason}"]`);
        if (retRadio) retRadio.checked = true;
        showScreen("screen-welcome-back");
        return;
      }
    } catch(err) {
      console.error("Returning check error:", err);
    }
  }

  
  await submitVisit({ name, usertype, program, email, reason, msgEl,
    btnId: "submitBtn", textId: "submitText", spinnerId: "submitSpinner" });
});

document.getElementById("returningForm").addEventListener("submit", async e => {
  e.preventDefault();
  const reasonEl = document.querySelector('input[name="ret-reason"]:checked');
  const msgEl    = document.getElementById("ret-form-msg");
  if (!reasonEl) {
    showMsg(msgEl, "error", "❌ Please select a purpose of visit.");
    return;
  }
  await submitVisit({
    name:      visitor.name     || visitor.prevData?.name     || "",
    usertype:  visitor.usertype || visitor.prevData?.user_type || "",
    program:   visitor.program  || visitor.prevData?.program  || "",
    email:     visitor.email,
    reason:    reasonEl.value,
    msgEl,
    btnId: "retSubmitBtn", textId: "retSubmitText", spinnerId: "retSubmitSpinner"
  });
});

function showSuccessAndReturn(name) {
  const displayName = name ? `, ${name.split(" ")[0]}` : "";

  
  showScreen("screen-kiosk");
  loadKioskStats();

  
  setTimeout(() => {
    const msg = document.getElementById("kiosk-success");
    if (!msg) return;
    msg.textContent = `✅ Visit logged${displayName}! Enjoy your stay at the NEU Library.`;
    msg.classList.add("show");
    setTimeout(() => msg.classList.remove("show"), 4500);
  }, 320); 
}
async function submitVisit({ name, usertype, program, email, reason, msgEl, btnId, textId, spinnerId }) {
  const now        = new Date();
  const visit_date = now.toISOString().slice(0, 10);
  const visit_time = now.toTimeString().slice(0, 8);

  document.getElementById(btnId).disabled = true;
  document.getElementById(textId).textContent = "Logging visit…";
  document.getElementById(spinnerId).classList.remove("hidden");
  hideMsg(msgEl);

  try {
    
    const blocked = await sbGet(
      `visitors?select=status&email=eq.${encodeURIComponent(email)}&status=eq.blocked&limit=1`
    );
    if (blocked.length > 0) {
      showBlockedPopup();
      return;
    }

    await sbPost("visitors", {
      name, user_type: usertype, program, email, reason,
      visit_date, visit_time, status: "active"
    });

    
    document.getElementById("visitorForm").reset();
    document.getElementById("returningForm").reset();
    document.querySelectorAll('input[name="reason"], input[name="ret-reason"]').forEach(r => r.checked = false);
    visitor.name = ""; visitor.email = ""; visitor.program = "";
    visitor.usertype = ""; visitor.isNew = true; visitor.prevData = null;
    
    localStorage.removeItem("visitor_email");
    localStorage.removeItem("visitor_name");
    
    document.getElementById("kiosk-logged-in").classList.add("hidden");
    document.getElementById("kiosk-default-state").classList.remove("hidden");

    
    showSuccessAndReturn(name);
  } catch(err) {
    showMsg(msgEl, "error", "❌ Failed to log visit. Please try again.");
    console.error(err);
  } finally {
    document.getElementById(btnId).disabled = false;
    document.getElementById(textId).textContent = "✓ Log My Visit";
    document.getElementById(spinnerId).classList.add("hidden");
  }
}

const ADMIN_WHITELIST = [
  "carlwilliam.paming@neu.edu.ph",
  "jcesperanza@neu.edu.ph",
  "ezekielkayl.peralta@neu.edu.ph"
];

function isAdminAllowed(email) {
  return ADMIN_WHITELIST.includes((email || "").toLowerCase().trim());
}

function checkAdminEmail() {
  const email  = document.getElementById("adminEmailInput").value.trim().toLowerCase();
  const msgEl  = document.getElementById("login-msg");

  if (!email) {
    showMsg(msgEl, "error", "❌ Please enter your email address.");
    return;
  }
  if (!isAdminAllowed(email)) {
    showMsg(msgEl, "error", "⛔ Access denied. This email is not authorized as an administrator.");
    return;
  }

  
  hideMsg(msgEl);
  sessionStorage.setItem("pending_admin_email", email);
  sessionStorage.setItem("google_intent", "admin");

  const redirectTo = window.location.origin + "/admin-dashboard.html";
  window.location.href =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("adminEmailInput");
  if (input) input.addEventListener("keydown", e => { if (e.key === "Enter") checkAdminEmail(); });
});

function resetAdminLogin() {
  const input = document.getElementById("adminEmailInput");
  if (input) input.value = "";
  sessionStorage.removeItem("pending_admin_email");
  hideMsg(document.getElementById("login-msg"));
}

async function signInVisitor() {
  const btn = document.querySelector(".kiosk-google-btn");
  if (btn) { btn.disabled = true; btn.textContent = "Redirecting to Google…"; }

  
  localStorage.setItem("login_intent", "visitor");

  
  const redirectTo = window.location.origin + "/index.html";
  window.location.href =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;
}

async function signInWithGoogle() {
  const btn = document.getElementById("googleLoginBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Redirecting to Google…"; }

  localStorage.setItem("login_intent", "admin");
  const redirectTo = window.location.origin + "/admin-dashboard.html";
  window.location.href =
    `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectTo)}`;
}

function clearVisitorSession() {
  localStorage.removeItem("visitor_email");
  localStorage.removeItem("visitor_name");
  localStorage.removeItem("login_intent");
  visitor.email = ""; visitor.name = ""; visitor.isNew = true; visitor.prevData = null;
  document.getElementById("kiosk-logged-in").classList.add("hidden");
  document.getElementById("kiosk-default-state").classList.remove("hidden");
}

async function handleAuthCallback() {
  const hash        = window.location.hash;
  const params      = new URLSearchParams(hash.replace("#", "?"));
  const accessToken = params.get("access_token");
  if (!accessToken) return false;

  
  history.replaceState(null, "", window.location.pathname);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` }
  });
  if (!res.ok) return false;

  const user   = await res.json();
  const intent = localStorage.getItem("login_intent");

  if (intent === "visitor") {
    const fullName = user.user_metadata?.full_name
                  || user.user_metadata?.name
                  || user.email?.split("@")[0]?.replace(/\./g, " ") || "";

    
    localStorage.setItem("visitor_email", user.email || "");
    localStorage.setItem("visitor_name",  fullName);
    localStorage.removeItem("login_intent"); 

    
    showKioskLoggedIn(user.email, fullName);
    return true;

  } else {
    
    if (!isAdminAllowed(user.email)) {
      sessionStorage.clear();
      goToWelcome();
      return false;
    }
    sessionStorage.setItem("admin_logged_in", "true");
    sessionStorage.setItem("admin_email",     user.email || "");
    sessionStorage.setItem("admin_token",     accessToken);
    window.location.href = "admin-dashboard.html";
    return true;
  }
}

function showKioskLoggedIn(email, name) {
  visitor.email = email;
  visitor.name  = name;

  
  document.getElementById("kiosk-email-display").textContent = email;
  document.getElementById("kiosk-logged-in").classList.remove("hidden");
  document.getElementById("kiosk-default-state").classList.add("hidden");

  
  showScreen("screen-kiosk");
  loadKioskStats();
}

async function proceedAfterLogin() {
  const email = visitor.email || localStorage.getItem("visitor_email") || "";
  const name  = visitor.name  || localStorage.getItem("visitor_name")  || "";
  if (!email) { goToForm(); return; }
  await checkReturningVisitor(email, name);
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  const token = sessionStorage.getItem("admin_token");
  if (token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` }
    }).catch(() => {});
  }
  sessionStorage.clear();
  document.getElementById("adminLoginWrap").classList.remove("hidden");
  document.getElementById("adminDashboard").classList.add("hidden");
  resetAdminLogin();
});

async function loadAdminStats() {
  try {
    const [all, todayR, weekR, monthR] = await Promise.all([
      sbGet("visitors?select=id"),
      sbGet(`visitors?select=id&visit_date=eq.${todayStr()}`),
      sbGet(`visitors?select=id&visit_date=gte.${weekStart()}`),
      sbGet(`visitors?select=id&visit_date=gte.${monthStart()}`)
    ]);
    document.getElementById("d-today").textContent  = todayR.length;
    document.getElementById("d-week").textContent   = weekR.length;
    document.getElementById("d-month").textContent  = monthR.length;
    document.getElementById("d-total").textContent  = all.length;
  } catch(e) { console.error(e); }
}

let adminRows = [], adminPage = 1;
const PER_PAGE = 15;

async function loadAdminRecords(page = 1) {
  adminPage = page;
  const query     = document.getElementById("adminSearch").value.trim();
  const dateQuick = document.getElementById("adminDateQuick").value;
  const dateFrom  = document.getElementById("adminDateFrom").value;
  const dateTo    = document.getElementById("adminDateTo").value;
  const tbody     = document.getElementById("adminRecordsBody");
  tbody.innerHTML = `<tr><td colspan="10" class="loading-row">Loading records…</td></tr>`;

  try {
    let params = `visitors?select=*&order=created_at.desc`;
    if (!dateFrom && !dateTo) {
      if      (dateQuick === "today") params += `&visit_date=eq.${todayStr()}`;
      else if (dateQuick === "week")  params += `&visit_date=gte.${weekStart()}`;
      else if (dateQuick === "month") params += `&visit_date=gte.${monthStart()}`;
    }
    if (dateFrom) params += `&visit_date=gte.${dateFrom}`;
    if (dateTo)   params += `&visit_date=lte.${dateTo}`;

    let rows = await sbGet(params);
    if (query) {
      const q = query.toLowerCase();
      rows = rows.filter(r =>
        (r.name||"").toLowerCase().includes(q) ||
        (r.email||"").toLowerCase().includes(q) ||
        (r.program||"").toLowerCase().includes(q)
      );
    }
    adminRows = rows;
    renderAdminTable(rows, page);
    renderPagination(rows.length, page, "adminPagination", loadAdminRecords);
  } catch(err) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading-row">Error loading records.</td></tr>`;
    console.error(err);
  }
}

function renderAdminTable(allRows, page) {
  const tbody = document.getElementById("adminRecordsBody");
  const start = (page - 1) * PER_PAGE;
  const rows  = allRows.slice(start, start + PER_PAGE);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="loading-row">No records found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r, i) => `
    <tr class="${r.status === "blocked" ? "row-blocked" : ""}">
      <td>${start + i + 1}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.program || "—")}</td>
      <td>${esc(r.email || "—")}</td>
      <td>${esc(r.user_type || "—")}</td>
      <td><span class="badge">${esc(r.reason)}</span></td>
      <td>${r.visit_date}</td>
      <td>${r.visit_time ? r.visit_time.slice(0,5) : "—"}</td>
      <td><span class="status-badge ${r.status}">${r.status}</span></td>
      <td class="actions-cell">
        ${r.status === "active"
          ? `<button class="btn-sm danger" onclick="blockVisitor('${r.id}')">Block</button>`
          : `<button class="btn-sm success" onclick="unblockVisitor('${r.id}')">Unblock</button>`}
        <button class="btn-sm neutral" onclick="deleteVisitor('${r.id}')">Delete</button>
      </td>
    </tr>`).join("");
}

function renderPagination(total, current, containerId, callback) {
  const pages = Math.ceil(total / PER_PAGE);
  const el    = document.getElementById(containerId);
  if (pages <= 1) { el.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= pages; i++)
    html += `<button class="page-btn ${i===current?"active":""}" onclick="${callback.name}(${i})">${i}</button>`;
  el.innerHTML = html;
}

async function blockVisitor(id) {
  if (!confirm("Block this visitor?")) return;
  try { await sbPatch(`visitors?id=eq.${id}`, { status: "blocked" }); loadAdminRecords(adminPage); loadAdminStats(); }
  catch(e) { alert("Error: " + e.message); }
}
async function unblockVisitor(id) {
  if (!confirm("Unblock this visitor?")) return;
  try { await sbPatch(`visitors?id=eq.${id}`, { status: "active" }); loadAdminRecords(adminPage); }
  catch(e) { alert("Error: " + e.message); }
}
async function deleteVisitor(id) {
  if (!confirm("Permanently delete this record?")) return;
  try { await sbDelete(`visitors?id=eq.${id}`); loadAdminRecords(adminPage); loadAdminStats(); }
  catch(e) { alert("Error: " + e.message); }
}

function exportPDF() {
  if (!adminRows.length) { alert("No records to export."); return; }

  const rows = adminRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.program || "—")}</td>
      <td>${esc(r.email || "—")}</td>
      <td>${esc(r.user_type || "—")}</td>
      <td>${esc(r.reason)}</td>
      <td>${r.visit_date}</td>
      <td>${r.visit_time ? r.visit_time.slice(0, 5) : "—"}</td>
      <td>${r.status || "active"}</td>
    </tr>`).join("");

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>NEU Library — Visitor Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 32px; color: #1a2e2e; }
    .header { display: flex; align-items: center; gap: 16px; margin-bottom: 6px; }
    .header-text h1 { font-size: 20px; color: #0a6e6e; font-family: Georgia, serif; }
    .header-text p  { font-size: 11px; color: #666; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #666;
            border-top: 2px solid #0a6e6e; border-bottom: 1px solid #dde8e8;
            padding: 8px 0; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #0a6e6e; }
    th { padding: 9px 10px; text-align: left; font-size: 10px; font-weight: 700;
         color: #fff; text-transform: uppercase; letter-spacing: .5px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eee; vertical-align: middle; }
    tr:nth-child(even) td { background: #f5fafa; }
    .status-active  { background: #e8f5e9; color: #1a7a34; padding: 2px 8px; border-radius: 50px; font-weight: 700; font-size: 10px; }
    .status-blocked { background: #fff0f0; color: #e53e3e; padding: 2px 8px; border-radius: 50px; font-weight: 700; font-size: 10px; }
    .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #999; }
    @media print {
      body { padding: 16px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-text">
      <h1>NEU Library — Visitor Report</h1>
      <p>New Era University · Library Services · No. 9 Central Ave, New Era, Quezon City</p>
    </div>
  </div>
  <div class="meta">
    <span>Generated: ${new Date().toLocaleString("en-PH", { dateStyle: "full", timeStyle: "short" })}</span>
    <span>Total Records: <strong>${adminRows.length}</strong></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Program / Dept.</th><th>Email</th>
        <th>Type</th><th>Purpose</th><th>Date</th><th>Time</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">NEU Library Visitor Log System &mdash; Confidential</div>
  <script>
    window.onload = function() {
      window.print();
    };
  <\/script>
</body>
</html>`);
  win.document.close();
}

function printReport() {
  exportPDF();
}

function esc(str) {
  if (str == null) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function showMsg(el, type, text) {
  el.className = `form-msg ${type}`;
  el.textContent = text;
  el.classList.remove("hidden");
}
function hideMsg(el) { el.classList.add("hidden"); }

(async () => {
  
  if (window.location.hash.includes("access_token")) {
    await handleAuthCallback();
    return;
  }

  
  const storedEmail = localStorage.getItem("visitor_email");
  const storedName  = localStorage.getItem("visitor_name");
  const intent      = localStorage.getItem("login_intent");

  if (storedEmail && intent !== "admin") {
    
    visitor.email = storedEmail;
    visitor.name  = storedName || "";
    document.getElementById("kiosk-email-display").textContent = storedEmail;
    document.getElementById("kiosk-logged-in").classList.remove("hidden");
    document.getElementById("kiosk-default-state").classList.add("hidden");

    
    const kiosk = document.getElementById("screen-kiosk");
    kiosk.classList.add("active");
    loadKioskStats();
    requestAnimationFrame(() => requestAnimationFrame(() => kiosk.classList.add("visible")));
    return;
  }

  
  const welcome = document.getElementById("screen-welcome");
  welcome.classList.add("active");
  requestAnimationFrame(() => requestAnimationFrame(() => welcome.classList.add("visible")));
})();