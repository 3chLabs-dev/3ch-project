import { useState } from "react";
import {
  Box, Typography, IconButton, Stack, Button, Tabs, Tab, Divider,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";

// ─── 플랜 데이터 ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "starter",
    name: "STARTER",
    icon: "⭐",
    iconBg: "#F3F4F6",
    iconColor: "#6B7280",
    badge: null,
    badgeColor: null,
    price: null,
    originalPrice: null,
    features: [
      "클럽 생성",
      "클럽 가입",
      "리그·대회 1회 생성",
      "리그·대회 참가",
      "추첨 1회 생성",
      "추첨 결과 확인",
    ],
    inheritFrom: null,
    buttonLabel: "사용중인 요금제",
    buttonDisabled: true,
    buttonColor: "#E5E7EB",
    buttonTextColor: "#9CA3AF",
    cardBg: "#fff",
    borderColor: "#E5E7EB",
  },
  {
    id: "basic",
    name: "BASIC",
    icon: "⚡",
    iconBg: "#ECFDF5",
    iconColor: "#10B981",
    badge: "50% 할인",
    badgeColor: "#10B981",
    price: "4,900",
    originalPrice: "9,900",
    features: [
      "리그·대회 월 5회 생성",
      "추첨 월 5회 생성",
    ],
    inheritFrom: "STARTER 혜택",
    buttonLabel: "요금제 구매하기",
    buttonDisabled: false,
    buttonColor: "#10B981",
    buttonTextColor: "#fff",
    cardBg: "#fff",
    borderColor: "#E5E7EB",
  },
  {
    id: "pro",
    name: "PRO",
    icon: "🚀",
    iconBg: "#EFF6FF",
    iconColor: "#2F80ED",
    badge: "인기",
    badgeColor: "#2F80ED",
    price: "9,900",
    originalPrice: "14,900",
    features: [
      "리그·대회 무제한 생성",
      "추첨 무제한 생성",
    ],
    inheritFrom: "BASIC 혜택",
    buttonLabel: "요금제 구매하기",
    buttonDisabled: false,
    buttonColor: "#2F80ED",
    buttonTextColor: "#fff",
    cardBg: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  {
    id: "premium",
    name: "PREMIUM",
    icon: "👑",
    iconBg: "#FDF4FF",
    iconColor: "#A855F7",
    badge: "프리미엄",
    badgeColor: "#A855F7",
    price: "19,900",
    originalPrice: "24,900",
    features: [
      "리그·대회 참가비 결제 취합",
      "AI 추천 클럽 상단 배치",
    ],
    inheritFrom: "PRO 혜택",
    buttonLabel: "요금제 구매하기",
    buttonDisabled: false,
    buttonColor: "#EC4899",
    buttonTextColor: "#fff",
    cardBg: "#FDF4FF",
    borderColor: "#F0ABFC",
  },
];

const NOTICES = [
  "요금제를 구독하면 매월 자동결제됩니다.",
  "구매내역에서 언제든 구독 취소가 가능합니다.",
  "구독을 취소해도 만료일까지는 사용 가능하며, 만료일 다음날부터 사용이 종료됩니다.",
  "환불은 구독 신청 시작일까지만 가능하며, 시작 일 경과 후에는 환불이 불가합니다.",
  "위 정책은 임의로 변경될 수 있습니다.",
];

// ─── 플랜 카드 ────────────────────────────────────────────────────────────────
function PlanCard({ plan }: { plan: typeof PLANS[0] }) {
  return (
    <Box
      sx={{
        bgcolor: plan.cardBg,
        border: `1.5px solid ${plan.borderColor}`,
        borderRadius: 2,
        p: 2.5,
        mb: 2,
      }}
    >
      {/* 플랜 헤더 */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 1.5,
              bgcolor: plan.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}
          >
            {plan.icon}
          </Box>
          <Typography fontWeight={900} fontSize={16}>{plan.name}</Typography>
        </Stack>
        {plan.badge && (
          <Box
            sx={{
              bgcolor: plan.badgeColor + "18",
              color: plan.badgeColor,
              fontSize: 11,
              fontWeight: 800,
              px: 1,
              py: 0.4,
              borderRadius: 1,
            }}
          >
            {plan.badge}
          </Box>
        )}
      </Stack>

      {/* 가격 */}
      {plan.price ? (
        <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 2 }}>
          <Typography fontSize={12} fontWeight={700} color="text.secondary" sx={{ textDecoration: "line-through" }}>
            월 {plan.originalPrice}원
          </Typography>
          <Typography fontSize={22} fontWeight={900}>
            월 {plan.price}원
          </Typography>
        </Stack>
      ) : (
        <Typography fontSize={22} fontWeight={900} sx={{ mb: 2 }}>무료</Typography>
      )}

      {/* 기능 목록 */}
      <Typography fontSize={12} fontWeight={700} color="#6B7280" sx={{ mb: 1 }}>
        이용 가능한 기능
      </Typography>

      {plan.inheritFrom && (
        <>
          <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
            <CheckIcon sx={{ fontSize: 14, color: "#10B981" }} />
            <Typography fontSize={13} fontWeight={700} color="#374151">{plan.inheritFrom}</Typography>
          </Stack>
          <Stack alignItems="center" sx={{ my: 0.8 }}>
            <AddIcon sx={{ fontSize: 16, color: "#9CA3AF" }} />
          </Stack>
        </>
      )}

      <Stack spacing={0.5} sx={{ mb: 2.5 }}>
        {plan.features.map((f) => (
          <Stack key={f} direction="row" alignItems="center" spacing={0.8}>
            <CheckIcon sx={{ fontSize: 14, color: "#10B981" }} />
            <Typography fontSize={13} fontWeight={700} color="#374151">{f}</Typography>
          </Stack>
        ))}
      </Stack>

      {/* 버튼 */}
      <Button
        fullWidth
        variant="contained"
        disableElevation
        disabled={plan.buttonDisabled}
        sx={{
          borderRadius: 1.5,
          height: 44,
          fontWeight: 800,
          fontSize: 14,
          bgcolor: plan.buttonDisabled ? plan.buttonColor : plan.buttonColor,
          color: plan.buttonTextColor,
          "&:hover": { bgcolor: plan.buttonColor, filter: "brightness(0.95)" },
          "&.Mui-disabled": { bgcolor: plan.buttonColor, color: plan.buttonTextColor, opacity: 1 },
        }}
      >
        {plan.buttonLabel}
      </Button>
    </Box>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function PricingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);

  return (
    <Stack sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
      {/* 헤더 */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>요금제</Typography>
      </Stack>

      {/* 탭 */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2,
          "& .MuiTab-root": { fontWeight: 700, fontSize: 14, minWidth: 0, px: 2 },
          "& .MuiTabs-indicator": { bgcolor: "#111827" },
          "& .Mui-selected": { color: "#111827 !important" },
        }}
      >
        <Tab label="요금제" />
        <Tab label="구매내역" />
        <Tab label="쿠폰내역" />
      </Tabs>

      {/* 요금제 탭 */}
      {tab === 0 && (
        <>
          {/* 쿠폰 등록 버튼 */}
          <Button
            fullWidth
            variant="contained"
            disableElevation
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            sx={{
              mb: 2.5,
              borderRadius: 1.5,
              height: 44,
              fontWeight: 800,
              fontSize: 14,
              bgcolor: "#2F80ED",
              "&:hover": { bgcolor: "#256FD1" },
            }}
          >
            쿠폰 등록하기
          </Button>

          {/* 플랜 카드 목록 */}
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}

          {/* 안내사항 */}
          <Box
            sx={{
              bgcolor: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: 2,
              p: 2,
              mt: 1,
              mb: 3,
            }}
          >
            <Typography fontWeight={900} fontSize={14} sx={{ mb: 1.5 }}>안내사항</Typography>
            <Divider sx={{ mb: 1.5, borderColor: "#E5E7EB" }} />
            <Stack spacing={1}>
              {NOTICES.map((n, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                  <Typography fontSize={12} color="#6B7280" sx={{ mt: "1px", flexShrink: 0 }}>◆</Typography>
                  <Typography fontSize={12} color="#6B7280" fontWeight={600} lineHeight={1.6}>{n}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        </>
      )}

      {/* 구매내역 탭 */}
      {tab === 1 && (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography fontSize={14} fontWeight={700} color="text.secondary">구매내역이 없습니다.</Typography>
        </Box>
      )}

      {/* 쿠폰내역 탭 */}
      {tab === 2 && (
        <Box sx={{ py: 6, textAlign: "center" }}>
          <Typography fontSize={14} fontWeight={700} color="text.secondary">등록된 쿠폰이 없습니다.</Typography>
        </Box>
      )}
    </Stack>
  );
}
