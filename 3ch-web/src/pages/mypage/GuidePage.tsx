import { useEffect, useState } from "react";
import { Box, IconButton, Stack, Typography, Button, CircularProgress } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

const SECTIONS: Record<string, string[]> = {
  leader: ["클럽 생성", "회원 관리", "리그 생성", "리그 진행", "추첨 생성", "추첨 진행"],
  member: ["클럽 가입", "리그 참가", "결과 입력", "추첨 확인"],
};

type Guide = { id: number; tab: string; section: string; content: string };

export default function GuidePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"leader" | "member">("leader");
  const [section, setSection] = useState(SECTIONS.leader[0]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/guides?tab=${tab}`).then((r) => {
      if (!cancelled) {
        setGuides(r.data.guides ?? []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [tab]);

  const handleTabChange = (t: "leader" | "member") => {
    setLoading(true);
    setTab(t);
    setSection(SECTIONS[t][0]);
  };

  const current = guides.find((g) => g.section === section);
  const sections = SECTIONS[tab];

  return (
    <Stack spacing={2} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>이용방법</Typography>
      </Stack>

      {/* 탭 */}
      <Stack direction="row" spacing={1}>
        <Button fullWidth variant={tab === "leader" ? "contained" : "outlined"} disableElevation
          onClick={() => handleTabChange("leader")} startIcon={<ManageAccountsOutlinedIcon />}
          sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 13,
            ...(tab === "leader" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }) }}>
          리더 / 운영진
        </Button>
        <Button fullWidth variant={tab === "member" ? "contained" : "outlined"} disableElevation
          onClick={() => handleTabChange("member")} startIcon={<PersonOutlineIcon />}
          sx={{ borderRadius: 1.5, fontWeight: 700, fontSize: 13,
            ...(tab === "member" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }) }}>
          일반 회원
        </Button>
      </Stack>

      {/* 안내 배너 */}
      <Box sx={{ bgcolor: tab === "leader" ? "#F0FDF4" : "#EFF6FF", borderRadius: 1.5, px: 2, py: 1.5 }}>
        <Typography fontSize={13} color={tab === "leader" ? "#065F46" : "#1D4ED8"} fontWeight={600} lineHeight={1.7} sx={{ whiteSpace: "pre-line" }}>
          {tab === "leader"
            ? "클럽 리더 / 운영진을 위한 이용방법 안내입니다.\n클럽 생성부터 추첨 진행까지 확인해보세요."
            : "일반 회원을 위한 이용방법 안내입니다.\n클럽 가입부터 추첨 확인 방법을 확인해보세요."}
        </Typography>
      </Box>

      {/* 섹션 버튼 */}
      <Stack direction="row" spacing={0.8} sx={{ flexWrap: "wrap", gap: 0.8 }}>
        {sections.map((s) => (
          <Button key={s} size="small" variant={section === s ? "contained" : "outlined"} disableElevation
            onClick={() => setSection(s)}
            sx={{ borderRadius: 5, fontWeight: 700, fontSize: 12, px: 1.5,
              ...(section === s
                ? { bgcolor: "#111827", "&:hover": { bgcolor: "#374151" } }
                : { borderColor: "#E5E7EB", color: "text.secondary" }) }}>
            {s}
          </Button>
        ))}
      </Stack>

      {/* 콘텐츠 */}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : current ? (
        <Box
          dangerouslySetInnerHTML={{ __html: current.content }}
          sx={{ "& img": { maxWidth: "100%", borderRadius: 1.5 }, lineHeight: 1.8 }}
        />
      ) : (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography fontSize={14} color="text.secondary">아직 등록된 내용이 없습니다.</Typography>
        </Box>
      )}
    </Stack>
  );
}
