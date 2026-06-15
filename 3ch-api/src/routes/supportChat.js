const express = require("express");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middlewares/auth");
const { broadcastSupportChatUpdate } = require("../services/supportChatSocket");

const router = express.Router();

async function findOrCreateRoom(userId) {
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

router.get("/support-chat", requireAuth, async (req, res) => {
  try {
    const room = await findOrCreateRoom(Number(req.user.sub));
    const messages = await pool.query(
      `SELECT id, sender_type, content, created_at
       FROM support_chat_messages
       WHERE room_id = $1
       ORDER BY id ASC`,
      [room.id],
    );
    res.json({ room, messages: messages.rows });
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

router.post("/support-chat/messages", requireAuth, async (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ message: "메시지를 입력해 주세요." });
  if (content.length > 2000) return res.status(400).json({ message: "메시지는 2,000자 이내로 입력해 주세요." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomResult = await client.query(
      `INSERT INTO support_chat_rooms (user_id)
       VALUES ($1)
       ON CONFLICT (user_id)
       DO UPDATE SET status = 'open', updated_at = NOW()
       RETURNING *`,
      [Number(req.user.sub)],
    );
    const room = roomResult.rows[0];
    const message = await client.query(
      `INSERT INTO support_chat_messages (room_id, sender_type, sender_id, content)
       VALUES ($1, 'user', $2, $3)
       RETURNING id, sender_type, content, created_at`,
      [room.id, Number(req.user.sub), content],
    );
    await client.query(
      `UPDATE support_chat_rooms SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [room.id],
    );
    await client.query("COMMIT");
    broadcastSupportChatUpdate({ roomId: room.id, userId: Number(req.user.sub) });
    res.status(201).json(message.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(e.message) });
  } finally {
    client.release();
  }
});

router.get("/admin/support-chat/rooms", requireAdmin, async (_req, res) => {
  try {
    const rooms = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.last_message_at, r.created_at,
              u.name AS user_name, u.email AS user_email,
              m.content AS last_message, m.sender_type AS last_sender_type
       FROM support_chat_rooms r
       JOIN users u ON u.id = r.user_id
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
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

router.get("/admin/support-chat/rooms/:id", requireAdmin, async (req, res) => {
  try {
    const roomResult = await pool.query(
      `SELECT r.id, r.user_id, r.status, r.last_message_at, r.created_at,
              u.name AS user_name, u.email AS user_email
       FROM support_chat_rooms r
       JOIN users u ON u.id = r.user_id
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
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
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
         SELECT id, user_id FROM support_chat_rooms WHERE id = $1
       )
       INSERT INTO support_chat_messages (room_id, sender_type, sender_id, content)
       SELECT id, 'admin', $2, $3 FROM room
       RETURNING id, sender_type, content, created_at,
         (SELECT user_id FROM room) AS user_id`,
      [req.params.id, Number(req.user.sub), content],
    );
    if (message.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }
    await client.query(
      `UPDATE support_chat_rooms SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id],
    );
    await client.query("COMMIT");
    broadcastSupportChatUpdate({
      roomId: Number(req.params.id),
      userId: message.rows[0].user_id,
    });
    res.status(201).json(message.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(500).json({ message: String(e.message) });
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
      `UPDATE support_chat_rooms SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id],
    );
    if (room.rowCount === 0) return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    broadcastSupportChatUpdate({
      roomId: Number(req.params.id),
      userId: room.rows[0].user_id,
      type: "status",
    });
    res.json(room.rows[0]);
  } catch (e) {
    res.status(500).json({ message: String(e.message) });
  }
});

module.exports = router;
