const JCN_CHAT_API = "http://localhost:5000/api/chatbot";

let jcnChatHistory = [];


/* =========================================
   LOAD CHATBOT HTML
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

  try {

    const response = await fetch("chatbot.html");

    if (!response.ok) {
      throw new Error("Unable to load chatbot HTML.");
    }

    const chatbotHTML = await response.text();

    /* Create container */
    const chatbotContainer =
      document.createElement("div");

    chatbotContainer.id =
      "jcnChatbotContainer";

    chatbotContainer.innerHTML =
      chatbotHTML;

    document.body.appendChild(
      chatbotContainer
    );


    /* Start chatbot after HTML loads */
    initializeJCNChatbot();


  } catch (error) {

    console.error(
      "JCN CHATBOT LOAD ERROR:",
      error
    );

  }

});


/* =========================================
   INITIALIZE CHATBOT
========================================= */

function initializeJCNChatbot() {

  initializeChatbotEvents();


  const savedMessages =
    JSON.parse(
      localStorage.getItem(
        "jcnChatHistory"
      )
    ) || [];


  if (savedMessages.length > 0) {

    jcnChatHistory =
      savedMessages;

    renderSavedMessages();

  } else {

    addBotMessage(
      "Hi! 👋 I'm JCN AI Assistant. I can help you with our clothing products, sizes, customization, orders, payments, and delivery. How can I help you today?"
    );

  }

}


/* =========================================
   CHATBOT EVENTS
========================================= */

function initializeChatbotEvents() {

  const toggle =
    document.getElementById(
      "jcnChatToggle"
    );

  const chatbotWindow =
    document.getElementById(
      "jcnChatWindow"
    );

  const close =
    document.getElementById(
      "jcnChatClose"
    );

  const sendButton =
    document.getElementById(
      "jcnSendButton"
    );

  const input =
    document.getElementById(
      "jcnChatInput"
    );


  /* OPEN CHAT */
  toggle.addEventListener(
    "click",
    () => {

      chatbotWindow
        .classList
        .toggle("active");


      if (
        chatbotWindow
          .classList
          .contains("active")
      ) {

        setTimeout(
          () => input.focus(),
          200
        );

      }

    }
  );


  /* CLOSE CHAT */
  close.addEventListener(
    "click",
    () => {

      chatbotWindow
        .classList
        .remove("active");

    }
  );


  /* SEND BUTTON */
  sendButton.addEventListener(
    "click",
    sendJCNMessage
  );


  /* ENTER KEY */
  input.addEventListener(
    "keydown",
    event => {

      if (event.key === "Enter") {

        event.preventDefault();

        sendJCNMessage();

      }

    }
  );


  /* QUICK QUESTIONS */
  document
    .querySelectorAll(
      ".jcn-quick-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          input.value =
            button.dataset.message;

          sendJCNMessage();

        }
      );

    });

}


/* =========================================
   SEND MESSAGE
========================================= */

async function sendJCNMessage() {

  const input =
    document.getElementById(
      "jcnChatInput"
    );

  const message =
    input.value.trim();


  if (!message) return;


  input.value = "";


  addUserMessage(message);


  showTypingIndicator();


  try {

    const response =
      await fetch(
        JCN_CHAT_API,
        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({

            message,

            history:
              jcnChatHistory.slice(-10)

          })

        }
      );


    const data =
      await response.json();


    removeTypingIndicator();


    if (!response.ok) {

      throw new Error(
        data.message ||
        "Chatbot request failed."
      );

    }


    addBotMessage(
      data.reply ||
      "Sorry, I couldn't generate a response."
    );


  } catch (error) {

    removeTypingIndicator();


    console.error(
      "JCN CHATBOT ERROR:",
      error
    );


    addBotMessage(
      "Sorry, I'm having trouble connecting right now. Please try again."
    );

  }

}


/* =========================================
   USER MESSAGE
========================================= */

function addUserMessage(message) {

  addMessageToScreen(
    "user",
    message
  );


  jcnChatHistory.push({

    role: "user",

    content: message

  });


  saveChatHistory();

}


/* =========================================
   BOT MESSAGE
========================================= */

function addBotMessage(message) {

  addMessageToScreen(
    "bot",
    message
  );


  jcnChatHistory.push({

    role: "assistant",

    content: message

  });


  saveChatHistory();

}


/* =========================================
   DISPLAY MESSAGE
========================================= */

function addMessageToScreen(
  type,
  message
) {

  const container =
    document.getElementById(
      "jcnChatMessages"
    );


  const row =
    document.createElement(
      "div"
    );


  row.className =
    `jcn-message-row ${type}`;


  const bubble =
    document.createElement(
      "div"
    );


  bubble.className =
    `jcn-message ${type}`;


  /* Prevent HTML injection */
  bubble.textContent =
    message;


  row.appendChild(
    bubble
  );


  container.appendChild(
    row
  );


  scrollChatToBottom();

}


/* =========================================
   TYPING ANIMATION
========================================= */

function showTypingIndicator() {

  const container =
    document.getElementById(
      "jcnChatMessages"
    );


  removeTypingIndicator();


  const typing =
    document.createElement(
      "div"
    );


  typing.id =
    "jcnTypingIndicator";


  typing.className =
    "jcn-message-row bot";


  typing.innerHTML = `

    <div class="jcn-typing">

      <span></span>

      <span></span>

      <span></span>

    </div>

  `;


  container.appendChild(
    typing
  );


  scrollChatToBottom();

}


/* =========================================
   REMOVE TYPING
========================================= */

function removeTypingIndicator() {

  const typing =
    document.getElementById(
      "jcnTypingIndicator"
    );


  if (typing) {

    typing.remove();

  }

}


/* =========================================
   SCROLL TO LATEST MESSAGE
========================================= */

function scrollChatToBottom() {

  const container =
    document.getElementById(
      "jcnChatMessages"
    );


  if (!container) return;


  container.scrollTop =
    container.scrollHeight;

}


/* =========================================
   SAVE CHAT HISTORY
========================================= */

function saveChatHistory() {

  localStorage.setItem(

    "jcnChatHistory",

    JSON.stringify(
      jcnChatHistory.slice(-30)
    )

  );

}


/* =========================================
   RESTORE CHAT HISTORY
========================================= */

function renderSavedMessages() {

  jcnChatHistory.forEach(
    message => {

      addMessageToScreen(

        message.role === "user"
          ? "user"
          : "bot",

        message.content

      );

    }
  );

}