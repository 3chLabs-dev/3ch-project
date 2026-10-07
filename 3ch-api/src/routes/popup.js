const express = require('express');
const multer = require('multer');
const pool = require('../db/pool');
const { requireAdmin } = require('../middlewares/auth');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
const columns = 'id,name,link_url,starts_at,ends_at,is_active,updated_at';
const validId = (req, res, next) => /^\d+$/.test(req.params.id) ? next() : res.status(400).json({ message: '잘못된 팝업 번호입니다.' });
function imageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii',0,4) === 'RIFF' && buffer.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  if (['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6))) return 'image/gif';
  return null;
}
router.get('/popups', async (_req,res) => {
  const result = await pool.query(`SELECT ${columns} FROM popups WHERE is_active=true AND starts_at<=NOW() AND ends_at>NOW() ORDER BY created_at DESC,id DESC`);
  res.json({ popups: result.rows });
});
router.get('/popups/:id/image', validId, async (req,res) => {
  const result = await pool.query('SELECT image,image_type FROM popups WHERE id=$1',[req.params.id]);
  if (!result.rowCount) return res.sendStatus(404);
  res.set('Cache-Control','no-store').type(result.rows[0].image_type).send(result.rows[0].image);
});
router.get('/admin/popups', requireAdmin, async (_req,res) => {
  const result = await pool.query(`SELECT ${columns} FROM popups ORDER BY created_at DESC,id DESC`);
  res.json({ popups: result.rows });
});
async function save(req,res) {
  const editing = Boolean(req.params.id);
  const { name,linkUrl,startsAt,endsAt,isActive } = req.body || {};
  let url;
  try { url = new URL(linkUrl); } catch { /* validated below */ }
  const type = req.file ? imageType(req.file.buffer) : null;
  if (!name?.trim() || name.trim().length>200 || !url || !['http:','https:'].includes(url.protocol) || url.username || url.password || linkUrl.length>2000 || !Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt)) || Date.parse(endsAt)<=Date.parse(startsAt) || !['true','false'].includes(isActive) || (!editing && !req.file) || (req.file && !type)) {
    return res.status(400).json({ message: '팝업 이름, 이미지(PNG/JPG/GIF/WebP), http(s) 링크와 게시 기간을 확인해 주세요.' });
  }
  const values = [name.trim(),linkUrl,startsAt,endsAt,isActive==='true',req.file?.buffer ?? null,type];
  const result = editing
    ? await pool.query(`UPDATE popups SET name=$1,link_url=$2,starts_at=$3,ends_at=$4,is_active=$5,image=COALESCE($6,image),image_type=COALESCE($7,image_type),updated_at=NOW() WHERE id=$8 RETURNING ${columns}`,[...values,req.params.id])
    : await pool.query(`INSERT INTO popups(name,link_url,starts_at,ends_at,is_active,image,image_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${columns}`,values);
  res.status(result.rowCount ? (editing ? 200 : 201) : 404).json({ popup: result.rows[0] });
}
router.post('/admin/popups', requireAdmin, upload.single('image'), save);
router.patch('/admin/popups/:id', requireAdmin, validId, upload.single('image'), save);
router.delete('/admin/popups/:id', requireAdmin, validId, async (req,res) => {
  if (req.body?.confirmDelete !== true) return res.status(400).json({ message: '삭제 확인이 필요합니다.' });
  const result = await pool.query('DELETE FROM popups WHERE id=$1 RETURNING id',[req.params.id]);
  res.status(result.rowCount ? 200 : 404).json({ ok: Boolean(result.rowCount) });
});
router.use((error,_req,res,_next) => {
  console.error('Popup API:',error.message);
  res.status(error instanceof multer.MulterError ? 400 : 500).json({ message: error instanceof multer.MulterError ? '이미지는 3MB 이하로 업로드해 주세요.' : '팝업 처리에 실패했습니다.' });
});
module.exports = router;
