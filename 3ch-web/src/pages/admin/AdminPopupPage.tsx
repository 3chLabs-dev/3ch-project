import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { popupImage } from '../../components/LeaguePopup';
import type { Popup } from '../../components/LeaguePopup';
const API = import.meta.env.VITE_API_BASE_URL ?? '/api';
const date = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const blank = () => ({ name: '', linkUrl: '', startsAt: date(new Date().toISOString()), endsAt: '', isActive: true });
export default function AdminPopupPage() {
  const [rows, setRows] = useState<Popup[]>([]);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Popup | null>(null);
  const authorization = () => ({ Authorization: `Bearer ${localStorage.getItem('admin_token') ?? ''}` });
  const load = useCallback(async () => {
    try { const response = await fetch(`${API}/admin/popups`, { headers: authorization() }); if (!response.ok) throw new Error('목록을 불러오지 못했습니다.'); setRows((await response.json()).popups ?? []); } catch (e) { setError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const show = (row: Popup | null) => { setError(''); setEditing(row); setFile(null); setForm(row ? { name: row.name, linkUrl: row.link_url, startsAt: date(row.starts_at), endsAt: date(new Date(Date.parse(row.ends_at) - 1).toISOString()), isActive: row.is_active } : blank()); setOpen(true); };
  const save = async () => {
    setError('');
    let url; try { url = new URL(form.linkUrl); } catch { /* checked below */ }
    if (!form.name.trim() || (!editing && !file) || !url || !['http:', 'https:'].includes(url.protocol) || !form.startsAt || !form.endsAt || form.endsAt < form.startsAt) { setError('이름, 이미지, http(s) 링크와 게시 기간을 확인해 주세요.'); return; }
    const body = new FormData(); body.set('name', form.name); body.set('linkUrl', form.linkUrl); body.set('startsAt', new Date(`${form.startsAt}T00:00:00+09:00`).toISOString()); body.set('endsAt', new Date(Date.parse(`${form.endsAt}T00:00:00+09:00`) + 86400000).toISOString()); body.set('isActive', String(form.isActive)); if (file) body.set('image', file);
    setBusy(true);
    try { const response = await fetch(`${API}/admin/popups${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', headers: authorization(), body }); const data = await response.json(); if (!response.ok) throw new Error(data.message || '저장에 실패했습니다.'); setOpen(false); await load(); } catch (e) { setError(e instanceof Error ? e.message : '저장에 실패했습니다.'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setError('');
    try { const response = await fetch(`${API}/admin/popups/${deleting.id}`, { method: 'DELETE', headers: { ...authorization(), 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmDelete: true }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || '삭제에 실패했습니다.'); setDeleting(null); await load(); } catch (e) { setError(e instanceof Error ? e.message : '삭제에 실패했습니다.'); } finally { setBusy(false); }
  };
  const status = (row: Popup) => !row.is_active ? '사용 중지' : Date.now() < Date.parse(row.starts_at) ? '게시 예정' : Date.now() >= Date.parse(row.ends_at) ? '게시 종료' : '게시 중';
  return <Box sx={{ p: 3 }}>
    <Stack direction="row" justifyContent="space-between" mb={2}><Typography fontSize={20} fontWeight={900}>팝업 관리</Typography><Button variant="contained" onClick={() => show(null)}>팝업 생성</Button></Stack>
    {error && !open && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <TableContainer><Table size="small"><TableHead><TableRow>{['팝업 이름 / 이미지', '링크', '게시 기간', '상태 / 사용', '관리'].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map(row => <TableRow key={row.id}>
      <TableCell><Stack gap={1}><Typography>{row.name}</Typography><Box component="img" src={popupImage(row)} alt={row.name} sx={{ width: 100, height: 70, objectFit: 'contain' }} /></Stack></TableCell>
      <TableCell sx={{ maxWidth: 260, overflowWrap: 'anywhere' }}><a href={row.link_url} target="_blank" rel="noopener noreferrer">{row.link_url}</a></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}>{date(row.starts_at)} ~ {date(new Date(Date.parse(row.ends_at) - 1).toISOString())}</TableCell><TableCell><Chip size="small" color={status(row) === '게시 중' ? 'success' : 'default'} label={status(row)} /><Typography variant="caption" display="block">{row.is_active ? '사용' : '미사용'}</Typography></TableCell><TableCell sx={{ whiteSpace: 'nowrap' }}><Button onClick={() => show(row)}>수정</Button><Button color="error" onClick={() => setDeleting(row)}>삭제</Button></TableCell>
    </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} align="center">등록된 팝업이 없습니다.</TableCell></TableRow>}</TableBody></Table></TableContainer>
    <Dialog open={open} onClose={() => { if (!busy) setOpen(false); }} fullWidth maxWidth="sm"><DialogTitle>{editing ? '팝업 수정' : '팝업 생성'}</DialogTitle><DialogContent><Stack gap={2} mt={1}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="팝업 이름" value={form.name} inputProps={{ maxLength: 200 }} onChange={event => setForm({ ...form, name: event.target.value })} />
      <Button component="label" variant="outlined">이미지 업로드<input hidden type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={event => { const selected = event.target.files?.[0]; if (!selected) return; if (selected.size > 3 * 1024 * 1024 || !['image/png','image/jpeg','image/gif','image/webp'].includes(selected.type)) { setError('PNG/JPG/GIF/WebP 이미지를 3MB 이하로 선택해 주세요.'); return; } setError(''); setFile(selected); }} /></Button>
      <Typography variant="caption">PNG/JPG/GIF/WebP · 최대 3MB{file ? ` · ${file.name}` : ''}</Typography>
      {(preview || editing) && <Box component="img" src={preview || popupImage(editing!)} alt="팝업 이미지 미리보기" sx={{ maxWidth: '100%', maxHeight: 240, objectFit: 'contain' }} />}
      <TextField label="이동 링크" placeholder="https://" value={form.linkUrl} onChange={event => setForm({ ...form, linkUrl: event.target.value })} />
      <Stack direction="row" gap={1}><TextField fullWidth type="date" label="게시 시작일" InputLabelProps={{ shrink: true }} value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /><TextField fullWidth type="date" label="게시 종료일" InputLabelProps={{ shrink: true }} value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></Stack>
      <Typography variant="caption">한국 시간 기준, 종료일 23:59까지 게시됩니다.</Typography><FormControlLabel label="팝업 사용" control={<Switch checked={form.isActive} onChange={event => setForm({ ...form, isActive: event.target.checked })} />} />
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>취소</Button><Button disabled={busy} variant="contained" onClick={() => void save()}>저장</Button></DialogActions></Dialog>
    <Dialog open={!!deleting} onClose={() => { if (!busy) setDeleting(null); }}><DialogTitle>팝업 삭제</DialogTitle><DialogContent>‘{deleting?.name}’의 이미지, 링크, 게시 기간 및 사용 설정이 영구 삭제되며 더 이상 표시되지 않습니다.</DialogContent><DialogActions><Button disabled={busy} onClick={() => setDeleting(null)}>취소</Button><Button disabled={busy} color="error" onClick={() => void remove()}>삭제</Button></DialogActions></Dialog>
  </Box>;
}
