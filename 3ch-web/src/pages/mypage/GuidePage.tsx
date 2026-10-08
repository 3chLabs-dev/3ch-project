import { useEffect, useState } from "react";
import { Box, IconButton, Stack, Typography, Button, CircularProgress } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { sanitizeGuideHtml } from "../../utils/sanitizeHtml";
import Seo from "../../components/Seo";
import { NoIndex } from "../../components/SearchVisibility";
import NotFoundPage from "../util/NotFoundPage";

const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Guide = { id: number; tab: string; section: string; content: string };

export default function GuidePage() {
  const navigate = useNavigate();
  const { guideId } = useParams();
  const [tab, setTab] = useState<"leader" | "member">("leader");
  const [section, setSection] = useState("");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    axios.get(`${API}/guides`).then((r) => {
      if (!cancelled) {
        const nextGuides: Guide[] = r.data.guides ?? [];
        setGuides(nextGuides);
        const selected = nextGuides.find((g) => String(g.id) === guideId);
        if (selected) {
          setTab(selected.tab as "leader" | "member");
          setSection(selected.section);
        } else {
          setSection(nextGuides.find((g) => g.tab === tab)?.section ?? "");
        }
        setLoading(false);
      }
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [guideId, tab]);

  const handleTabChange = (t: "leader" | "member") => {
    if (t === tab && !guideId) return;
    setLoading(true);
    navigate("/mypage/guide");
    setTab(t);
    setSection("");
  };

  const current = guides.find((g) => g.tab === tab && g.section === section);
  const sections = guides.filter((g) => g.tab === tab);

  if (guideId && !loading && !guides.some((g) => String(g.id) === guideId)) {
    return <><NoIndex /><NotFoundPage /></>;
  }

    return (
        <Stack spacing={2} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
      <Seo title={guideId && current ? `${current.section} 이용방법` : "이용방법"} description="우리리그에서 클럽을 만들고 회원을 관리하며 리그와 추첨을 운영하는 방법을 확인하세요." path={guideId ? `/mypage/guide/${guideId}` : "/mypage/guide"} />
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate("/mypage")} size="small">
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
          <Button key={s.id} component={Link} to={`/mypage/guide/${s.id}`} size="small" variant={section === s.section ? "contained" : "outlined"} disableElevation
            sx={{ borderRadius: 5, fontWeight: 700, fontSize: 12, px: 1.5,
              ...(section === s.section
                ? { bgcolor: "#111827", "&:hover": { bgcolor: "#374151" } }
                : { borderColor: "#E5E7EB", color: "text.secondary" }) }}>
            {s.section}
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
          data-guide-id={current.id}
          dangerouslySetInnerHTML={{ __html: sanitizeGuideHtml(current.content) }}
          sx={{
            "& img": {
              display: "block",
              maxWidth: "100%",
              height: "auto",
              objectFit: "contain",
              objectPosition: "left top",
            },
            "& .youtube-player": {
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              my: 2,
              overflow: "hidden",
              borderRadius: 1.5,
              bgcolor: "#000",
            },
            "& .youtube-player iframe": { width: "100%", height: "100%", border: 0 },
            lineHeight: 1.8,
          }}
        />
      ) : (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography fontSize={14} color="text.secondary">아직 등록된 내용이 없습니다.</Typography>
        </Box>
      )}
    </Stack>
  );
}
