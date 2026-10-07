import { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack } from '@mui/material';

const API = import.meta.env.VITE_API_BASE_URL ?? '/api';
export type Popup = { id: number; name: string; link_url: string; starts_at: string; ends_at: string; is_active: boolean; updated_at: string };
export const popupImage = (row: Popup) => `${API}/popups/${row.id}/image?v=${encodeURIComponent(row.updated_at)}`;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export default function LeaguePopup() {
  const [rows, setRows] = useState<Popup[]>([]);
  const [closed, setClosed] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { setNow(Date.now()); fetch(`${API}/popups`, { signal: controller.signal }).then(async response => { if (response.ok) setRows((await response.json()).popups ?? []); }).catch(() => {}); };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
  const row = rows.find(item => {
    let hidden = false;
    try { hidden = localStorage.getItem(`league-popup-hidden:${item.id}`) === today(); } catch { /* storage may be unavailable */ }
    return item.is_active && Date.parse(item.starts_at) <= now && now < Date.parse(item.ends_at) && !hidden && !closed.includes(item.id);
  });
  if (!row) return null;
  const dismiss = (day: boolean) => {
    if (day) { try { localStorage.setItem(`league-popup-hidden:${row.id}`, today()); } catch { /* still close for this visit */ } }
    setClosed(previous => [...previous, row.id]);
  };
  return <Paper role="dialog" aria-label={row.name} elevation={12} sx={{ position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: 'min(400px, calc(100vw - 32px))', zIndex: 1400, overflow: 'hidden', borderRadius: 2 }}>
    <Box component="a" href={row.link_url} sx={{ display: 'block', lineHeight: 0 }}><Box component="img" src={popupImage(row)} alt={row.name} onError={() => dismiss(false)} sx={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', display: 'block' }} /></Box>
    <Stack direction="row" justifyContent="space-between" sx={{ bgcolor: 'background.paper', px: 1 }}><Button color="inherit" onClick={() => dismiss(true)}>오늘 하루 보지 않기</Button><Button color="inherit" onClick={() => dismiss(false)}>닫기</Button></Stack>
  </Paper>;
}
