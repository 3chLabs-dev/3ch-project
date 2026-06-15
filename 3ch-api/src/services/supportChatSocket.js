const { WebSocketServer, WebSocket } = require("ws");
const pool = require("../db/pool");
const { verifyToken } = require("../utils/authUtils");

const userClients = new Map();
const adminClients = new Set();

function addUserClient(userId, socket) {
  const clients = userClients.get(userId) ?? new Set();
  clients.add(socket);
  userClients.set(userId, clients);
}

function removeUserClient(userId, socket) {
  const clients = userClients.get(userId);
  if (!clients) return;
  clients.delete(socket);
  if (clients.size === 0) userClients.delete(userId);
}

function send(socket, event) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function broadcastSupportChatUpdate({ roomId, userId, type = "message" }) {
  const event = { event: "support_chat_updated", roomId, type };
  const recipients = new Set(adminClients);
  userClients.get(Number(userId))?.forEach((socket) => recipients.add(socket));
  recipients.forEach((socket) => send(socket, event));
}

function setupSupportChatSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname !== "/ws/support-chat") return;

    try {
      const token = url.searchParams.get("token");
      if (!token) throw new Error("NO_TOKEN");
      const payload = verifyToken(token);
      const result = await pool.query(
        "SELECT id, is_admin FROM users WHERE id = $1 AND deleted_at IS NULL",
        [Number(payload.sub)],
      );
      if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");

      const identity = {
        userId: Number(result.rows[0].id),
        isAdmin: Boolean(result.rows[0].is_admin),
      };
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        wss.emit("connection", webSocket, request, identity);
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (socket, _request, identity) => {
    if (identity.isAdmin) adminClients.add(socket);
    addUserClient(identity.userId, socket);
    send(socket, { event: "connected" });

    socket.on("close", () => {
      adminClients.delete(socket);
      removeUserClient(identity.userId, socket);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) socket.ping();
    });
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

module.exports = { broadcastSupportChatUpdate, setupSupportChatSocket };
