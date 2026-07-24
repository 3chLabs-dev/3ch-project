const crypto = require("crypto");
const express = require("express");
const pool = require("../db/pool");
const { optionalAuth, requireAdmin } = require("../middlewares/auth");
const { broadcastSupportChatUpdate } = require("../services/supportChatSocket");

const router = express.Router();
const guestSendHistory = new Map();
const GUEST_TOKEN_HEADER = "x-support-guest-token";

const hashGuestToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const createGuestName = () =>
  `비회원-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

function enforceGuestRateLimit(req, res, next) {
  if (req.user) return next();
  const identity = `${req.ip}:${req.get(GUEST_TOKEN_HEADER) || "new"}`;
  const now = Date.now();
  const recent = (guestSendHistory.get(identity) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 10) {
    return res.status(429).json({ message: "메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해 주세요." });
  }
  recent.push(now);
  guestSendHistory.set(identity, recent);
  return next();
}

async function findOrCreateMemberRoom(userId) {
  const result = await pool.query(
    `INSERT INTO support_chat_rooms (user_id)
     VALUES ($1)
     ON CONFLICT (user_id)
     DO UPDATE SET updated_at = support_chat_rooms.updated_at
     RETURNING *`,
    [userId],
  );
  return result.rows[0];
}

async function findGuestRoom(rawToken) {
  if (!rawToken) return null;
  const result = await pool.query(
    `SELECT * FROM support_chat_rooms
     WHERE guest_token_hash = $1 AND user_id IS NULL`,
    [hashGuestToken(rawToken)],
  );
  return result.rows[0] ?? null;
}

async function createGuestRoom() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const guestToken = crypto.randomBytes(32).toString("base64url");
    try {
      const result = await pool.query(
        `INSERT INTO support_chat_rooms (guest_name, guest_token_hash)
         VALUES ($1, $2)
         RETURNING *`,
        [createGuestName(), hashGuestToken(guestToken)],
      );
      return { room: result.rows[0], guestToken };
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
  }
  throw new Error("GUEST_ROOM_CREATE_FAILED");
}

async function resolveRoom(req, createWhenMissing = true) {
  if (req.user) {
    return {
      room: await findOrCreateMemberRoom(Number(req.user.sub)),
      guestToken: null,
    };
  }
  const rawGuestToken = req.get(GUEST_TOKEN_HEADER);
  const existingRoom = await findGuestRoom(rawGuestToken);
  if (existingRoom) return { room: existingRoom, guestToken: null };
  if (!createWhenMissing) return { room: null, guestToken: null };
  return createGuestRoom();
}

router.get("/support-chat", optionalAuth, async (req, res) => {
  try {
    const { room, guestToken } = await resolveRoom(req);
    const messages = await pool.query(
      `SELECT id, sender_type, content, created_at
       FROM support_chat_messages
       WHERE room_id = $1
       ORDER BY id ASC`,
      [room.id],
    );
    res.json({
      room: {
        id: room.id,
        status: room.status,
        guestName: room.guest_name ?? null,
      },
      messages: messages.rows,
      ...(guestToken ? { guestToken } : {}),
    });
  } catch (error) {
    res.status(500).json({ message: String(error.message) });
  }
});

router.post("/support-chat/messages", optionalAuth, enforceGuestRateLimit, async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ message: "메시지를 입력해 주세요." });
  if (content.length > 2000) return res.status(400).json({ message: "메시지는 2,000자 이내로 입력해 주세요." });

  const client = await pool.connect();
  try {
    const resolved = await resolveRoom(req);
    const room = resolved.room;
    await client.query("BEGIN");
    await client.query(
      `UPDATE support_chat_rooms
       SET status = 'open', last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [room.id],
    );
    const message = await client.query(
      `INSERT INTO support_chat_messages (room_id, sender_type, sender_id, content)
       VALUES ($1, 'user', $2, $3)
       RETURNING id, sender_type, content, created_at`,
      [room.id, req.user ? Number(req.user.sub) : null, content],
    );
    await client.query("COMMIT");
    broadcastSupportChatUpdate({
      roomId: room.id,
      userId: room.user_id,
      guestTokenHash: room.guest_token_hash,
    });
    res.status(201).json({
      message: message.rows[0],
      ...(resolved.guestToken ? { guestToken: resolved.guestToken } : {}),
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(error.message) });
  } finally {
    client.release();
  }
});

router.get("/admin/support-chat/rooms", requireAdmin, async (_req, res) => {
  try {
    const rooms = await pool.query(
      `SELECT r.id, r.user_id, r.guest_name, r.status, r.last_message_at, r.created_at,
              u.name AS user_name, u.email AS user_email,
              m.content AS last_message, m.sender_type AS last_sender_type
       FROM support_chat_rooms r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN LATERAL (
         SELECT content, sender_type
         FROM support_chat_messages
         WHERE room_id = r.id
         ORDER BY id DESC
         LIMIT 1
       ) m ON true
       ORDER BY r.last_message_at DESC`,
    );
    res.json({ rooms: rooms.rows });
  } catch (error) {
    res.status(500).json({ message: String(error.message) });
  }
});

router.get("/admin/support-chat/rooms/:id", requireAdmin, async (req, res) => {
  try {
    const roomResult = await pool.query(
      `SELECT r.id, r.user_id, r.guest_name, r.status, r.last_message_at, r.created_at,
              u.name AS user_name, u.email AS user_email
       FROM support_chat_rooms r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = $1`,
      [req.params.id],
    );
    if (roomResult.rowCount === 0) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    const messages = await pool.query(
      `SELECT id, sender_type, content, created_at
       FROM support_chat_messages
       WHERE room_id = $1
       ORDER BY id ASC`,
      [req.params.id],
    );
    res.json({ room: roomResult.rows[0], messages: messages.rows });
  } catch (error) {
    res.status(500).json({ message: String(error.message) });
  }
});

router.post("/admin/support-chat/rooms/:id/messages", requireAdmin, async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ message: "메시지를 입력해 주세요." });
  if (content.length > 2000) return res.status(400).json({ message: "메시지는 2,000자 이내로 입력해 주세요." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const message = await client.query(
      `WITH room AS (
         SELECT id, user_id, guest_token_hash FROM support_chat_rooms WHERE id = $1
       )
       INSERT INTO support_chat_messages (room_id, sender_type, sender_id, content)
       SELECT id, 'admin', $2, $3 FROM room
       RETURNING id, sender_type, content, created_at`,
      [req.params.id, Number(req.user.sub), content],
    );
    if (message.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }
    const roomResult = await client.query(
      `UPDATE support_chat_rooms
       SET last_message_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING user_id, guest_token_hash`,
      [req.params.id],
    );
    await client.query("COMMIT");
    broadcastSupportChatUpdate({
      roomId: Number(req.params.id),
      userId: roomResult.rows[0].user_id,
      guestTokenHash: roomResult.rows[0].guest_token_hash,
    });
    res.status(201).json(message.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(error.message) });
  } finally {
    client.release();
  }
});

router.patch("/admin/support-chat/rooms/:id/status", requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!["open", "closed"].includes(status)) {
    return res.status(400).json({ message: "올바르지 않은 상태입니다." });
  }
  try {
    const room = await pool.query(
      `UPDATE support_chat_rooms
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id],
    );
    if (room.rowCount === 0) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    broadcastSupportChatUpdate({
      roomId: Number(req.params.id),
      userId: room.rows[0].user_id,
      guestTokenHash: room.rows[0].guest_token_hash,
      type: "status",
    });
    res.json(room.rows[0]);
  } catch (error) {
    res.status(500).json({ message: String(error.message) });
  }
});

module.exports = router;
