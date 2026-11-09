
/* ============================================
   JCN AI ASSISTANT - CUSTOMER CHATBOT
============================================ */

const JCN_CHAT_API = "http://localhost:5000/api/chatbot";
const JCN_CHAT_STORAGE = "jcnChatHistory";

async function initializeJCNChatbot() {
  if (document.getElementById("jcnChatbotContainer")) {
    return;
  }

  try {
    // LOAD CHATBOT HTML
    const fragmentURL = new URL(
      "chatbot.html",
      document.baseURI
    );

    const response = await fetch(fragmentURL);

    if (!response.ok) {
      throw new Error(
        `Chatbot HTML not found: HTTP ${response.status}`
      );
    }

    const container = document.createElement("div");
    container.id = "jcnChatbotContainer";
    container.innerHTML = await response.text();

    document.body.appendChild(container);

    // CHATBOT ELEMENTS
    const toggle = container.querySelector("#jcnChatToggle");
    const chatWindow = container.querySelector("#jcnChatWindow");
    const close = container.querySelector("#jcnChatClose");
    const messages = container.querySelector("#jcnChatMessages");
    const form = container.querySelector("#jcnChatForm");
    const input = container.querySelector("#jcnChatInput");
    const send = container.querySelector("#jcnChatSend");
    const status = container.querySelector("#jcnChatStatus");

    const shortcuts = container.querySelectorAll(
      "[data-jcn-question]"
    );

    if (
      [
        toggle,
        chatWindow,
        close,
        messages,
        form,
        input,
        send,
        status
      ].some(element => !element)
    ) {
      throw new Error("Missing required chatbot HTML elements.");
    }

    let busy = false;
    let history = [];

    // ========================================
    // LOAD CHAT HISTORY
    // ========================================

    try {
      const saved = JSON.parse(
        localStorage.getItem(JCN_CHAT_STORAGE) || "[]"
      );

      if (Array.isArray(saved)) {
        history = saved.filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        ).slice(-20);
      }
    } catch (error) {
      console.warn("Unable to load chat history:", error);
      history = [];
    }

    function saveHistory() {
      try {
        localStorage.setItem(
          JCN_CHAT_STORAGE,
          JSON.stringify(history.slice(-20))
        );
      } catch (error) {
        console.warn("Unable to save chat history:", error);
      }
    }

    // ========================================
    // OPEN / MINIMIZE CHATBOT
    // ========================================

    function setOpen(open) {
      chatWindow.hidden = !open;

      toggle.setAttribute(
        "aria-expanded",
        String(open)
      );

      toggle.setAttribute(
        "aria-label",
        open
          ? "Minimize JCN AI Assistant"
          : "Open JCN AI Assistant"
      );

      if (open) {
        input.focus();
        messages.scrollTop = messages.scrollHeight;
      } else {
        toggle.focus();
      }
    }

    toggle.addEventListener("click", () => {
      setOpen(chatWindow.hidden);
    });

    close.addEventListener("click", () => {
      setOpen(false);
    });

    document.addEventListener("keydown", event => {
      if (
        event.key === "Escape" &&
        !chatWindow.hidden
      ) {
        setOpen(false);
      }
    });

    // ========================================
    // DISPLAY CHAT MESSAGES
    // ========================================

    function addMessage(text, role) {
      const item = document.createElement("div");

      item.className = `jcn-msg jcn-msg-${role}`;
      item.textContent = String(text);

      messages.appendChild(item);
      messages.scrollTop = messages.scrollHeight;
    }

    // RESTORE PREVIOUS MESSAGES
    if (history.length) {
      history.forEach(item => {
        addMessage(
          item.content,
          item.role === "assistant" ? "bot" : "user"
        );
      });
    } else {
      addMessage(
        "Hello po! 👋 Welcome to JCN Apparel Printing Services. " +
        "I can help you with order tracking, clothing customization, " +
        "and payment methods. Ano po ang concern ninyo?",
        "bot"
      );
    }

    // ========================================
    // BUSY STATE
    // ========================================

    function setBusy(value) {
      busy = value;

      send.disabled = value;
      input.disabled = value;

      shortcuts.forEach(button => {
        button.disabled = value;
      });
    }

    // ========================================
    // SEND MESSAGE TO BACKEND
    // ========================================

    async function sendMessage(rawText) {
      const message = String(rawText || "").trim();

      if (!message || busy) return;

      if (message.length > 600) {
        status.textContent =
          "Maximum 600 characters per message.";
        return;
      }

      input.value = "";
      status.textContent = "";

      addMessage(message, "user");

      const previousHistory = history.slice(-10);

      history.push({
        role: "user",
        content: message
      });

      if (history.length > 20) {
        history = history.slice(-20);
      }

      saveHistory();
      setBusy(true);

      status.textContent = "JCN Assistant is typing...";

      let timeoutId;

      try {
        const controller = new AbortController();

        timeoutId = setTimeout(() => {
          controller.abort();
        }, 20000);

        const apiResponse = await fetch(JCN_CHAT_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message,
            history: previousHistory
          }),
          signal: controller.signal
        });

        const data = await apiResponse.json().catch(() => null);

        if (!apiResponse.ok || !data || data.success === false) {
          throw new Error(
            data?.message ||
            `Chatbot HTTP ${apiResponse.status}`
          );
        }

        const reply =
          data.reply ||
          data.response ||
          data.message;

        if (
          typeof reply !== "string" ||
          !reply.trim()
        ) {
          throw new Error("The chatbot returned an empty reply.");
        }

        addMessage(reply, "bot");

        history.push({
          role: "assistant",
          content: reply
        });

        history = history.slice(-20);
        saveHistory();

        status.textContent =
          data.mode === "faq" || data.category
            ? "Automated customer support"
            : "";

      } catch (error) {
        console.error("JCN CHATBOT ERROR:", error);

        let errorMessage =
          "Sorry po! Hindi makakonekta sa chatbot service. " +
          "Please try again.";

        if (error.name === "AbortError") {
          errorMessage =
            "Sorry po! The chatbot took too long to respond. " +
            "Please try again.";
        }

        addMessage(errorMessage, "bot");

        status.textContent = "Connection problem";

      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        setBusy(false);

        if (!chatWindow.hidden) {
          input.focus();
        }
      }
    }

    // ========================================
    // SEND BUTTON / ENTER KEY
    // ========================================

    form.addEventListener("submit", event => {
      event.preventDefault();
      sendMessage(input.value);
    });

    // ========================================
    // QUICK REPLY BUTTONS
    // ========================================

    shortcuts.forEach(button => {
      button.addEventListener("click", () => {
        sendMessage(button.dataset.jcnQuestion);
      });
    });

    // START MINIMIZED
    setOpen(false);

    console.log("JCN AI Assistant initialized.");

  } catch (error) {
    console.error(
      "JCN CHATBOT INITIALIZATION ERROR:",
      error
    );

    document.getElementById("jcnChatbotContainer")?.remove();
  }
}

// ============================================
// INITIALIZE WHEN PAGE IS READY
// ============================================

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeJCNChatbot,
    { once: true }
  );
} else {
  initializeJCNChatbot();
}
