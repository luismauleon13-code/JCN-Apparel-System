
// ============================================
// JCN AI ASSISTANT - COMPLETE CHATBOT JS
// ============================================

const JCN_CHAT_API =
  "http://localhost:5000/api/chatbot";

// ============================================
// INITIALIZE CHATBOT
// ============================================

async function initializeJCNChatbot() {

  if (
    document.getElementById(
      "jcnChatbotContainer"
    )
  ) {
    return;
  }

  try {

    // Load chatbot HTML
    const fragmentURL = new URL(
      "chatbot.html",
      document.baseURI
    );

    const response = await fetch(fragmentURL);

    if (!response.ok) {
      throw new Error(
        `chatbot.html not found (HTTP ${response.status})`
      );
    }

    // Create chatbot container
    const container =
      document.createElement("div");

    container.id = "jcnChatbotContainer";

    container.innerHTML =
      await response.text();

    document.body.appendChild(container);

    // Get HTML elements
    const toggle =
      container.querySelector("#jcnChatToggle");

    const chatWindow =
      container.querySelector("#jcnChatWindow");

    const close =
      container.querySelector("#jcnChatClose");

    const messages =
      container.querySelector("#jcnChatMessages");

    const form =
      container.querySelector("#jcnChatForm");

    const input =
      container.querySelector("#jcnChatInput");

    const send =
      container.querySelector("#jcnChatSend");

    const status =
      container.querySelector("#jcnChatStatus");

    const shortcuts =
      container.querySelectorAll(
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
      ].some(el => !el)
    ) {
      throw new Error(
        "Required chatbot HTML IDs are missing."
      );
    }

    let busy = false;

    const history = [];

    // ========================================
    // OPEN / MINIMIZE
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
      } else {
        toggle.focus();
      }
    }

    // Floating icon click
    toggle.addEventListener(
      "click",
      () => {
        setOpen(chatWindow.hidden);
      }
    );

    // Minimize click
    close.addEventListener(
      "click",
      () => {
        setOpen(false);
      }
    );

    // Escape key
    document.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Escape" &&
          !chatWindow.hidden
        ) {
          setOpen(false);
        }

      }
    );

    // ========================================
    // DISPLAY MESSAGE
    // ========================================

    function addMessage(text, role) {

      const item =
        document.createElement("div");

      item.className =
        `jcn-msg jcn-msg-${role}`;

      item.textContent = text;

      messages.appendChild(item);

      messages.scrollTop =
        messages.scrollHeight;
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

      const message =
        String(rawText || "").trim();

      if (!message || busy) return;

      if (message.length > 600) {

        status.textContent =
          "Maximum 600 characters per message.";

        return;
      }

      input.value = "";

      addMessage(message, "user");

      setBusy(true);

      status.textContent =
        "JCN Assistant is typing...";

      try {

        const controller =
          new AbortController();

        const timer = setTimeout(
          () => controller.abort(),
          20000
        );

        let apiResponse;

        try {

          apiResponse = await fetch(
            JCN_CHAT_API,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                message,
                history: history.slice(-10)
              }),

              signal: controller.signal
            }
          );

        } finally {
          clearTimeout(timer);
        }

        const data =
          await apiResponse.json();

        const reply =
          data.reply ||
          data.response ||
          data.message;

        if (
          !apiResponse.ok ||
          data.success === false ||
          typeof reply !== "string" ||
          !reply.trim()
        ) {
          throw new Error(
            data.message ||
            `Chatbot HTTP ${apiResponse.status}`
          );
        }

        // Show chatbot response
        addMessage(reply, "bot");

        // Save conversation in memory
        history.push(
          {
            role: "user",
            content: message
          },
          {
            role: "assistant",
            content: reply
          }
        );

        if (history.length > 20) {
          history.splice(
            0,
            history.length - 20
          );
        }

        status.textContent =
          data.mode === "faq"
            ? "Automated FAQ response"
            : "";

      } catch (error) {

        console.error(
          "JCN chatbot error:",
          error
        );

        const detail =
          error.name === "AbortError"
            ? "The server took too long to reply."
            : "Cannot connect to the chatbot service.";

        addMessage(
          `${detail} Please check that server.js is running and /api/chatbot is available.`,
          "bot"
        );

        status.textContent =
          "Connection problem";

      } finally {

        setBusy(false);

        if (!chatWindow.hidden) {
          input.focus();
        }
      }
    }

    // ========================================
    // SEND BUTTON / ENTER KEY
    // ========================================

    form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        sendMessage(input.value);

      }
    );

    // ========================================
    // QUICK REPLY BUTTONS
    // ========================================

    shortcuts.forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const question =
            button.dataset.jcnQuestion;

          sendMessage(question);

        }
      );

    });

  } catch (error) {

    console.error(
      "JCN chatbot could not initialize:",
      error
    );

  }
}

// ============================================
// LOAD WHEN PAGE IS READY
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
