import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import EastIcon from "@mui/icons-material/East";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import SportsScoreOutlinedIcon from "@mui/icons-material/SportsScoreOutlined";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import { Link as RouterLink } from "react-router-dom";

const sections = [
  { label: "리그 운영", href: "#league" },
  { label: "클럽 추천", href: "#club-recommend" },
  { label: "OMR 기능", href: "#omr" },
  { label: "랭킹·알림", href: "#ranking" },
  { label: "추첨", href: "#draw" },
];

const leagueCards = [
  { title: "리그 생성", body: "단식, OMR, 단일리그+토너먼트, 상·하위 토너먼트 같은 형식을 선택해 빠르게 개설할 수 있습니다." },
  { title: "참가 관리", body: "참가 신청, 참가자 명단, 부수 정렬, 현장 운영 상태를 한 흐름으로 이어서 관리합니다." },
  { title: "경기 운영", body: "경기순서, 대진표, 결과 입력을 실제 운영 순서에 맞춰 자연스럽게 연결합니다." },
];

const tournamentCards = [
  { title: "단일리그 + 토너먼트", body: "예선 리그를 진행한 뒤 본선 토너먼트로 이어지는 혼합형 운영도 지원합니다." },
  { title: "상·하위 토너먼트", body: "예선 결과를 기준으로 상위부와 하위부 대진을 나눠 현장 운영에 맞게 확장할 수 있습니다." },
  { title: "대진표 시각화", body: "토너먼트 라운드별 흐름을 시각적으로 확인하고 경기 진행 현황까지 함께 볼 수 있습니다." },
];

const recommendCards = [
  { title: "내 위치 기반 추천", body: "브라우저 위치 권한을 통해 현재 위치를 기준으로 주변 클럽을 추천받을 수 있습니다." },
  { title: "지역 중심 탐색", body: "내 클럽 또는 검색 지역을 기준으로 가까운 클럽을 우선 탐색하는 흐름을 제공합니다." },
  { title: "AI 추천 클럽", body: "종목과 위치를 함께 고려해 사용자가 바로 둘러볼 수 있는 클럽 후보를 제안합니다." },
];

const omrCards = [
  { title: "4인 OMR 리그", body: "정확히 4명이 참가하는 리그에서 OMR 대진표와 점수 인식 흐름을 사용할 수 있습니다." },
  { title: "이미지 분석 반영", body: "OMR 스캔 결과를 점수로 읽어들여 경기 기록에 반영하는 운영 흐름을 제공합니다." },
  { title: "현장 운영 단축", body: "기록 입력 시간을 줄이고 종이 대진표 운영과 모바일 기록을 자연스럽게 연결합니다." },
];

const rankingCards = [
  { title: "클럽 랭킹", body: "클럽 내부 포인트 랭킹과 전적 흐름을 멤버별로 확인할 수 있습니다." },
  { title: "종목 랭킹", body: "종목 단위 랭킹 허브에서 상위 순위와 내 순위를 함께 확인할 수 있습니다." },
  { title: "경기 알림", body: "브라우저 푸시 알림으로 경기 시작 시점이나 진행 상황을 확인할 수 있습니다." },
];

const drawCards = [
  { title: "추첨 회차 저장", body: "리그별 추첨을 회차 단위로 저장하고, 진행 전/후 상태를 구분해 관리할 수 있습니다." },
  { title: "당첨 결과 공개", body: "상품별 당첨자와 부수를 카드형으로 정리해 결과를 확인하기 쉽게 제공합니다." },
  { title: "재추첨 지원", body: "현장 진행 중에도 개별 상품 재추첨과 결과 저장 흐름을 이어서 사용할 수 있습니다." },
];

const flowSteps = [
  "클럽을 만들고 멤버를 등록합니다.",
  "리그 형식을 선택하고 참가자를 모집합니다.",
  "경기순서, 대진표, OMR 또는 결과 입력으로 경기를 운영합니다.",
  "랭킹 반영, 알림, 추첨 결과 공개까지 이어집니다.",
];

const matchItems = [
  { order: "1경기", matchup: "김민수 vs 이도윤", court: "1번 코트", status: "진행 중" },
  { order: "2경기", matchup: "박서준 vs 최하린", court: "2번 코트", status: "대기" },
  { order: "3경기", matchup: "정지우 vs 한유진", court: "3번 코트", status: "예정" },
];

const omrChecklist = [
  "4인 참가자 조건 확인",
  "OMR 마킹지 촬영 또는 업로드",
  "점수 인식 결과 검토",
  "경기 결과 자동 반영",
];

const drawWinners = [
  { prize: "라켓", winner: "김민수", division: "1부" },
  { prize: "러버 교환권", winner: "최하린", division: "2부" },
  { prize: "음료 쿠폰", winner: "한유진", division: "3부" },
];

const sectionAnchorSx = {
  scrollMarginTop: { xs: "88px", md: "96px" },
};

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#2563EB", letterSpacing: "0.08em" }}>
        {eyebrow}
      </Typography>
      <Typography sx={{ fontSize: { xs: 28, md: 40 }, lineHeight: 1.1, fontWeight: 900, color: "#111827" }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 16, lineHeight: 1.75, color: "#6B7280", maxWidth: 820 }}>
        {description}
      </Typography>
    </Stack>
  );
}

function FeatureGrid({
  items,
  icon,
}: {
  items: Array<{ title: string; body: string }>;
  icon: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      {items.map((item) => (
        <Card key={item.title} elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", border: "1px solid #E5E7EB" }}>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Stack spacing={1.6}>
              <Box sx={{ width: 42, height: 42, borderRadius: 1, bgcolor: "#DBEAFE", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {icon}
              </Box>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: "#111827" }}>{item.title}</Typography>
              <Typography sx={{ fontSize: 14, lineHeight: 1.7, color: "#6B7280" }}>{item.body}</Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

export default function DemoLandingPage() {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#F9FAFB" }}>
      <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "rgba(255,255,255,0.94)", backdropFilter: "blur(10px)", borderBottom: "1px solid #E5E7EB" }}>
        <Box sx={{ width: "min(1120px, calc(100% - 32px))", mx: "auto", py: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>우리리그</Typography>
          <Stack direction="row" spacing={0.25} sx={{ display: { xs: "none", md: "flex" } }}>
            {sections.map((section) => (
              <Button key={section.href} component="a" href={section.href} sx={{ color: "#374151", fontWeight: 700, px: 1.25 }}>
                {section.label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/login" variant="outlined" sx={{ borderRadius: 1, fontWeight: 700 }}>로그인</Button>
            <Button component={RouterLink} to="/signup" variant="contained" disableElevation sx={{ borderRadius: 1, fontWeight: 800 }}>시작하기</Button>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ width: "min(1120px, calc(100% - 32px))", mx: "auto", py: { xs: 5, md: 8 } }}>
        <Stack spacing={6}>
          <Box sx={{ borderRadius: 1, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.10)", background: "linear-gradient(180deg, rgba(47,128,237,0.96) 0%, rgba(25,93,194,0.98) 100%)" }}>
            <Box sx={{ p: { xs: 3, md: 5 } }}>
              <Stack spacing={2.5}>
                <Chip label="리그 운영 서비스" sx={{ alignSelf: "flex-start", bgcolor: "rgba(255,255,255,0.16)", color: "#FFFFFF", fontWeight: 800 }} />
                <Typography sx={{ fontSize: { xs: 32, md: 56 }, lineHeight: { xs: 1.1, md: 1.03 }, fontWeight: 900, color: "#FFFFFF", maxWidth: { xs: "100%", md: 980, lg: 920 }, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>
                  <Box component="span" sx={{ display: "block" }}>리그 개설부터 경기 운영, 추첨 결과까지</Box>
                  <Box component="span" sx={{ display: "block" }}>우리리그 안에서 자연스럽게 이어집니다</Box>
                </Typography>
                <Typography sx={{ fontSize: { xs: 16, md: 17 }, lineHeight: 1.85, color: "rgba(255,255,255,0.88)", maxWidth: { xs: "100%", md: 760 }, wordBreak: "keep-all" }}>
                  우리리그는 리그 생성, 토너먼트 운영, 위치기반 클럽 추천, OMR 인식, 랭킹, 알림, 추첨 기능까지
                  실제 현장 운영에 필요한 흐름을 하나의 서비스 안에서 이어서 제공합니다.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <Button component="a" href="#league" variant="contained" disableElevation endIcon={<EastIcon />} sx={{ borderRadius: 1, bgcolor: "#FFFFFF", color: "#1464D2", fontWeight: 900, px: 2.5 }}>
                    기능 살펴보기
                  </Button>
                  <Button component={RouterLink} to="/login" variant="outlined" sx={{ borderRadius: 1, borderColor: "rgba(255,255,255,0.35)", color: "#FFFFFF", fontWeight: 800 }}>
                    로그인하기
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Box>

          <Box id="league" sx={sectionAnchorSx}>
            <SectionTitle eyebrow="LEAGUE" title="리그 운영 기능" description="다양한 리그 형식, 참가 관리, 경기 진행, 토너먼트 연결까지 실제 서비스 안의 운영 흐름을 기준으로 구성되어 있습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={leagueCards} icon={<SportsScoreOutlinedIcon />} />
            </Box>
          </Box>

          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
              <Stack spacing={2.5}>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>리그 예시 화면</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" }, gap: 2 }}>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                    <Stack spacing={1.15}>
                      <Chip label="모집 중" size="small" sx={{ alignSelf: "flex-start", bgcolor: "#DBEAFE", color: "#1D4ED8", fontWeight: 800 }} />
                      <Typography sx={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>우리리그 오픈 랭킹전</Typography>
                      <Typography sx={{ fontSize: 14, lineHeight: 1.75, color: "#6B7280" }}>
                        서울 송파구 탄천 탁구장에서 진행되는 단식 개인전 예시입니다.
                        참가 신청부터 경기순서 확인, 경기 결과 반영까지 모바일에서 연결되는 운영 흐름을 보여줍니다.
                      </Typography>
                      <Divider sx={{ my: 0.8 }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>일정: 2026.05.24 10:00</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>장소: 탄천 탁구장</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>모집: 24명</Typography>
                    </Stack>
                  </Box>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#111827", mb: 1.4 }}>경기순서 예시</Typography>
                    <Stack spacing={1}>
                      {matchItems.map((match) => (
                        <Box key={match.order} sx={{ p: 1.4, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{match.order}</Typography>
                            <Chip label={match.status} size="small" sx={{ fontWeight: 700 }} />
                          </Stack>
                          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#111827", mt: 0.8 }}>{match.matchup}</Typography>
                          <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 0.35 }}>{match.court}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box>
            <SectionTitle eyebrow="TOURNAMENT" title="토너먼트 운영" description="단일리그 이후 본선 토너먼트, 상·하위 토너먼트, 대진표 시각화 같은 운영 기능도 함께 사용할 수 있습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={tournamentCards} icon={<ViewKanbanOutlinedIcon />} />
            </Box>
          </Box>

          <Box id="club-recommend" sx={sectionAnchorSx}>
            <SectionTitle eyebrow="CLUB RECOMMEND" title="위치기반 클럽 추천" description="실제 서비스에는 위치 권한과 종목 정보를 함께 활용해 주변 클럽을 추천하는 기능이 포함되어 있습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={recommendCards} icon={<LocationOnOutlinedIcon />} />
            </Box>
          </Box>

          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
              <Stack spacing={2}>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>클럽 추천 예시</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                  {[
                    { name: "송파 스매시 클럽", meta: "서울 송파구 · 1.2km · 회원 38명" },
                    { name: "잠실 오픈 탁구모임", meta: "서울 송파구 · 2.4km · 회원 21명" },
                    { name: "탄천 평일 리그 클럽", meta: "서울 강동구 · 3.1km · 회원 17명" },
                  ].map((club) => (
                    <Box key={club.name} sx={{ p: 2.2, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{club.name}</Typography>
                      <Typography sx={{ fontSize: 13, lineHeight: 1.7, color: "#6B7280", mt: 0.7 }}>{club.meta}</Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box id="omr" sx={sectionAnchorSx}>
            <SectionTitle eyebrow="OMR" title="4인 리그 OMR 인식" description="이번에 추가된 OMR 기능은 4인 리그 운영에서 점수 인식과 결과 반영을 더 빠르게 처리할 수 있도록 구성되어 있습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={omrCards} icon={<SportsScoreOutlinedIcon />} />
            </Box>
          </Box>

          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
              <Stack spacing={2}>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>OMR 운영 흐름</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#111827", mb: 1.2 }}>사용 조건</Typography>
                    <Stack spacing={1}>
                      {omrChecklist.map((item) => (
                        <Typography key={item} sx={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                          • {item}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#DBEAFE" }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#111827", mb: 1.2 }}>기대 효과</Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.8, color: "#374151" }}>
                      현장에서 수기로 결과를 다시 입력하는 시간을 줄이고, 종이 마킹지 운영과 모바일 기록 반영을 자연스럽게 이어줍니다.
                      운영자는 스캔 결과를 검토한 뒤 바로 점수에 반영할 수 있습니다.
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box id="ranking" sx={sectionAnchorSx}>
            <SectionTitle eyebrow="RANKING & NOTIFICATION" title="랭킹과 경기 알림" description="클럽 랭킹, 종목 랭킹, 경기 시작 알림 기능까지 함께 제공해 경기 이후 흐름도 끊기지 않게 구성했습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={rankingCards} icon={<LeaderboardOutlinedIcon />} />
            </Box>
          </Box>

          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
              <Stack spacing={2}>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>랭킹 · 알림 예시</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                    <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#111827", mb: 1.1 }}>종목 랭킹</Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.8, color: "#6B7280" }}>
                      상위 랭킹, 내 순위, 레이팅, 최근 경기일까지 한 화면에서 확인하는 구조를 제공합니다.
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.1 }}>
                      <NotificationsActiveOutlinedIcon sx={{ color: "#2563EB" }} />
                      <Typography sx={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>경기 시작 알림</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.8, color: "#6B7280" }}>
                      브라우저 푸시 알림 구독을 통해 경기 순서가 가까워졌을 때 참가자에게 알림을 전달할 수 있습니다.
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box id="draw" sx={sectionAnchorSx}>
            <SectionTitle eyebrow="DRAW" title="추첨과 당첨 결과 공개" description="리그 종료 후 경품 추첨 회차를 저장하고, 결과를 보기 쉬운 카드형 구조로 정리할 수 있습니다." />
            <Box sx={{ mt: 3 }}>
              <FeatureGrid items={drawCards} icon={<EmojiEventsOutlinedIcon />} />
            </Box>
          </Box>

          <Card elevation={2} sx={{ borderRadius: 1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 }, "&:last-child": { pb: { xs: 2.5, md: 3 } } }}>
              <Stack spacing={2}>
                <Typography sx={{ fontSize: 24, fontWeight: 900, color: "#111827" }}>추첨 결과 예시</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                  {drawWinners.map((item, index) => (
                    <Box key={item.prize} sx={{ p: 2.2, borderRadius: 1, bgcolor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                      <Chip label={`${index + 1}차`} size="small" sx={{ bgcolor: "#FEF3C7", color: "#92400E", fontWeight: 800 }} />
                      <Typography sx={{ fontSize: 20, fontWeight: 900, color: "#111827", mt: 1.3 }}>{item.prize}</Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#374151", mt: 0.7 }}>{item.division} · {item.winner}</Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Box>
            <SectionTitle eyebrow="FLOW" title="서비스 이용 흐름" description="클럽 생성부터 리그 진행, OMR 반영, 랭킹 확인, 추첨 결과 공개까지 한 흐름으로 이어집니다." />
            <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
              {flowSteps.map((step, index) => (
                <Box key={step} sx={{ p: 2.5, borderRadius: 1, bgcolor: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 900, color: "#2563EB" }}>STEP {index + 1}</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#111827", lineHeight: 1.6, mt: 1 }}>{step}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ borderRadius: 1, p: { xs: 3, md: 4 }, bgcolor: "#DBEAFE" }}>
            <Stack spacing={2.2} alignItems="flex-start">
              <Typography sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 900, lineHeight: 1.12, color: "#111827" }}>
                실제 서비스 사용은 로그인 후 이어집니다
              </Typography>
              <Typography sx={{ fontSize: 15, lineHeight: 1.8, color: "#374151", maxWidth: 760 }}>
                클럽 운영, 리그 생성, 토너먼트 진행, OMR 반영, 랭킹 확인, 경기 알림, 추첨 결과 관리 기능은
                우리리그 서비스 안에서 로그인 이후 계속 사용할 수 있습니다.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                <Button component={RouterLink} to="/login" variant="contained" disableElevation sx={{ borderRadius: 1, fontWeight: 900 }}>로그인</Button>
                <Button component={RouterLink} to="/signup" variant="outlined" sx={{ borderRadius: 1, fontWeight: 800 }}>회원가입</Button>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
