import { useEffect, useState } from 'react';
import { Box, Button, Dialog, Stack } from '@mui/material';

const API = import.meta.env.VITE_API_BASE_URL ?? '/api';
export type Popup = { id: number; name: string; link_url: string; starts_at: string; ends_at: string; is_active: boolean; updated_at: string };
export const popupImage = (row: Popup) => `${API}/popups/${row.id}/image?v=${encodeURIComponent(row.updated_at)}`;
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export default function LeaguePopup() {
  const [rows, setRows] = useState<Popup[]>([]);
  const [closed, setClosed] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('league-popup-dismissed') === 'true'; } catch { return false; }
  });
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
  let hiddenToday = false;
  try { hiddenToday = localStorage.getItem('league-popup-hidden-day') === today(); } catch { /* storage may be unavailable */ }
  if (!row || dismissed || hiddenToday) return null;
  const dismiss = (day: boolean) => {
    if (day) {
      try { localStorage.setItem('league-popup-hidden-day', today()); } catch { /* still close for this visit */ }
    } else {
      try { sessionStorage.setItem('league-popup-dismissed', 'true'); } catch { /* still close until unmounted */ }
    }
    setDismissed(true);
  };
  return <Dialog open aria-label={row.name} onClose={() => dismiss(false)} maxWidth={false}
    sx={{ zIndex: 1400, '& .MuiDialog-container': { alignItems: 'flex-end' } }}
    slotProps={{
      backdrop: { sx: { bgcolor: 'rgba(0, 0, 0, 0.35)' } },
      paper: { sx: { m: 0, width: '100%', maxWidth: 430, maxHeight: '90dvh', borderRadius: '22px 22px 0 0', overflow: 'auto', bgcolor: '#fff' } },
    }}>
    <Box component="a" href={row.link_url} sx={{ display: 'block', lineHeight: 0 }}><Box component="img" src={popupImage(row)} alt={row.name} onError={() => setClosed(previous => [...previous, row.id])} sx={{ width: '100%', maxHeight: 'calc(90dvh - 72px - env(safe-area-inset-bottom))', objectFit: 'contain', display: 'block' }} /></Box>
    <Stack direction="row" sx={{ bgcolor: '#fff', minHeight: 56, pb: 'env(safe-area-inset-bottom)', flexShrink: 0 }}>
      <Button onClick={() => dismiss(true)} sx={{ flex: 1, minHeight: 56, borderRadius: 0, color: '#8b9098', fontSize: 12, fontWeight: 400 }}>오늘 하루 보지 않기</Button>
      <Button onClick={() => dismiss(false)} sx={{ flex: 1, minHeight: 56, borderRadius: 0, color: '#111', fontSize: 14, fontWeight: 700 }}>닫기</Button>
    </Stack>
  </Dialog>;
}
