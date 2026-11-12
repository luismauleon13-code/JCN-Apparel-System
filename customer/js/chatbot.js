/* ============================================
   JCN AI ASSISTANT - PRIVATE CUSTOMER CHATBOT
   Each signed-in customer has separate history.
============================================ */

const JCN_CHAT_API = "/api/chatbot";
const JCN_CHAT_STORAGE_PREFIX = "jcnChatHistory_customer_";
const JCN_CHAT_HISTORY_LIMIT = 20;
const JCN_CHAT_TIMEOUT_MS = 20000;

function jcnReadCustomerSession() {
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("customerUser") || "null");
  } catch (error) {
    console.warn("Invalid customer session data:", error);
  }

  const token = localStorage.getItem("customerToken");
  const id = user && (user.id || user.user_id);

  // Do NOT use a shared storage key or username/email as a fallback.
  if (!token || !id || (typeof id !== "string" && typeof id !== "number")) {
    return null;
  }

  return {
    id: String(id),
    token,
    storageKey: JCN_CHAT_STORAGE_PREFIX + String(id)
  };
}

function jcnReadHistory(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");

    if (!Array.isArray(raw)) return [];

    return raw.filter(item =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    ).slice(-JCN_CHAT_HISTORY_LIMIT);
  } catch (error) {
    console.warn("Unable to read customer chat history:", error);
    return [];
  }
}

function jcnSaveHistory(key, history) {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(-JCN_CHAT_HISTORY_LIMIT)));
  } catch (error) {
    console.warn("Unable to save customer chat history:", error);
  }
}

async function initializeJCNChatbot() {
  if (document.getElementById("jcnChatbotContainer")) return;

  // Hide chatbot outside an authenticated customer session.
  const session = jcnReadCustomerSession();
  if (!session) {
    console.info("JCN chatbot: customer login required.");
    return;
  }

  try {
    const fragmentURL = new URL("chatbot.html", document.baseURI);
    const response = await fetch(fragmentURL);
    if (!response.ok) {
      throw new Error(`Chatbot HTML not found: HTTP ${response.status}`);
    }

    // If the account changed while the HTML was loading, do not mount old chat.
    const currentSession = jcnReadCustomerSession();
    if (!currentSession || currentSession.id !== session.id || currentSession.token !== session.token) {
      return;
    }

    const container = document.createElement("div");
    container.id = "jcnChatbotContainer";
    container.innerHTML = await response.text();
    document.body.appendChild(container);

    const toggle = container.querySelector("#jcnChatToggle");
    const chatWindow = container.querySelector("#jcnChatWindow");
    const close = container.querySelector("#jcnChatClose");
    const messages = container.querySelector("#jcnChatMessages");
    const form = container.querySelector("#jcnChatForm");
    const input = container.querySelector("#jcnChatInput");
    const send = container.querySelector("#jcnChatSend");
    const status = container.querySelector("#jcnChatStatus");
    const shortcuts = container.querySelectorAll("[data-jcn-question]");

    if ([toggle, chatWindow, close, messages, form, input, send, status].some(element => !element)) {
      throw new Error("Missing required chatbot HTML elements.");
    }

    let busy = false;
    let history = jcnReadHistory(session.storageKey);
    let activeController = null;

    function belongsToCurrentCustomer() {
      const current = jcnReadCustomerSession();
      return Boolean(current && current.id === session.id && current.token === session.token);
    }

    function saveHistory() {
      if (!belongsToCurrentCustomer()) return;
      jcnSaveHistory(session.storageKey, history);
    }

    function setOpen(open) {
      if (!belongsToCurrentCustomer()) {
        activeController?.abort();
        container.remove();
        return;
      }

      chatWindow.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Minimize JCN AI Assistant" : "Open JCN AI Assistant");

      if (open) {
        input.focus();
        messages.scrollTop = messages.scrollHeight;
      } else {
        toggle.focus();
      }
    }

    toggle.addEventListener("click", () => setOpen(chatWindow.hidden));
    close.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && container.isConnected && !chatWindow.hidden) {
        setOpen(false);
      }
    });

    function addMessage(text, role) {
      if (!belongsToCurrentCustomer() || !container.isConnected) return;
      const item = document.createElement("div");
      item.className = `jcn-msg jcn-msg-${role}`;
      item.textContent = String(text);
      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
    }

    function displayHistory() {
      messages.replaceChildren();
      if (history.length) {
        history.forEach(item => addMessage(item.content, item.role === "assistant" ? "bot" : "user"));
      } else {
        addMessage(
          "Hello po! 👋 Welcome to JCN Apparel Printing Services. " +
          "I can help you with order tracking, clothing customization, " +
          "and payment methods. Ano po ang concern ninyo?",
          "bot"
        );
      }
    }

    displayHistory();

    function setBusy(value) {
      busy = value;
      send.disabled = value;
      input.disabled = value;
      shortcuts.forEach(button => { button.disabled = value; });
    }

    async function sendMessage(rawText) {
      const message = String(rawText || "").trim();
      if (!message || busy || !belongsToCurrentCustomer()) return;

      if (message.length > 600) {
        status.textContent = "Maximum 600 characters per message.";
        return;
      }

      input.value = "";
      status.textContent = "";
      addMessage(message, "user");

      const previousHistory = history.slice(-10);
      history.push({ role: "user", content: message });
      history = history.slice(-JCN_CHAT_HISTORY_LIMIT);
      saveHistory();
      setBusy(true);
      status.textContent = "JCN Assistant is typing...";

      const controller = new AbortController();
      activeController = controller;
      const timeoutId = setTimeout(() => controller.abort(), JCN_CHAT_TIMEOUT_MS);

      try {
        const apiResponse = await fetch(JCN_CHAT_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`
          },
          body: JSON.stringify({ message, history: previousHistory }),
          signal: controller.signal
        });

        const data = await apiResponse.json().catch(() => null);

        if (!belongsToCurrentCustomer() || !container.isConnected) return;

        if (!apiResponse.ok || !data || data.success === false) {
          throw new Error(data?.message || `Chatbot HTTP ${apiResponse.status}`);
        }

        const reply = data.reply || data.response || data.message;
        if (typeof reply !== "string" || !reply.trim()) {
          throw new Error("The chatbot returned an empty reply.");
        }

        addMessage(reply, "bot");
        history.push({ role: "assistant", content: reply });
        history = history.slice(-JCN_CHAT_HISTORY_LIMIT);
        saveHistory();

        status.textContent = data.mode === "faq" || data.category
          ? "Automated customer support"
          : "";
      } catch (error) {
        if (!belongsToCurrentCustomer() || !container.isConnected) return;
        console.error("JCN CHATBOT ERROR:", error);
        const errorMessage = error.name === "AbortError"
          ? "Sorry po! The chatbot took too long to respond. Please try again."
          : "Sorry po! Hindi makakonekta sa chatbot service. Please try again.";
        addMessage(errorMessage, "bot");
        status.textContent = "Connection problem";
      } finally {
        clearTimeout(timeoutId);
        if (activeController === controller) activeController = null;
        if (belongsToCurrentCustomer() && container.isConnected) {
          setBusy(false);
          if (!chatWindow.hidden) input.focus();
        }
      }
    }

    form.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(input.value);
    });

    shortcuts.forEach(button => {
      button.addEventListener("click", () => sendMessage(button.dataset.jcnQuestion));
    });

    // Session changes in another tab: remove old account's visible messages.
    window.addEventListener("storage", event => {
      if (event.key === "customerUser" || event.key === "customerToken") {
        if (!belongsToCurrentCustomer()) {
          activeController?.abort();
          container.remove();
        }
      }
    });

    setOpen(false);
    console.log("JCN AI Assistant initialized for the signed-in customer.");
  } catch (error) {
    console.error("JCN CHATBOT INITIALIZATION ERROR:", error);
    document.getElementById("jcnChatbotContainer")?.remove();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeJCNChatbot, { once: true });
} else {
  initializeJCNChatbot();
}
