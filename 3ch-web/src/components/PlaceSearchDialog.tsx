import { useEffect, useState } from "react";
import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { useLazySearchLeagueVenuesQuery, type LeagueVenuePlace } from "../features/group/groupApi";

type Props = {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSelect: (place: LeagueVenuePlace) => void;
  allowDirectInput?: boolean;
  onDirectInput?: (query: string) => void;
};

export default function PlaceSearchDialog({ open, initialQuery = "", onClose, onSelect, allowDirectInput = false, onDirectInput }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [searched, setSearched] = useState(false);
  const [search, { data, isFetching, isError, reset }] = useLazySearchLeagueVenuesQuery();

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setSearched(false);
    reset();
    const trimmed = initialQuery.trim();
    if (trimmed.length >= 2) {
      setSearched(true);
      void search(trimmed);
    }
  }, [initialQuery, open, reset, search]);

  const runSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    setSearched(true);
    void search(trimmed);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>장소·주소 검색</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} sx={{ mt: 0.5, mb: 2 }}>
          <TextField fullWidth size="small" autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setSearched(false); }} onKeyDown={(event) => { if (event.key === "Enter") runSearch(); }} placeholder="장소명 또는 도로명 주소" />
          <Button variant="contained" disabled={query.trim().length < 2 || isFetching} onClick={runSearch}>{isFetching ? <CircularProgress size={18} color="inherit" /> : "검색"}</Button>
        </Stack>
        <Stack spacing={1}>
          {!isFetching && (data?.places ?? []).map((place) => (
            <Button key={`${place.source ?? "place"}-${place.id}`} variant="outlined" onClick={() => onSelect(place)} sx={{ display: "block", textAlign: "left", px: 1.5, py: 1.1, color: "text.primary" }}>
              <Typography fontWeight={900} fontSize={14}>{place.name}</Typography>
              <Typography fontSize={11.5} color="text.secondary">{place.address}</Typography>
            </Button>
          ))}
          {!isFetching && searched && (isError || !data || data.places.length === 0) && (
            <Stack spacing={1.5} sx={{ py: 2 }}>
              <Typography textAlign="center" color="text.secondary" sx={{ py: 1 }}>{isError ? "장소 검색에 연결하지 못했습니다." : "검색 결과가 없습니다."}</Typography>
              {allowDirectInput && onDirectInput && <Button fullWidth variant="outlined" onClick={() => onDirectInput(query.trim())} disabled={!query.trim()} sx={{ bgcolor: "#fff", borderColor: "#2F80ED", color: "#2F80ED", fontWeight: 900 }}>직접 입력</Button>}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>닫기</Button></DialogActions>
    </Dialog>
  );
}
