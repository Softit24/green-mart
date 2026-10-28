
const registrationSection = document.getElementById("registration-form");
const message = document.getElementById("message");

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarBackdrop").classList.toggle("visible");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarBackdrop").classList.remove("visible");
}
function navigateMenu(name) {
  closeSidebar();

  const teamView = document.getElementById("binary-team-view");
  if (teamView) teamView.style.display = "none";
  const treeView = document.getElementById("tree-view");
  if (treeView) treeView.style.display = "none";
  if (name === "Tree") {
    hideRegistration();
    showTree();
    return;
  }

  if (name === "Registration") {
    showRegistration();
  } else if (name === "Binary Team") {
    hideRegistration();
    showBinaryTeam();
  } else if (name === "Dashboard") {
    hideRegistration();
    document.getElementById("dashboard-message").textContent = "Dashboard ready.";
  } else {
    hideRegistration();
    showModule(name);
  }
}

async function showBinaryTeam() {
  const view = document.getElementById("binary-team-view");
  const count = document.getElementById("binary-team-count");
  const list = document.getElementById("binary-team-list");

  view.style.display = "block";
  count.textContent = "Loading members...";
  list.replaceChildren();

  try {
    const response = await fetch("/api/binary-team", {headers: {"Authorization": "Bearer " + (sessionStorage.getItem("greenmartAdminToken") || "")}});
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Could not load members.");

    count.textContent = "Total registered members: " + data.members.length;

    if (data.members.length === 0) {
      list.textContent = "No members registered yet.";
      return;
    }

    data.members.forEach(member => {
      const card = document.createElement("div");
      card.style.cssText = "padding:12px;margin:10px 0;border:1px solid #dbeafe;border-radius:10px;background:#eff6ff;";

      const name = document.createElement("strong");
      name.textContent = member.name || "Unnamed member";
      card.appendChild(name);

      const details = document.createElement("p");
      details.textContent =
        "Member ID: " + (member.member_id || "-") +
        " | Sponsor: " + (member.sponsor_id || "None") +
        " | Placement: " + (member.placement || "Not set");
      card.appendChild(details);

      list.appendChild(card);
    });
  } catch (error) {
    count.textContent = "Unable to load Binary Team.";
    list.textContent = error.message;
  }
}

async function showTree() {
  const view = document.getElementById("tree-view");
  const status = document.getElementById("tree-status");
  const results = document.getElementById("tree-results");
  const search = document.getElementById("tree-search");
  if (!view || !status || !results || !search) {
    alert("Tree page elements are missing.");
    return;
  }

  view.style.display = "block";
  status.textContent = "Loading members...";
  results.replaceChildren();

  try {
    const response = await fetch("/api/binary-team", {
      headers: {
        "Authorization": "Bearer " +
          (sessionStorage.getItem("greenmartAdminToken") || "")
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load members.");

    const members = Array.isArray(data.members) ? data.members : [];
    const byId = new Map(members.map(m => [m.member_id, m]));

    function getInfo(member) {
      let current = member;
      const parts = [];
      const seen = new Set();
      let level = 0;
      let issue = "";

      while (current) {
        if (seen.has(current.member_id)) {
          issue = "Sponsor cycle detected";
          break;
        }
        seen.add(current.member_id);
        parts.unshift((current.name || "Unnamed") + " (" + current.member_id + ")");

        if (!current.sponsor_id) break;
        const parent = byId.get(current.sponsor_id);
        if (!parent) {
          parts.unshift("[Missing sponsor: " + current.sponsor_id + "]");
          issue = "Sponsor record not found";
          break;
        }

        parts.splice(parts.length - 1, 0,
          current.placement === "left" ? "Left" :
          current.placement === "right" ? "Right" : "[Placement not set]");
        current = parent;
        level++;
      }

      return {
        level,
        path: parts.join(" → "),
        position: member.placement || "Not set",
        sponsor: member.sponsor_id || "Root member",
        issue
      };
    }

    
function render() {
  const q = search.value.trim().toLowerCase();
  results.replaceChildren();

  const byId = new Map(members.map(m => [m.member_id, m]));
  const children = new Map();
  members.forEach(m => {
    const key = m.sponsor_id || "";
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(m);
  });

  // Always place Left before Right.
  for (const group of children.values()) {
    group.sort((a, b) =>
      (a.placement === "left" ? 0 : a.placement === "right" ? 1 : 2) -
      (b.placement === "left" ? 0 : b.placement === "right" ? 1 : 2)
    );
  }

  status.textContent = members.length + " member(s) in tree.";
  if (!members.length) {
    results.textContent = "No members registered yet.";
    return;
  }

  if (!document.getElementById("greenmart-tree-styles")) {
    const style = document.createElement("style");
    style.id = "greenmart-tree-styles";
    style.textContent = `
      #tree-results { overflow-x:auto; padding:18px 8px 28px; }
      .gm-tree-forest { display:flex; flex-direction:column; align-items:center; gap:28px; width:100%; min-width:0; box-sizing:border-box; overflow-x:auto; padding:8px 12px 20px; }
      .gm-tree-node { display:flex; flex-direction:column; align-items:center; position:relative; }
      .gm-tree-card { width:245px; max-width:100%; min-width:0; box-sizing:border-box; display:flex; align-items:center; gap:10px; padding:10px; border:2px solid #15803d; border-radius:15px; background:linear-gradient(135deg,#f0fdf4,#fff); box-shadow:0 5px 15px #00000012; overflow-wrap:anywhere; }
      .gm-tree-card.gm-right { border-color:#2563eb; background:linear-gradient(135deg,#eff6ff,#fff); }
      .gm-tree-card.gm-match { outline:4px solid #f59e0b; box-shadow:0 0 0 7px #fef3c7; }
      .gm-tree-photo { width:76px; height:76px; flex:0 0 76px; object-fit:cover; border-radius:12px; background:#e5e7eb; }
      .gm-tree-id { font-weight:800; font-size:16px; overflow-wrap:anywhere; color:#166534; }
      .gm-right .gm-tree-id { color:#1d4ed8; }
      .gm-tree-name { font-weight:600; margin-top:4px; overflow-wrap:anywhere; }
      .gm-tree-detail { font-size:12px; color:#475569; margin-top:4px; overflow-wrap:anywhere; }
      .gm-tree-position { display:inline-block; font-size:11px; color:white; background:#15803d; padding:3px 9px; border-radius:20px; margin-bottom:5px; }
      .gm-right .gm-tree-position { background:#2563eb; }
      .gm-tree-down { height:30px; display:flex; flex-direction:column; align-items:center; color:#64748b; font-size:20px; line-height:14px; }
      .gm-tree-down::before { content:""; display:block; height:13px; border-left:2px solid #94a3b8; }
      .gm-tree-down span { line-height:15px; }
      .gm-tree-children { display:grid; grid-template-columns:repeat(2,245px); justify-content:center; align-items:start; column-gap:28px; row-gap:22px; position:relative; padding-top:4px; width:max-content; max-width:100%; }
      .gm-tree-child { display:flex; flex-direction:column; align-items:center; position:relative; padding:0 4px; }
      .gm-tree-child::before { content:""; position:absolute; top:-4px; height:13px; border-left:2px solid #94a3b8; }
      .gm-tree-child-arrow { margin-top:7px; color:#64748b; font-size:18px; line-height:16px; }
      .gm-tree-empty { color:#94a3b8; border:1px dashed #cbd5e1; border-radius:10px; padding:8px 12px; font-size:12px; }
      .gm-tree-warning { font-size:12px; color:#b45309; margin-top:6px; max-width:245px; overflow-wrap:anywhere; }
      @media(max-width:600px) { .gm-tree-card { width:220px; } .gm-tree-photo { width:64px;height:64px;flex-basis:64px; } .gm-tree-children { gap:8px; } }
    `;
    document.head.appendChild(style);
  }

  const forest = document.createElement("div");
  forest.className = "gm-tree-forest";
  const rendered = new Set();

  function makeNode(member, level, inheritedSeen) {
    if (!member || rendered.has(member.member_id)) return null;
    rendered.add(member.member_id);

    const node = document.createElement("div");
    node.className = "gm-tree-node";

    const card = document.createElement("div");
    const isRight = member.placement === "right";
    card.className = "gm-tree-card" + (isRight ? " gm-right" : "");

    const matching =
      String(member.member_id || "").toLowerCase().includes(q) ||
      String(member.name || "").toLowerCase().includes(q);
    if (q && matching) card.classList.add("gm-match");

    const photo = document.createElement("img");
    photo.className = "gm-tree-photo";
    photo.alt = "Demo profile photo";
    photo.loading = "lazy";
    photo.src = "https://i.pravatar.cc/120?u=" +
      encodeURIComponent(member.member_id || member.name || "member");
    photo.onerror = function () {
      this.onerror = null;
      this.src = "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="100%" height="100%" fill="#e2e8f0"/><circle cx="60" cy="42" r="22" fill="#94a3b8"/><path d="M18 118c2-28 19-42 42-42s40 14 42 42" fill="#94a3b8"/></svg>');
    };
    card.appendChild(photo);

    const downloadPhoto = document.createElement("button");
    downloadPhoto.type = "button";
    downloadPhoto.textContent = "📥 Download Photo";
    downloadPhoto.style.cssText = "display:block;margin-top:8px;padding:7px 9px;border:0;border-radius:8px;background:#15803d;color:white;font-size:12px;cursor:pointer;";
    downloadPhoto.addEventListener("click", async function () {
      const photoUrl = photo.src;
      try {
        const response = await fetch(photoUrl);
        if (!response.ok) throw new Error("Download failed");
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = (member.member_id || "member") + "-photo.jpg";
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      } catch (error) {
        alert("Direct download was blocked. Opening the photo in a new tab so you can save it from the browser menu.");
        window.open(photoUrl, "_blank", "noopener");
      }
    });
    card.appendChild(downloadPhoto);

    const info = document.createElement("div");
    const position = document.createElement("span");
    position.className = "gm-tree-position";
    position.textContent = level === 0 ? "ROOT MEMBER" :
      (member.placement || "POSITION NOT SET").toUpperCase();
    info.appendChild(position);

    const id = document.createElement("div");
    id.className = "gm-tree-id";
    id.textContent = member.member_id || "No member ID";
    info.appendChild(id);

    const name = document.createElement("div");
    name.className = "gm-tree-name";
    name.textContent = member.name || "Unnamed member";
    info.appendChild(name);

    const detail = document.createElement("div");
    detail.className = "gm-tree-detail";
    detail.textContent = "Level: " + level + " · Sponsor: " +
      (member.sponsor_id || "None");
    info.appendChild(detail);
    card.appendChild(info);
    node.appendChild(card);

    if (q && matching) {
      card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }

    const next = (children.get(member.member_id) || [])
        .filter(child => !rendered.has(child.member_id))
        .sort((a, b) => {
          const order = { left: 0, right: 1 };
          return (order[String(a.placement || "").toLowerCase()] ?? 2)
               - (order[String(b.placement || "").toLowerCase()] ?? 2);
        });

    if (next.length) {
      const down = document.createElement("div");
      down.className = "gm-tree-down";
      const arrow = document.createElement("span");
      arrow.textContent = "▼";
      down.appendChild(arrow);
      node.appendChild(down);

      const row = document.createElement("div");
      row.className = "gm-tree-children";

      next.forEach(child => {
        const wrapper = document.createElement("div");
        wrapper.className = "gm-tree-child";
          wrapper.style.gridColumn =
            String(child.placement || "").toLowerCase() === "right" ? "2" : "1";
        const arrowDown = document.createElement("div");
        arrowDown.className = "gm-tree-child-arrow";
        arrowDown.textContent = "↓";
        wrapper.appendChild(arrowDown);

        const childNode = makeNode(child, level + 1, inheritedSeen);
        if (childNode) wrapper.appendChild(childNode);
        row.appendChild(wrapper);
      });
      node.appendChild(row);
    }
    return node;
  }

  // Virtual Company root: display only; does not alter database records.
  const company = document.createElement("div");
  company.className = "gm-tree-node";

  const companyCard = document.createElement("div");
  companyCard.className = "gm-tree-card";
  companyCard.style.cssText =
    "justify-content:center;width:245px;background:linear-gradient(135deg,#dbeafe,#fff);border-color:#2563eb;";

  const companyName = document.createElement("div");
  companyName.className = "gm-tree-name";
  companyName.textContent = "🏢 COMPANY";
  companyCard.appendChild(companyName);
  company.appendChild(companyCard);

  const roots = members
    .filter(m => !m.sponsor_id || !byId.has(m.sponsor_id))
    .sort((a, b) => {
      const order = { left: 0, right: 1 };
      return (order[String(a.placement || "").toLowerCase()] ?? 2)
           - (order[String(b.placement || "").toLowerCase()] ?? 2);
    });

  if (roots.length) {
    const down = document.createElement("div");
    down.className = "gm-tree-down";
    const arrow = document.createElement("span");
    arrow.textContent = "▼";
    down.appendChild(arrow);
    company.appendChild(down);

    const row = document.createElement("div");
    row.className = "gm-tree-children";
    roots.forEach(root => {
      const wrapper = document.createElement("div");
      wrapper.className = "gm-tree-child";
      wrapper.style.gridColumn =
        String(root.placement || "").toLowerCase() === "right" ? "2" : "1";

      const arrowDown = document.createElement("div");
      arrowDown.className = "gm-tree-child-arrow";
      arrowDown.textContent = "↓";
      wrapper.appendChild(arrowDown);

      const tree = makeNode(root, 0, new Set());
      if (tree) wrapper.appendChild(tree);
      row.appendChild(wrapper);
    });
    company.appendChild(row);
  }

  forest.appendChild(company);

  // If a bad/cyclic sponsor relationship remains, show it separately rather
  // than looping forever or silently dropping the member.
  members.forEach(member => {
    if (!rendered.has(member.member_id)) {
      const tree = makeNode(member, 0, new Set());
      if (tree) {
        const warning = document.createElement("p");
        warning.className = "gm-tree-warning";
        warning.textContent = "Check sponsor links for this branch.";
        tree.appendChild(warning);
        forest.appendChild(tree);
      }
    }
  });

  results.appendChild(forest);
  if (q) {
    const matches = members.filter(m =>
      String(m.member_id || "").toLowerCase().includes(q) ||
      String(m.name || "").toLowerCase().includes(q)
    ).length;
    status.textContent = matches + " matching member(s) highlighted in the tree.";
    if (!matches) status.textContent = "No matching members found; full tree is shown.";
  }
}

search.oninput = render;
    render();
  } catch (error) {
    status.textContent = "Unable to load Tree.";
    results.textContent = error.message;
  }
}

function showRegistration() {
  registrationSection.style.display = "block";
  document.getElementById("dashboard-message").textContent = "Enter the new member's details below.";
  registrationSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
function hideRegistration() {
  registrationSection.style.display = "none";
  document.getElementById("dashboard-message").textContent = "Dashboard ready.";
}
function showModule(name) {
  hideRegistration();
  const teamView = document.getElementById("binary-team-view");
  if (teamView) teamView.style.display = "none";
  const msg = document.getElementById("dashboard-message");
  if (name === "Wallet") {
    msg.textContent = "💳 Wallet";
    let wallet = document.getElementById("wallet-view");
    if (!wallet) {
      wallet = document.createElement("section");
      wallet.id = "wallet-view";
      wallet.style.cssText = "background:white;color:#1f2937;padding:18px;margin:16px 0;border-radius:14px;";
      wallet.innerHTML = `<h2>💳 Balance Transfer</h2><p>Home › Transfer › Balance Transfer</p><hr><h3>Balance Transfer To Transaction Wallet</h3><p>Transaction Wallet:</p><h2>৳0.00</h2><p>Current Wallet:</p><h2>৳0.00</h2><form id="balance-transfer-form" style="display:grid;gap:12px;max-width:420px"><label>Tx Type:<select id="transfer-type" style="display:block;width:100%;padding:12px"><option value="self">Self Transfer</option><option value="other">Other Transfer</option></select></label><label>Transfer Amount:<input id="transfer-amount" type="number" min="1" step="0.01" required style="display:block;width:100%;padding:12px;box-sizing:border-box" placeholder="Enter amount"></label><label>Transaction PIN:<input id="transfer-pin" type="password" inputmode="numeric" required style="display:block;width:100%;padding:12px;box-sizing:border-box" placeholder="Enter transaction PIN"></label><button type="button" onclick="document.getElementById(&apos;transfer-message&apos;).textContent=&apos;Transfers are not connected yet.&apos;" style="padding:12px;background:#15803d;color:white;border:0;border-radius:8px">Transfer Balance</button><p id="transfer-message" role="status"></p></form><hr><h3>Balance Transfer History</h3><p>Home › History › Balance Transfer History</p><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;white-space:nowrap"><thead><tr style="background:#166534;color:white"><th>Flag</th><th>#</th><th>Date</th><th>Sender</th><th>Receiver</th><th>Tx Amount</th><th>Deduct</th><th>Received</th><th>Remark</th></tr></thead><tbody id="wallet-history-rows"><tr><td colspan="9" style="padding:12px;text-align:center">No transfer records yet.</td></tr></tbody></table></div>`;
      msg.insertAdjacentElement("afterend", wallet);
    }
    wallet.style.display = "block";
  } else if (name === "Recharge Codes") {
    const wallet = document.getElementById("wallet-view");
    if (wallet) wallet.style.display = "none";
    msg.textContent = "🎟️ Recharge Codes";
    let codes = document.getElementById("recharge-codes-view");
    if (!codes) {
      codes = document.createElement("section");
      codes.id = "recharge-codes-view";
      codes.style.cssText = "background:white;color:#1f2937;padding:18px;margin:16px 0;border-radius:14px;";
      codes.innerHTML = `
      <h2>🎟️ Recharge Codes</h2>
      <p>Create recharge codes in Bangladeshi taka.</p>
      <form id="recharge-code-form" style="display:grid;gap:12px;max-width:400px">
        <label>Amount (৳)<input id="recharge-amount" type="number" min="0.01" max="100000000" step="0.01" required style="display:block;padding:10px;width:100%;box-sizing:border-box"></label>
        <label>Number of codes (1–100)<input id="recharge-quantity" type="number" min="1" max="100" step="1" value="1" required style="display:block;padding:10px;width:100%;box-sizing:border-box"></label>
        <button type="submit" style="padding:12px;background:#166534;color:white;border:0;border-radius:8px">Generate Codes</button>
      </form>
      <p id="recharge-code-message"></p>
      <div style="overflow-x:auto"><table style="width:100%;text-align:left"><thead><tr><th>Code</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody id="recharge-code-rows"></tbody></table></div>`;
    codes.querySelector("#recharge-code-form").addEventListener("submit", async event => {
      event.preventDefault();
      const message = codes.querySelector("#recharge-code-message");
      const button = event.currentTarget.querySelector("button");
      button.disabled = true;
      message.textContent = "Generating...";
      try {
        const response = await fetch("/api/recharge-codes", {method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer " + (sessionStorage.getItem("greenmartAdminToken") || "")},body:JSON.stringify({amount:Number(codes.querySelector("#recharge-amount").value),quantity:Number(codes.querySelector("#recharge-quantity").value)})});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not generate codes");
        message.textContent = "Generated " + data.codes.length + " code(s). Copy and store them securely.";
        await loadRechargeCodes(codes);
      } catch (error) { message.textContent = error.message; }
      finally { button.disabled = false; }
    });
    loadRechargeCodes(codes);
      msg.insertAdjacentElement("afterend", codes);
    }
    codes.style.display = "block";
  } else {
    const wallet = document.getElementById("wallet-view");
    if (wallet) wallet.style.display = "none";
    const codes = document.getElementById("recharge-codes-view");
    if (codes) codes.style.display = "none";
    msg.textContent = name + " module selected. This feature has not been implemented yet.";
  }
}

async function loadRechargeCodes(container) {
  const rows = container.querySelector("#recharge-code-rows");
  try {
    const response = await fetch("/api/recharge-codes", {headers: {"Authorization": "Bearer " + (sessionStorage.getItem("greenmartAdminToken") || "")}});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load codes");
    rows.replaceChildren();
    if (!data.codes.length) { const tr=document.createElement("tr"); tr.innerHTML="<td colspan=\"4\">No recharge codes yet.</td>"; rows.appendChild(tr); return; }
    for (const item of data.codes) {
      const tr=document.createElement("tr");
      for (const value of [item.code,"৳"+Number(item.amount).toFixed(2),item.status,item.created_at || ""]) {
        const td=document.createElement("td"); td.style.padding="8px"; td.textContent=value; tr.appendChild(td);
      }
      rows.appendChild(tr);
    }
  } catch(error) { rows.textContent=error.message; }
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status");
    if (!response.ok) return;
    const data = await response.json();
    document.getElementById("members").textContent = data.members ?? 0;
    document.getElementById("transactions").textContent = data.transactions ?? 0;
  } catch (error) {
    document.getElementById("dashboard-message").textContent =
      "Could not load server status. Check that the server is running.";
  }
}

document.getElementById("registerForm").addEventListener("submit", async function(event) {
  event.preventDefault();
  message.textContent = "Registering member...";
  const formData = new FormData(event.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error || "Registration failed.";
      return;
    }
    message.textContent = "Success! Member ID: " + result.member.member_id;
    event.target.reset();
    await refreshStatus();
  } catch (error) {
    message.textContent = "Could not contact the server. Please check that it is running.";
  }
});

refreshStatus();

let greenMartToken = null;

document.getElementById("greenmart-login-form").addEventListener("submit", async function(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("greenmart-login-message");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  message.textContent = "Signing in...";
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        member_id: form.elements.member_id.value.trim(),
        password: form.elements.password.value
      })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error || "Login failed.";
      return;
    }
    greenMartToken = result.token;
  document.getElementById("greenmart-login").style.display = "none";
    document.getElementById("dashboard-message").textContent =
      "Welcome, " + result.member.name + " (" + result.member.member_id + ").";
    form.reset();
  } catch (error) {
    message.textContent = "Could not connect. Check that the server is running.";
  } finally {
    button.disabled = false;
  }
});


document.getElementById("greenmart-admin-form").addEventListener("submit", async function(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("greenmart-admin-message");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  message.textContent = "Signing in...";
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: form.elements.admin_password.value })
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error || "Admin login failed.";
      return;
    }
    sessionStorage.setItem("greenmartAdminToken", result.token);
    loadAdminPermissions();
      document.getElementById("admin-dashboard").style.display = "block";
      document.getElementById("admin-dashboard-status").textContent = "Admin access is active for one hour.";
      document.getElementById("greenmart-login").style.display = "none";
    form.reset();
    message.textContent = "Admin login successful. Admin session is active for one hour.";
  } catch (error) {
    message.textContent = "Could not connect. Check that the server is running.";
  } finally {
    button.disabled = false;
  }
});


async function loadAdminPermissions() {
  const message = document.getElementById("admin-permissions-message");
  const token = sessionStorage.getItem("greenmartAdminToken") || "";
  try {
    const response = await fetch("/api/admin/permissions", {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load permissions.");
    for (const [name, enabled] of Object.entries(data.permissions)) {
      const checkbox = document.querySelector('[data-permission="' + name + '"]');
      if (checkbox) checkbox.checked = enabled;
    }
    message.textContent = "Saved permissions loaded.";
  } catch (error) {
    message.textContent = error.message;
  }
}

document.getElementById("save-admin-permissions").addEventListener("click", async () => {
  const message = document.getElementById("admin-permissions-message");
  const button = document.getElementById("save-admin-permissions");
  const token = sessionStorage.getItem("greenmartAdminToken") || "";
  const permissions = {};
  document.querySelectorAll("[data-permission]").forEach(box => {
    permissions[box.dataset.permission] = box.checked;
  });
  button.disabled = true;
  message.textContent = "Saving permissions...";
  try {
    const response = await fetch("/api/admin/permissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ permissions })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not save permissions.");
    message.textContent = "Permissions saved successfully.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

