import { useCallback, useEffect, useState } from "react";
import {
  Box, Typography, IconButton, Stack, Button, Tabs, Tab, Divider, Chip,
  Alert, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField,
} from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CheckIcon from "@mui/icons-material/Check";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";

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
      "클럽 생성 1회",
      "클럽 가입 무제한",
      "리그 생성 1회",
      "리그·대회 참가 무제한",
      "추첨 생성 1회",
      "추첨 결과 확인 무제한",
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
      "클럽 생성 무제한",
      "리그 생성 월 3회",
        "클럽회원·참가자·대진표 사진 인식 월 3회",
      "추첨 생성 월 3회",
    ],
    inheritFrom: "STARTER 혜택",
    buttonLabel: "요금제 구매하기",
    buttonDisabled: false,
    buttonColor: "#10B981",
    buttonTextColor: "#fff",
    cardBg: "#ECFDF5",
    borderColor: "#A7F3D0",
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
      "리그 생성 무제한",
        "클럽회원·참가자·대진표 사진 인식 월 20회",
      "추첨 생성 무제한",
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
    badge: "베스트",
    badgeColor: "#A855F7",
    price: "19,900",
    originalPrice: "24,900",
    features: [
      "대회 생성 무제한",
        "클럽회원·참가자·대진표 사진 인식 월 500회",
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
type PlanCardData = {
  id: string;
  name: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  badge: string | null;
  badgeColor: string | null;
  price: string | null;
  originalPrice: string | null;
  features: string[];
  inheritFrom: string | null;
  buttonLabel: string;
  buttonDisabled: boolean;
  buttonColor: string;
  buttonTextColor: string;
  cardBg: string;
  borderColor: string;
};

function PlanCard({ plan, onBuy }: { plan: PlanCardData; onBuy?: () => void }) {
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
      <Typography fontSize={13} fontWeight={700} color="#6B7280" sx={{ mb: 1.2 }}>
        이용 가능한 기능
      </Typography>

      <Stack spacing={0.75} sx={{ mb: 2.5 }}>
        {plan.features.map((f) => (
          <Stack key={f} direction="row" alignItems="center" spacing={0.8}>
            <CheckIcon sx={{ fontSize: 15, color: "#10B981" }} />
            <Typography fontSize={14} fontWeight={700} color="#374151">{f}</Typography>
          </Stack>
        ))}
      </Stack>

      {/* 버튼 */}
      <Button
        fullWidth
        variant="contained"
        disableElevation
        disabled={plan.buttonDisabled}
        onClick={onBuy}
        sx={{
          borderRadius: 1.5,
          height: 44,
          fontWeight: 800,
          fontSize: 14,
          bgcolor: plan.buttonColor,
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

type PublicPricingPlan = {
  code: string; name: string; badge_text: string | null; price: number;
  original_price: number | null; features: string[];
  feature_limits?: Record<string, number | null>;
};
type PurchaseHistory = {
  id: number | string;
  plan: string;
  purchase_type?: "SUBSCRIPTION" | "TOKEN";
  product_name?: string;
  credits?: Record<string, number>;
  order_id: string;
  amount: number;
  status: string;
  started_at: string;
  expires_at: string;
  is_recurring: boolean;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  card_company: string | null;
  card_number: string | null;
};
type TokenPackage = {
  id: number;
  code: string;
  name: string;
  price: number;
  credits: Record<string, number>;
};
type CouponHistory = { name:string; type:string; value:number; expires_at:string; status:string; benefit:Record<string,unknown>; redeemed_at:string };
const API = import.meta.env.VITE_API_BASE_URL ?? "/api";
const PLAN_NAMES: Record<string, string> = {
  starter: "STARTER",
  basic: "BASIC",
  pro: "PRO",
  premium: "PREMIUM",
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const FEATURE_LABELS: Array<[string, string]> = [
  ["club_create", "클럽 생성"],
  ["club_join", "클럽 가입"],
  ["league_create", "리그 생성"],
  ["tournament_create", "대회 생성"],
  ["event_join", "리그·대회 참가"],
  ["vision_scan", "클럽회원·참가자·대진표 사진 인식"],
  ["draw_create", "추첨 생성"],
];
const featureLimitLabels = (limits?: Record<string, number | null>) =>
  limits && Object.keys(limits).length > 0
    ? FEATURE_LABELS.flatMap(([key, label]) => {
        const limit = limits[key];
        if (limit === null) return [`${label} 무제한`];
        if (Number(limit ?? 0) === 0) return [];
        return [`${label} 월 ${limit}회`];
      })
    : [];
const normalizeFeatureLabel = (label: string) =>
  label.replace(
    /(?:클럽회원·)?(?:참가자·)*대진표 사진 인식/,
    "클럽회원·참가자·대진표 사진 인식",
  );

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────
export default function PricingPage() {
  const navigate = useNavigate();
  const token = useSelector((state: RootState) => state.auth.token);
  const [tab, setTab] = useState(0);
  const [testNoticeOpen, setTestNoticeOpen] = useState(true);
  const [managedPlans, setManagedPlans] = useState<PublicPricingPlan[]>([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null | undefined>(undefined);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<PurchaseHistory | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{type:"success"|"error";text:string}|null>(null);
  const [coupons, setCoupons] = useState<CouponHistory[]>([]);
  const loadCoupons = useCallback(async () => {
    const resolvedToken = token ?? localStorage.getItem("token"); if (!resolvedToken) return setCoupons([]);
    const response = await fetch(`${API}/coupons/me`, { headers:{Authorization:`Bearer ${resolvedToken}`} });
    if (response.ok) setCoupons((await response.json()).coupons ?? []);
  }, [token]);
  useEffect(() => { void loadCoupons(); }, [loadCoupons]);
  const redeemCoupon = async () => {
    const resolvedToken = token ?? localStorage.getItem("token");
    if (!resolvedToken) { navigate("/login"); return; }
    setCouponLoading(true); setCouponMessage(null);
    try { const response=await fetch(`${API}/coupons/redeem`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${resolvedToken}`},body:JSON.stringify({code:couponCode})}); const data=await response.json(); if(!response.ok) throw new Error(data.message||"쿠폰을 등록할 수 없습니다."); const isDiscount=data.coupon.type==="PERCENT_DISCOUNT"; setCouponMessage({type:"success",text:isDiscount?`${data.coupon.name} 쿠폰이 등록되었습니다. 구독 결제 화면에서 적용해 주세요.`:`${data.coupon.name} 혜택이 즉시 지급되었습니다.`}); setCouponCode(""); await loadCoupons(); loadPurchaseHistory(); }
    catch(error){setCouponMessage({type:"error",text:error instanceof Error?error.message:"쿠폰을 사용할 수 없습니다."});} finally{setCouponLoading(false);}
  };
  useEffect(() => {
    fetch(`${API}/payment/plans`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setManagedPlans(data.plans ?? []))
      .catch(() => setManagedPlans([]));
  }, []);
  useEffect(() => {
    fetch(`${API}/payment/token-packages`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setTokenPackages(data.packages ?? []))
      .catch(() => setTokenPackages([]));
  }, []);
  useEffect(() => {
    if (window.location.hash !== "#token-packages" || tokenPackages.length === 0) return;
    setTab(1);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("token-packages")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [tokenPackages.length]);
  useEffect(() => {
    const resolvedToken = token ?? localStorage.getItem("token");
    if (!resolvedToken) {
      setCurrentPlan(null);
      return;
    }

    fetch(`${API}/payment/subscriptions/me`, {
      headers: { Authorization: `Bearer ${resolvedToken}` },
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCurrentPlan(data.subscription?.plan ?? null))
      .catch(() => setCurrentPlan(null));
  }, [token]);

  const loadPurchaseHistory = useCallback(() => {
    const resolvedToken = token ?? localStorage.getItem("token");
    if (!resolvedToken) {
      setPurchases([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    fetch(`${API}/payment/history/me`, {
      headers: { Authorization: `Bearer ${resolvedToken}` },
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPurchases(data.purchases ?? []))
      .catch(() => setPurchases([]))
      .finally(() => setHistoryLoading(false));
  }, [token]);

  useEffect(() => {
    loadPurchaseHistory();
  }, [loadPurchaseHistory]);

  const handleCancelSubscription = async () => {
    const resolvedToken = token ?? localStorage.getItem("token");
    if (!resolvedToken || !cancelTarget) return;

    setCancelLoading(true);
    setCancelError("");
    try {
      const response = await fetch(`${API}/payment/billing/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${resolvedToken}` },
      });
      if (!response.ok) throw new Error("구독 취소 신청에 실패했습니다.");
      setCancelTarget(null);
      loadPurchaseHistory();
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "구독 취소 신청에 실패했습니다.");
    } finally {
      setCancelLoading(false);
    }
  };

  const activePlanId = currentPlan === null ? "starter" : currentPlan;
  const displayPlans = PLANS.map((plan) => {
    const managed = managedPlans.find((item) => item.code === plan.id);
    const managedFeatureLabels = featureLimitLabels(managed?.feature_limits);
    const displayedPlan = managed ? {
      ...plan,
      name: managed.name,
      badge: managed.badge_text,
      price: managed.price > 0 ? managed.price.toLocaleString("ko-KR") : null,
      originalPrice: managed.original_price == null ? null : managed.original_price.toLocaleString("ko-KR"),
      features: [...managedFeatureLabels, ...(managed.features ?? [])].length
        ? [...managedFeatureLabels, ...(managed.features ?? [])].map(normalizeFeatureLabel)
        : plan.features,
    } : plan;
    const isCurrent = currentPlan !== undefined && plan.id === activePlanId;

    return {
      ...displayedPlan,
      buttonLabel: isCurrent
        ? "사용중인 요금제"
        : plan.id === "starter"
          ? "무료 요금제"
          : "요금제 구매하기",
      buttonDisabled: isCurrent || plan.id === "starter",
      buttonColor: isCurrent || plan.id === "starter"
        ? "#E5E7EB"
        : displayedPlan.buttonColor,
      buttonTextColor: isCurrent || plan.id === "starter"
        ? "#9CA3AF"
        : displayedPlan.buttonTextColor,
    };
  }).filter((plan) => managedPlans.length === 0 || managedPlans.some((item) => item.code === plan.id));
  const handleBuy = (planId: string) => {
    navigate(`/payment/billing/checkout?plan=${planId}`);
  };
  const handleBuyTokens = (tokenPackage: TokenPackage) => {
    const params = new URLSearchParams({
      type: "token",
      packageId: String(tokenPackage.id),
      amount: String(tokenPackage.price),
      name: tokenPackage.name,
    });
    navigate(`/payment/checkout?${params.toString()}`);
  };

  return (
    <Stack sx={{ width: "100%", mx: "auto", mt: "-4px" }}>

      {/* 테스트 환경 안내 다이얼로그 */}
      <Dialog open={testNoticeOpen} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 3, textAlign: "center" }}>
          <ScienceOutlinedIcon sx={{ fontSize: 48, color: "#F59E0B", mb: 1 }} />
          <Typography fontWeight={900} fontSize={17} sx={{ mb: 1 }}>테스트 중인 환경입니다</Typography>
          <Typography fontSize={13} color="text.secondary" lineHeight={1.8} sx={{ mb: 3 }}>
            현재 요금제 결제 기능은 테스트 중입니다.<br />
            실제 금액이 청구되지 않으니 안심하고 이용하세요.
          </Typography>
          <Button
            fullWidth variant="contained" disableElevation
            onClick={() => setTestNoticeOpen(false)}
            sx={{ borderRadius: 1.5, fontWeight: 800, height: 44, bgcolor: "#111827", "&:hover": { bgcolor: "#374151" } }}
          >
            확인
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={couponOpen} onClose={()=>!couponLoading&&setCouponOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={900}>쿠폰 등록</DialogTitle>
        <DialogContent><Typography fontSize={13} color="text.secondary" sx={{mb:2}}>발급받은 쿠폰번호를 입력해 주세요.</Typography>{couponMessage&&<Alert severity={couponMessage.type} sx={{mb:2}}>{couponMessage.text}</Alert>}<TextField autoFocus fullWidth label="쿠폰번호" value={couponCode} onChange={e=>setCouponCode(e.target.value.toUpperCase())} placeholder="ABCD-EFGH-JKLM-NPQR"/></DialogContent>
        <DialogActions><Button onClick={()=>setCouponOpen(false)} disabled={couponLoading}>취소</Button><Button variant="contained" onClick={redeemCoupon} disabled={couponLoading||!couponCode.trim()}>{couponLoading?"확인 중":"등록"}</Button></DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(cancelTarget)}
        onClose={cancelLoading ? undefined : () => {
          setCancelTarget(null);
          setCancelError("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle fontWeight={900}>구독 취소</DialogTitle>
        <DialogContent>
          <Typography fontSize={14} lineHeight={1.7}>
            구독을 취소하시겠습니까?
          </Typography>
          {cancelTarget && (
            <Typography fontSize={13} color="text.secondary" sx={{ mt: 1 }}>
              {formatDate(cancelTarget.expires_at)}까지 현재 요금제를 이용할 수 있으며,
              종료일 다음날부터 STARTER 요금제로 전환됩니다.
            </Typography>
          )}
          {cancelError && <Alert severity="error" sx={{ mt: 2 }}>{cancelError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => {
              setCancelTarget(null);
              setCancelError("");
            }}
            disabled={cancelLoading}
            sx={{ color: "text.secondary", fontWeight: 800 }}
          >
            계속 이용
          </Button>
          <Button
            variant="contained"
            color="error"
            disableElevation
            onClick={handleCancelSubscription}
            disabled={cancelLoading}
            sx={{ fontWeight: 800 }}
          >
            {cancelLoading ? "처리 중" : "구독 취소"}
          </Button>
        </DialogActions>
      </Dialog>

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
        <Tab label="구독" />
        <Tab label="충전" />
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
            onClick={() => { setCouponMessage(null); setCouponOpen(true); }}
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
          {displayPlans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onBuy={plan.buttonDisabled ? undefined : () => handleBuy(plan.id)} />
          ))}

          {/* 유의사항 */}
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
            <Typography fontWeight={900} fontSize={14} sx={{ mb: 1.5 }}>유의사항</Typography>
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

      {/* 충전 탭 */}
      {tab === 1 && (
        <Box id="token-packages" sx={{ mb: 3, scrollMarginTop: 72 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <AccountBalanceWalletOutlinedIcon sx={{ color: "#7C3AED" }} />
            <Typography fontSize={18} fontWeight={900}>추가 사용량 충전</Typography>
          </Stack>
          <Typography fontSize={13} color="text.secondary" sx={{ mb: 1.5 }}>
            현재 이용 기간 동안 사용할 기능 횟수를 추가로 구매합니다.
          </Typography>
          <Stack spacing={1.25}>
            {tokenPackages.map((item) => (
              <Box key={item.id} sx={{ border: "1px solid #DDD6FE", bgcolor: "#FAF5FF", borderRadius: 2, p: 2 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography fontWeight={900}>{item.name}</Typography>
                    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 0.8 }}>
                      {FEATURE_LABELS.filter(([key]) => Number(item.credits?.[key] ?? 0) > 0).map(([key, label]) => (
                        <Typography key={key} fontSize={12} color="#6D28D9">
                          {label} {item.credits[key]}회
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  <Typography fontSize={17} fontWeight={900} whiteSpace="nowrap">
                    {Number(item.price).toLocaleString("ko-KR")}원
                  </Typography>
                </Stack>
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  onClick={() => handleBuyTokens(item)}
                  sx={{ mt: 1.5, height: 42, bgcolor: "#7C3AED", fontWeight: 800, "&:hover": { bgcolor: "#6D28D9" } }}
                >
                  충전하기
                </Button>
              </Box>
            ))}
            {tokenPackages.length === 0 && (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography fontSize={14} fontWeight={700} color="text.secondary">
                  구매할 수 있는 추가 사용량 상품이 없습니다.
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>
      )}

      {/* 구매내역 탭 */}
      {tab === 2 && (
        <Stack spacing={1.5} sx={{ pb: 3 }}>
          {historyLoading && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {!historyLoading && purchases.length === 0 && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography fontSize={14} fontWeight={700} color="text.secondary">
                구매내역이 없습니다.
              </Typography>
            </Box>
          )}
          {!historyLoading && purchases.map((purchase) => {
            const isTokenPurchase = purchase.purchase_type === "TOKEN";
            const isActive = (purchase.status === "ACTIVE" || purchase.status === "PAID") &&
              new Date(purchase.expires_at).getTime() > Date.now();
            const canCancel = !isTokenPurchase && isActive && purchase.is_recurring &&
              !purchase.cancel_at_period_end;

            return (
              <Box
                key={purchase.id}
                sx={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "#fff",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography fontWeight={900} fontSize={16}>
                      {isTokenPurchase
                        ? purchase.product_name ?? "추가 사용량 충전"
                        : PLAN_NAMES[purchase.plan] ?? purchase.plan.toUpperCase()}
                    </Typography>
                    <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.4 }}>
                      {formatDate(purchase.started_at)} 결제
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      px: 1,
                      py: 0.4,
                      borderRadius: 1,
                      bgcolor: purchase.cancel_at_period_end
                        ? "#FEF3C7"
                        : isActive ? "#ECFDF5" : "#F3F4F6",
                      color: purchase.cancel_at_period_end
                        ? "#B45309"
                        : isActive ? "#059669" : "#6B7280",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {isTokenPurchase
                      ? isActive ? "사용 가능" : "만료"
                      : purchase.cancel_at_period_end
                      ? "구독 종료 예정"
                      : isActive ? "이용 중" : "종료"}
                  </Box>
                </Stack>

                <Divider sx={{ my: 1.5 }} />
                <Stack spacing={0.7}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontSize={13} color="text.secondary">결제 금액</Typography>
                    <Typography fontSize={13} fontWeight={800}>
                      {Number(purchase.amount).toLocaleString("ko-KR")}원
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontSize={13} color="text.secondary">
                      {isTokenPurchase ? "사용 기한" : "이용 기간"}
                    </Typography>
                    <Typography fontSize={13} fontWeight={700}>
                      {formatDate(purchase.started_at)} ~ {formatDate(purchase.expires_at)}
                    </Typography>
                  </Stack>
                  {isTokenPurchase && Object.keys(purchase.credits ?? {}).length > 0 && (
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography fontSize={13} color="text.secondary">충전 내역</Typography>
                      <Typography fontSize={13} fontWeight={700} textAlign="right">
                        {FEATURE_LABELS
                          .filter(([key]) => Number(purchase.credits?.[key] ?? 0) > 0)
                          .map(([key, label]) => `${label} ${purchase.credits?.[key]}회`)
                          .join(", ")}
                      </Typography>
                    </Stack>
                  )}
                  {purchase.card_company && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography fontSize={13} color="text.secondary">결제 수단</Typography>
                      <Typography fontSize={13} fontWeight={700}>
                        {purchase.card_company} {purchase.card_number ?? ""}
                      </Typography>
                    </Stack>
                  )}
                </Stack>

                {purchase.cancel_at_period_end && isActive && (
                  <Alert severity="info" sx={{ mt: 1.5, fontSize: 12 }}>
                    {formatDate(purchase.expires_at)}까지 이용 후 자동으로 종료됩니다.
                  </Alert>
                )}
                {canCancel && (
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      setCancelError("");
                      setCancelTarget(purchase);
                    }}
                    sx={{ mt: 1.5, height: 40, fontWeight: 800 }}
                  >
                    구독 취소
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      {/* 쿠폰내역 탭 */}
      {tab === 3 && (
        <Box>
          <Stack spacing={1.5}>{coupons.map((coupon,index)=><Box key={`${coupon.redeemed_at}-${index}`} sx={{border:"1px solid #E5E7EB",borderRadius:2,p:2,textAlign:"left"}}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={900}>{coupon.name}</Typography><Typography fontSize={12} color="text.secondary">{new Date(coupon.redeemed_at).toLocaleDateString("ko-KR")} 등록 · {new Date(coupon.expires_at).toLocaleDateString("ko-KR")}까지</Typography></Box><Chip size="small" label={coupon.status==="AVAILABLE"?"다음 결제에 사용 가능":"적용 완료"} color={coupon.status==="AVAILABLE"?"primary":"success"}/></Stack></Box>)}</Stack>
          <Box sx={{ py: coupons.length ? 0 : 6, textAlign: "center", display: coupons.length ? "none" : "block" }}>
          <Typography fontSize={14} fontWeight={700} color="text.secondary">등록된 쿠폰이 없습니다.</Typography>
          </Box>
        </Box>
      )}
    </Stack>
  );
}
