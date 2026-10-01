import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const parseKeywords = (value: string) => [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];

export default function AdminSettlementMenuPage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = useMemo(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);
  const [alcohol, setAlcohol] = useState("");
  const [beverage, setBeverage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void (async () => {
    try {
      const response = await fetch(`${API}/admin/settlements/menu-settings`, { headers });
      const result = await response.json();
      if (!response.ok) throw new Error("자동 구분 단어를 불러오지 못했습니다.");
      setAlcohol((result.settings?.alcohol_keywords ?? []).join(", "));
      setBeverage((result.settings?.beverage_keywords ?? []).join(", "));
    } catch (cause) { setError((cause as Error).message); }
  })(); }, [headers]);

  const save = async () => {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API}/admin/settlements/menu-settings`, { method: "PUT", headers, body: JSON.stringify({ alcohol_keywords: parseKeywords(alcohol), beverage_keywords: parseKeywords(beverage) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error === "INVALID_KEYWORDS" ? "각 단어를 쉼표로 구분해 입력해 주세요." : "저장하지 못했습니다.");
      setAlcohol(result.settings.alcohol_keywords.join(", ")); setBeverage(result.settings.beverage_keywords.join(", ")); setMessage("자동 구분 단어를 저장했습니다.");
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  };

  return <Box sx={{ p: 3 }}><Typography variant="h6" fontWeight={900} mb={0.5}>메뉴 관리</Typography><Typography color="text.secondary" fontSize={13} mb={3}>영수증 메뉴명에 포함된 단어로 술과 음료를 자동 구분합니다. 어느 쪽에도 해당하지 않으면 음식으로 분류됩니다.</Typography><Stack spacing={2.5} maxWidth={820}>{error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}<TextField label="술 자동 구분 단어" multiline minRows={3} value={alcohol} onChange={(event) => setAlcohol(event.target.value)} helperText="쉼표(,)로 구분해 계속 입력할 수 있습니다." /><TextField label="음료 자동 구분 단어" multiline minRows={3} value={beverage} onChange={(event) => setBeverage(event.target.value)} helperText="쉼표(,)로 구분해 계속 입력할 수 있습니다." /><Button variant="contained" disabled={saving} onClick={() => void save()} sx={{ alignSelf: "flex-start", minWidth: 100, fontWeight: 800 }}>{saving ? "저장 중" : "저장"}</Button></Stack></Box>;
}
