const API_URL =
  "https://script.google.com/macros/s/AKfycbwpjJsU5i5Mo5NkMvKz2szyWBwJ_ftN4bnqmXtGqW7wpge819ZIfL2vZC2lFuEVfoDX/exec";
const SESSION_KEY = "reksa_session";
let sessionToken = localStorage.getItem(SESSION_KEY),
  me = null,
  conversations = [],
  activeConversationId = null,
  pollTimer = null;
const $ = (id) => document.getElementById(id);
function api(params) {
  const u = new URL(API_URL);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  return fetch(u).then(async (r) => {
    const t = await r.text();
    try {
      return JSON.parse(t);
    } catch {
      throw new Error("Resposta inválida do servidor.");
    }
  });
}
function msg(x) {
  $("authMessage").textContent = x || "";
}
function normalizeUsername(v) {
  v = v.trim().toLowerCase();
  return v.startsWith("@") ? v : "@" + v;
}
function switchAuth(mode) {
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.toggle("active", b.dataset.auth === mode));
  $("loginForm").classList.toggle("hidden", mode !== "login");
  $("registerForm").classList.toggle("hidden", mode !== "register");
  msg("");
}
async function login(e) {
  e.preventDefault();
  msg("Entrando...");
  try {
    const r = await api({
      action: "login",
      username: normalizeUsername($("loginUsername").value),
      password: $("loginPassword").value,
      remember: $("rememberMe").checked ? "1" : "0",
    });
    if (!r.ok) throw Error(r.error);
    sessionToken = r.token;
    localStorage.setItem(SESSION_KEY, sessionToken);
    await startApp();
  } catch (e) {
    msg(e.message);
  }
}
async function register(e) {
  e.preventDefault();
  msg("");
  if ($("registerPassword").value !== $("registerPassword2").value) {
    msg("As senhas não coincidem.");
    return;
  }
  try {
    const r = await api({
      action: "register",
      name: $("registerName").value.trim(),
      username: normalizeUsername($("registerUsername").value),
      password: $("registerPassword").value,
    });
    if (!r.ok) throw Error(r.error);
    $("loginUsername").value = normalizeUsername($("registerUsername").value);
    $("loginPassword").value = $("registerPassword").value;
    switchAuth("login");
    msg("Conta criada. Agora entre.");
  } catch (e) {
    msg(e.message);
  }
}
async function startApp() {
  try {
    const r = await api({
      action: "me",
      token: sessionToken,
    });

    if (!r.ok) throw Error(r.error);

    me = r.user;

    $("meLabel").textContent = `${me.name} (${me.username})`;

    $("authView").classList.add("hidden");
    $("appView").classList.remove("hidden");

    await loadConversations();
    await loadRequests();

    startPolling();
    registerPush();
  } catch {
    logout(false);
  }
}
async function logout(server = true) {
  if (server && sessionToken) {
    try {
      await api({ action: "logout", token: sessionToken });
    } catch {}
  }
  sessionToken = null;
  me = null;
  activeConversationId = null;
  localStorage.removeItem(SESSION_KEY);
  clearInterval(pollTimer);
  $("appView").classList.add("hidden");
  $("authView").classList.remove("hidden");
}
async function loadConversations() {
  const r = await api({ action: "conversations", token: sessionToken });
  if (!r.ok) throw Error(r.error);
  conversations = r.conversations;
  renderConversations();
}
function renderConversations() {
  const l = $("conversationList");
  l.innerHTML = "";
  if (!conversations.length) {
    l.innerHTML = '<p class="muted">Nenhuma conversa ainda.</p>';
    return;
  }
  conversations.forEach((c) => {
    const b = document.createElement("button");
    b.className =
      "conversation-item" + (c.id === activeConversationId ? " active" : "");
    b.innerHTML = `<strong>${esc(c.title)}</strong><span>${esc(c.type === "group" ? "Grupo" : c.username || "Conversa")}</span>`;
    b.onclick = () => openConversation(c.id);
    l.appendChild(b);
  });
}
async function openConversation(id) {
  activeConversationId = id;
  renderConversations();
  const c = conversations.find((x) => x.id === id);
  if (!c) return;
  $("emptyChat").classList.add("hidden");
  $("chatView").classList.remove("hidden");
  $("chatTitle").textContent = c.title;
  $("chatSubtitle").textContent =
    c.type === "group" ? "Grupo" : c.username || "";
  await loadMessages();
}
async function loadMessages() {
  if (!activeConversationId) return;
  const r = await api({
    action: "messages",
    token: sessionToken,
    conversationId: activeConversationId,
  });
  if (!r.ok) return;
  const box = $("messages"),
    bottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = "";
  r.messages.forEach((m) => {
    const b = document.createElement("div");
    b.className = "message-bubble" + (m.userId === me.id ? " mine" : "");
    b.innerHTML = `<div class="message-author">${esc(m.username)}</div><div>${esc(m.text)}</div><span class="message-time">${new Date(m.createdAt).toLocaleString("pt-BR")}</span>`;
    box.appendChild(b);
  });
  if (bottom) box.scrollTop = box.scrollHeight;
}
async function sendMessage(e) {
  e.preventDefault();
  const text = $("messageInput").value.trim();
  if (!text || !activeConversationId) return;
  $("messageInput").value = "";
  const r = await api({
    action: "sendMessage",
    token: sessionToken,
    conversationId: activeConversationId,
    text,
  });
  if (!r.ok) alert(r.error);
  else await loadMessages();
}
function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!sessionToken) return;

    try {
      await loadConversations();
      await loadRequests();
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
  }, 5000);
}
function openUserDialog() {
  $("userSearchInput").value = "";
  $("userSearchResult").innerHTML = "";
  $("userDialog").showModal();
}
async function searchUser(e) {
  e.preventDefault();
  const username = normalizeUsername($("userSearchInput").value),
    box = $("userSearchResult");
  box.innerHTML = "Procurando...";
  try {
    const r = await api({ action: "findUser", token: sessionToken, username });
    if (!r.ok) throw Error(r.error);
    box.innerHTML = `<div class="result"><strong>${esc(r.user.name)}</strong><span class="muted">${esc(r.user.username)}</span><button class="primary" id="requestBtn">Enviar solicitação</button></div>`;
    $("requestBtn").onclick = async () => {
      const x = await api({
        action: "createRequest",
        token: sessionToken,
        targetUserId: r.user.id,
      });
      box.innerHTML = x.ok
        ? "<p>Solicitação enviada.</p>"
        : `<p class="message">${esc(x.error)}</p>`;
    };
  } catch (e) {
    box.innerHTML = `<p class="message">${esc(e.message)}</p>`;
  }
}
async function createGroup(e) {
  e.preventDefault();
  const name = $("groupName").value.trim(),
    usernames = $("groupMembers")
      .value.split(/\n|,/)
      .map(normalizeUsername)
      .filter(Boolean);
  try {
    const r = await api({
      action: "createGroup",
      token: sessionToken,
      name,
      usernames: JSON.stringify(usernames),
    });
    if (!r.ok) throw Error(r.error);
    $("groupDialog").close();
    $("groupForm").reset();
    await loadConversations();
    await openConversation(r.conversationId);
  } catch (e) {
    $("groupMessage").textContent = e.message;
  }
}
async function registerPush() {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  )
    return;
  try {
    if ((await Notification.requestPermission()) !== "granted") return;
    const r = await api({ action: "pushPublicKey", token: sessionToken });
    if (!r.ok || !r.publicKey) return;
    const reg = await navigator.serviceWorker.register("sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64(r.publicKey),
    });
    await api({
      action: "savePushSubscription",
      token: sessionToken,
      subscription: JSON.stringify(sub),
    });
  } catch (e) {
    console.warn("Push não configurado", e);
  }
}
function b64(s) {
  const p = "=".repeat((4 - (s.length % 4)) % 4),
    b = (s + p).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
}
function esc(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
document
  .querySelectorAll(".tab")
  .forEach((b) => (b.onclick = () => switchAuth(b.dataset.auth)));
$("loginForm").onsubmit = login;
$("registerForm").onsubmit = register;
$("logoutBtn").onclick = () => logout(true);
$("messageForm").onsubmit = sendMessage;
$("newChatBtn").onclick = openUserDialog;
$("newGroupBtn").onclick = () => $("groupDialog").showModal();
$("userSearchForm").onsubmit = searchUser;
$("groupForm").onsubmit = createGroup;
$("closeUserDialog").onclick = () => $("userDialog").close();
$("closeGroupDialog").onclick = () => $("groupDialog").close();
if (sessionToken) startApp();
async function loadRequests() {
  const list = document.getElementById("requestsList");
  const count = document.getElementById("requestsCount");

  if (!list || !count || !sessionToken) return;

  try {
    const data = await api({
      action: "requests",
      token: sessionToken,
    });

    if (!data.ok) {
      throw new Error(data.error || "Erro ao carregar solicitações.");
    }

    const requests = data.requests || [];

    const incoming = requests.filter((r) => r.direction === "incoming");

    count.textContent = incoming.length;

    if (incoming.length === 0) {
      list.innerHTML = `
                <p class="empty-state">
                    Nenhuma solicitação.
                </p>
            `;
      return;
    }

    list.innerHTML = incoming
      .map(
        (request) => `
            <div class="request-item">
                <div class="request-info">
                    <p class="request-name">
                        ${esc(request.user.name)}
                    </p>

                    <p class="request-username">
                        ${esc(request.user.username)}
                    </p>
                </div>

                <div class="request-actions">
                    <button
                        class="accept-request"
                        onclick="acceptRequest('${request.id}')">
                        Aceitar
                    </button>

                    <button
                        class="reject-request"
                        onclick="rejectRequest('${request.id}')">
                        Recusar
                    </button>
                </div>
            </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Erro ao carregar solicitações:", error);
  }
}

async function acceptRequest(requestId) {
  try {
    const data = await api({
      action: "acceptRequest",
      token: sessionToken,
      requestId,
    });

    if (!data.ok) {
      throw new Error(data.error || "Não foi possível aceitar a solicitação.");
    }

    await loadRequests();
    await loadConversations();
  } catch (error) {
    alert(error.message);
  }
}

async function rejectRequest(requestId) {
  try {
    const data = await api({
      action: "rejectRequest",
      token: sessionToken,
      requestId,
    });

    if (!data.ok) {
      throw new Error(data.error || "Não foi possível recusar a solicitação.");
    }

    await loadRequests();
  } catch (error) {
    alert(error.message);
  }
}

setInterval(() => {
  loadConversations();
  loadRequests();
}, 5000);

let creatingGroup = false;

async function createGroup(e) {
  e.preventDefault();

  if (creatingGroup) return;

  creatingGroup = true;

  const button = e.submitter;
  if (button) button.disabled = true;

  try {
    const name = $("groupName").value.trim();

    const usernames = $("groupMembers")
      .value.split(/\n|,/)
      .map(normalizeUsername)
      .filter(Boolean);

    const r = await api({
      action: "createGroup",
      token: sessionToken,
      name,
      usernames: JSON.stringify(usernames),
    });

    if (!r.ok) {
      throw Error(r.error);
    }

    $("groupDialog").close();
    $("groupForm").reset();

    await loadConversations();
    await openConversation(r.conversationId);
  } catch (e) {
    $("groupMessage").textContent = e.message;
  } finally {
    creatingGroup = false;

    if (button) {
      button.disabled = false;
    }
  }
}
