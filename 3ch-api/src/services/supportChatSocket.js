const { WebSocketServer, WebSocket } = require("ws");
const crypto = require("crypto");
const pool = require("../db/pool");
const { verifyToken } = require("../utils/authUtils");

const userClients = new Map();
const adminClients = new Set();

const hashGuestToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

function addUserClient(identityKey, socket) {
  const clients = userClients.get(identityKey) ?? new Set();
  clients.add(socket);
  userClients.set(identityKey, clients);
}

function removeUserClient(identityKey, socket) {
  const clients = userClients.get(identityKey);
  if (!clients) return;
  clients.delete(socket);
  if (clients.size === 0) userClients.delete(identityKey);
}

function send(socket, event) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
}

function broadcastSupportChatUpdate({ roomId, userId, guestTokenHash, type = "message" }) {
  const event = { event: "support_chat_updated", roomId, type };
  const recipients = new Set(adminClients);
  const identityKey = userId
    ? `user:${Number(userId)}`
    : guestTokenHash
      ? `guest:${guestTokenHash}`
      : null;
  if (identityKey) {
    userClients.get(identityKey)?.forEach((socket) => recipients.add(socket));
  }
  recipients.forEach((socket) => send(socket, event));
}

function setupSupportChatSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname !== "/ws/support-chat") return;

    try {
      const token = url.searchParams.get("token");
      const guestToken = url.searchParams.get("guestToken");
      let identity;
      if (token) {
        const payload = verifyToken(token);
        const result = await pool.query(
          "SELECT id, is_admin FROM users WHERE id = $1 AND deleted_at IS NULL",
          [Number(payload.sub)],
        );
        if (result.rowCount === 0) throw new Error("USER_NOT_FOUND");
        identity = {
          identityKey: `user:${Number(result.rows[0].id)}`,
          isAdmin: Boolean(result.rows[0].is_admin),
        };
      } else if (guestToken) {
        const guestTokenHash = hashGuestToken(guestToken);
        const result = await pool.query(
          "SELECT id FROM support_chat_rooms WHERE guest_token_hash = $1 AND user_id IS NULL",
          [guestTokenHash],
        );
        if (result.rowCount === 0) throw new Error("GUEST_NOT_FOUND");
        identity = {
          identityKey: `guest:${guestTokenHash}`,
          isAdmin: false,
        };
      } else {
        throw new Error("NO_TOKEN");
      }
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
    addUserClient(identity.identityKey, socket);
    send(socket, { event: "connected" });

    socket.on("close", () => {
      adminClients.delete(socket);
      removeUserClient(identity.identityKey, socket);
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
