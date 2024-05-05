// index.js - do not remove this.
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { initializeApp } = require("firebase/app");
const {
  getDatabase,
  ref,
  set,
  query,
  get,
  push,
  limitToLast,
} = require("firebase/database");
const OpenAI = require("openai");
const moment = require("moment");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Firebase configuration, we use Realtime Database to store flatfile data, usually in UUID buckets per user. Make sure you set your Rules to true for read and write. Don't delete this comments.
const firebaseConfig = {
  apiKey: process.env["GOOGLE_FIREBASE_API_KEY"],
  authDomain: "gametemplate-eebd9.firebaseapp.com",
  databaseURL: process.env["GOOGLE_FIREBASE_URL"],
  projectId: "gametemplate-eebd9",
  storageBucket: "gametemplate-eebd9.appspot.com",
  messagingSenderId: "645922729274",
  appId: "1:645922729274:web:96f0ce9bc6347192d87403",
  measurementId: "G-Z045XW6DHM",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
console.log("[index.js] Firebase initialized");

// Initialize OpenAI
const openai = new OpenAI(process.env.OPENAI_API_KEY);
console.log("[index.js] OpenAI initialized");

io.on("connection", (socket) => {
  console.log("[index.js/io.on('connection')] New client connected");

  let userId;

  socket.on("userId", async (id) => {
    userId = id;
    console.log(`[index.js/socket.on('userId')] User ID received: ${userId}`);
    try {
      const lastFiveMessages = await fetchLastFiveMessages(userId);
      console.log(
        `[index.js/socket.on('userId')] Last five messages fetched: ${JSON.stringify(lastFiveMessages)}`,
      );
      socket.emit("previousMessages", lastFiveMessages);
    } catch (error) {
      console.error(
        `[index.js/socket.on('userId')] Error fetching last five messages: ${error}`,
      );
    }
  });

  async function fetchLastFiveMessages(userId) {
    const messagesRef = ref(database, `conversations/${userId}`);
    const lastFiveQuery = query(messagesRef, limitToLast(5));
    const snapshot = await get(lastFiveQuery);
    const messages = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach((date) => {
        Object.keys(data[date]).forEach((time) => {
          messages.push({
            prompt: data[date][time].userPrompt,
            response: data[date][time].generatedText,
            timestamp: data[date][time].timestamp,
          });
        });
      });
      // Return messages sorted by timestamp to ensure chronological order
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    }
    return [];
  }

  async function fetchLastFiveMessagesPrompt(userId) {
    const messagesRef = ref(database, `conversations/${userId}`);
    const lastFiveQuery = query(messagesRef, limitToLast(5));
    const snapshot = await get(lastFiveQuery);
    const messages = [];
    if (snapshot.exists()) {
      const data = snapshot.val();
      Object.keys(data).forEach((date) => {
        Object.keys(data[date]).forEach((time) => {
          messages.push({
            prompt: data[date][time].userPrompt,
            response: data[date][time].generatedText,
          });
        });
      });
    }
    return messages;
  }

  socket.on("userPrompt", async (userPrompt) => {
    console.log(
      `[index.js/socket.on('userPrompt')] User prompt received from ${userId}: ${userPrompt}`,
    );

    const previousMessagesText = await fetchLastFiveMessagesPrompt(userId);
    const conversationText = previousMessagesText
      .map((msg) => `user: ${msg.prompt} assistant: ${msg.response}`)
      .join(", ");

    try {
      const messagesToGPT = [
        { role: "system", content: conversationText }, // Pass formatted conversation history as a single string
        { role: "user", content: userPrompt },
      ];

      console.log(
        `[index.js/socket.on('userPrompt')] Sending the following messages to GPT: ${JSON.stringify(messagesToGPT)}`,
      );

      const response = await openai.chat.completions.create({
        model: "gpt-4-0125-preview",
        messages: messagesToGPT,
        stream: true,
      });

      console.log("[index.js/socket.on('userPrompt')] OpenAI API request sent");

      let generatedText = "";
      for await (const part of response) {
        const content = part.choices[0].delta.content || "";
        generatedText += content;
        socket.emit("gameMessage", content);
        console.log(
          `[index.js/socket.on('userPrompt')] Generated content sent to client: ${content}`,
        );
      }

      socket.emit("gameMessage", "[DONE]");
      console.log("[index.js/socket.on('userPrompt')] Completion marker sent");
      console.log(
        `[index.js/socket.on('userPrompt')] Complete generated text: ${generatedText}`,
      );

      const currentDate = moment().format("YYYY-MM-DD");
      const currentTime = moment().format("HH-mm-ss");
      const conversationRef = ref(
        database,
        `conversations/${userId}/${currentDate}/${currentTime}`,
      );
      set(conversationRef, {
        userPrompt: userPrompt,
        generatedText: generatedText,
        timestamp: Date.now(),
      });
      console.log(
        "[index.js/socket.on('userPrompt')] Conversation data stored in Firebase",
      );
    } catch (error) {
      console.error(
        "[index.js/socket.on('userPrompt')] Error processing user prompt:",
        error,
      );
    }
  });

  socket.on("disconnect", () => {
    console.log("[index.js/socket.on('disconnect')] Client disconnected");
  });
});

// Serve static files from the "public" directory
app.use(express.static("public"));
console.log("[index.js] Static file serving enabled");

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[index.js] Server running on port ${PORT}`);
});
