import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, MenuItem, Pagination, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography,
} from "@mui/material";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Payment = {
  id: number;
  name: string;
  email: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  order_id?: string | null;
  amount?: number | null;
};

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("ko-KR") : "-";
const statusLabel = (status: string) => ({
  ACTIVE: "결제 완료",
  CANCELED: "취소",
  EXPIRED: "만료",
  PENDING: "결제 대기",
}[status] ?? status);

export default function AdminPaymentHistoryPage() {
  const token = localStorage.getItem("admin_token") ?? "";
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page), limit: "20", search: appliedSearch, status,
    });
    const response = await fetch(`${API}/admin/payments?${params}`, { headers });
    const data = await response.json();
    if (!response.ok) {
      setError("결제내역을 불러오지 못했습니다.");
      return;
    }
    setPayments(data.payments ?? []);
    setTotal(data.total ?? 0);
    setError("");
  }, [appliedSearch, headers, page, status]);

  useEffect(() => { void load(); }, [load]);

  const applySearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 2 }}>
        <Typography fontSize={18} fontWeight={900}>결제내역</Typography>
        <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.5 }}>
          회원별 요금제 결제 및 이용기간을 확인합니다.
        </Typography>
      </Box>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small" label="이름 또는 이메일" value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && applySearch()}
          sx={{ minWidth: 240 }}
        />
        <TextField
          select size="small" label="결제 상태" value={status}
          onChange={(event) => { setPage(1); setStatus(event.target.value); }}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">전체</MenuItem>
          <MenuItem value="ACTIVE">결제 완료</MenuItem>
          <MenuItem value="CANCELED">취소</MenuItem>
          <MenuItem value="EXPIRED">만료</MenuItem>
          <MenuItem value="PENDING">결제 대기</MenuItem>
        </TextField>
        <Button variant="outlined" onClick={applySearch}>검색</Button>
      </Stack>
      {error && <Typography color="error" fontSize={13} sx={{ mb: 1.5 }}>{error}</Typography>}
      <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#F9FAFB" }}>
              {["No.", "결제일시", "회원", "요금제", "결제금액", "상태", "이용기간", "주문번호"].map((label) => (
                <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map((payment, index) => (
              <TableRow key={payment.id} hover>
                <TableCell>{(page - 1) * 20 + index + 1}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{dateTime(payment.created_at)}</TableCell>
                <TableCell>
                  <Typography fontSize={13} fontWeight={800}>{payment.name}</Typography>
                  <Typography fontSize={11} color="text.secondary">{payment.email}</Typography>
                </TableCell>
                <TableCell>{payment.plan}</TableCell>
                <TableCell>{payment.amount == null ? "-" : `${Number(payment.amount).toLocaleString("ko-KR")}원`}</TableCell>
                <TableCell>{statusLabel(payment.status)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {dateTime(payment.starts_at)} ~ {dateTime(payment.expires_at)}
                </TableCell>
                <TableCell>{payment.order_id ?? "-"}</TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                  결제내역이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Stack alignItems="center" sx={{ mt: 2 }}>
        <Pagination
          page={page} count={Math.max(1, Math.ceil(total / 20))}
          onChange={(_, value) => setPage(value)} size="small"
        />
      </Stack>
    </Box>
  );
}
