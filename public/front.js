let userId = localStorage.getItem("userId") || uuid.v4();
let messageContainer = document.getElementById("messageContainer");
let userInput = document.getElementById("userInput");
let messageContainerIndex = 0;
let isStreamComplete = false;
let currentMessageContainer = null;
let currentAssistantMessageElement = null;

// Store the userId in localStorage
localStorage.setItem("userId", userId);
console.log("[front.js] userId stored in localStorage:", userId);

// Establish the socket connection
const socket = io();
console.log("[front.js] Socket connection established");

// Send the userId to the server
socket.emit("userId", userId);
console.log("[front.js] userId sent to server:", userId);

// Always keep the cursor in the input box
userInput.focus();
userInput.addEventListener('blur', () => userInput.focus());

userInput.addEventListener("keydown", async (event) => {
  console.log("[front.js/userInput.addEventListener] Event listener triggered");
  if (event.key === "Enter") {
    event.preventDefault();
    const userPrompt = userInput.value.trim();
    console.log("[front.js/userInput.addEventListener] User prompt entered:", userPrompt);
    if (userPrompt !== "") {
      isStreamComplete = false;
      currentMessageContainer = createMessageContainer();
      displayUserMessage(userPrompt, currentMessageContainer);
      userInput.value = "";
      await sendUserPrompt(userPrompt);
    }
  }
});

function displayUserMessage(message, messageContainer) {
  console.log("[front.js/displayUserMessage] Displaying user message:", message);
  const userMessageElement = document.createElement("div");
  userMessageElement.classList.add("user-message");
  userMessageElement.textContent = message;
  messageContainer.appendChild(userMessageElement);
  scrollToBottom();  // Ensure the latest messages are always visible
  console.log("[front.js/displayUserMessage] User message displayed in container:", messageContainer.id);
}

async function sendUserPrompt(userPrompt) {
  console.log("[front.js/sendUserPrompt] Sending user prompt to server:", userPrompt);
  socket.emit("userPrompt", userPrompt);
}

socket.on("gameMessage", (message) => {
  console.log("[front.js/socket.on('gameMessage')] Message received:", message);

  if (message.includes("[DONE]")) {
    message = message.replace("[DONE]", "").trim();
    displayAssistantMessage(message, true); // True indicates this message is complete
    console.log("[front.js/socket.on('gameMessage')] Complete assistant message displayed");
    isStreamComplete = true;
    console.log("[front.js/socket.on('gameMessage')] Stream marked as complete");
  } else {
    displayAssistantMessage(message, false); // False indicates the stream continues
  }
});

function displayAssistantMessage(message, complete) {
  console.log("[front.js/displayAssistantMessage] Displaying assistant message:", message);
  if (complete || !currentAssistantMessageElement) {
    currentAssistantMessageElement = document.createElement("div");
    currentAssistantMessageElement.classList.add("assistant-message");
    currentMessageContainer.appendChild(currentAssistantMessageElement);
    console.log("[front.js/displayAssistantMessage] New assistant message element created");
  }
  currentAssistantMessageElement.textContent += message;
  scrollToBottom();  // Auto-scroll to show the latest messages
  console.log("[front.js/displayAssistantMessage] Assistant message displayed in container:", currentMessageContainer.id);

  if (complete) {
    currentAssistantMessageElement = null; // Reset after completion to ensure next message starts new
    currentMessageContainer = null; // Ensure a new container is created for the next message
  }
}

socket.on("previousMessages", (messages) => {
    messages.forEach(msg => {
        displayPreviousMessage(msg.prompt, "user");
        displayPreviousMessage(msg.response, "assistant");
    });
});

function displayPreviousMessage(message, role) {
    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    if (role === "user") {
        messageElement.classList.add("user-message");
    } else {
        messageElement.classList.add("assistant-message");
    }
    messageContainer.appendChild(messageElement);
}


function createMessageContainer() {
  const messageContainer = document.createElement("div");
  messageContainer.id = `message-container-${messageContainerIndex}`;
  messageContainer.classList.add("message-container");
  messageContainerIndex++;
  document.getElementById("messageContainer").appendChild(messageContainer);
  console.log("[front.js/createMessageContainer] New message container created:", messageContainer.id);
  return messageContainer;
}

function scrollToBottom() {
  messageContainer.scrollTop = messageContainer.scrollHeight;
}
