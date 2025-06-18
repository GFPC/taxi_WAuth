require("dotenv").config();
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const { logWithDate } = require("./utils/logger");
const fs = require("fs");
const express = require("express");
const routes = require("./routes");
const getAIResponse = require("./utils/geminiClient");
const {createHash} = require("crypto");
const {GFPWAQRClient} = require("./GFPWaQRHubConfig");

const app = express();
const { PORT = 3113 } = process.env;

app.use(express.json({ limit: "50mb" }));
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

const client = new Client({
  puppeteer: {
    headless: true,
    args: [
      "--disable-accelerated-2d-canvas",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-cache",
      "--disable-component-extensions-with-background-pages",
      "--disable-crash-reporter",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-hang-monitor",
      "--disable-ipc-flooding-protection",
      "--disable-mojo-local-storage",
      "--disable-notifications",
      "--disable-popup-blocking",
      "--disable-print-preview",
      "--disable-prompt-on-repost",
      "--disable-renderer-backgrounding",
      "--disable-software-rasterizer",
      "--ignore-certificate-errors",
      "--log-level=3",
      "--no-default-browser-check",
      "--no-first-run",
      "--no-sandbox",
      "--no-zygote",
      "--renderer-process-limit=100",
      "--enable-gpu-rasterization",
      "--enable-zero-copy",
    ],
  },
  authStrategy: new LocalAuth(),
  dataPath: "session",
});

const botInfo = {
  id: '',
  name: 'Auth codes bot',
  description: 'Sends auth codes through WhatsApp. Runs server on port 3000. Powered by GFP',
}
botInfo.id = createHash('md5').update(botInfo.name).digest('hex');

const GFPWAQRHubURL = 'http://188.225.44.153:8010/api';
const GFPWAQRClientInstance = new GFPWAQRClient(GFPWAQRHubURL);
function formatQRData(qr) {
  // Если уже строка в base64
  if (typeof qr === 'string' && !qr.startsWith('data:image')) {
    return qr;
  }

  // Если data URL
  if (typeof qr === 'string' && qr.startsWith('data:image')) {
    return qr
  }

  // Если Buffer или Uint8Array
  if (Buffer.isBuffer(qr) || qr instanceof Uint8Array) {
    return Buffer.from(qr).toString('base64')
  }

  // Если объект с данными
  if (typeof qr === 'object' && qr !== null) {
    if (qr.data) {
      return Buffer.from(qr.data).toString('base64')
    }
    if (qr.base64) {
      return qr.base64
    }
  }

  throw new Error('Unsupported QR format')
}

let isRegisteredOnGFPWAQRHub = false

routes(app, client);
client.initialize();

client.on("qr", async (qr) => {
  qrcode.generate(qr, {small: true})

  if (!isRegisteredOnGFPWAQRHub) {
    const response = await GFPWAQRClientInstance.checkRegistration(botInfo.id)
    if (!response.success) {
      console.log('⚠️ Bot not registered on GFPWAQRHub, try to register')
      const registerResponse = await GFPWAQRClientInstance.registerBot(botInfo)
      if (registerResponse.success) {
        console.log('✅ Bot registered on GFPWAQRHub')
        isRegisteredOnGFPWAQRHub = true
      }
    } else {
      console.log("✅ Bot already registered on GFPWAQRHub")
      const response = await GFPWAQRClientInstance.setAuthenticated(botInfo.id, false)
      console.log(response)
    }
  } else {
    console.log("✅ Bot already registered on GFPWAQRHub")
    const response = await GFPWAQRClientInstance.setAuthenticated(botInfo.id, false)
    console.log(response)
  }

  const qrCode = formatQRData(qr);
  const response = await GFPWAQRClientInstance.sendQRCode(botInfo.id, qrCode)
  console.log(response)
});
client.on("loading_screen", (percent, message) =>
  log(`Loading: ${percent}% - ${message}`)
);
client.on("auth_failure", () => log("Authentication failure!"));
client.on("disconnected", async () => {
  log("Client disconnected!")
  await GFPWAQRClientInstance.sendCustomNotification(
      botInfo.id,'🔴 Bot disconnected: Whatsapp status: ' + reason, botInfo.name
  )
  console.log("poin1",reason==="LOGOUT")
  if(reason === "LOGOUT"){
    console.log('tryng to logout safety')
    try {

      await safeLogout(client);
    } catch (err) {
      console.error("Критическая ошибка при выходе:", err);
    }
  }
});
client.on("authenticated", async () => {
  log("Client authenticated!")

  const response = await GFPWAQRClientInstance.setAuthenticated(botInfo.id, true)
  console.log(response)
});
client.on("ready", () => startServer());

client.on("message", async (message) => {
  const { body, from } = message;

  if (body === "!ping") return handlePing(message, from);
  if (body === "!logs") return handleLogs(message, from);
  if (body.startsWith("!deleteMessage,"))
    return handleDeleteMessage(message, body);
  if (body.startsWith("!AI ")) return handleAIResponse(message, body, from);
});

function log(message) {
  logWithDate(message);
  console.log(message);
}

function startServer() {
  log("WhatsApp API siap digunakan!");

  const server = app.listen(PORT, () => log(`Server berjalan di port ${PORT}`));
  server.on("error", handleError(server));
}

function handleError(server) {
  return (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} sudah digunakan, mencoba port lain...`);
      server.listen(0);
    } else {
      throw err;
    }
  };
}

async function handlePing(message, from) {
  message.reply("pong");
  log(`${from}: pinged!`);
}

function handleLogs(message, from) {
  fs.readFile("logs/status.log", "utf8", (err, data) => {
    if (err) return;
    const recentLines = data.trim().split("\n").slice(-10).join("\n");
    message.reply(recentLines);
    log(`${from}: !logs`);
  });
}

async function handleDeleteMessage(message, body) {
  const messageID = body.split(",")[1];
  try {
    const msg = await client.getMessageById(messageID);
    if (msg.fromMe) {
      msg.delete(true);
      message.reply(`Pesan dengan ID ${messageID} telah dihapus!`);
      log(`Pesan dengan ID ${messageID} telah dihapus!`);
    }
  } catch (error) {
    log(`Error getting message: ${error}`);
  }
}

async function handleAIResponse(message, body, from) {
  const question = body.slice(4);
  try {
    const response = await getAIResponse(question);
    message.reply(response);
    log(`${from}: ${question}`);
  } catch (error) {
    log(`Error getting AI response: ${error}`);
  }
}
