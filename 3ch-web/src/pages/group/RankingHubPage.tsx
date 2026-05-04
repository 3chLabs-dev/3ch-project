import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { useAppSelector } from "../../app/hooks";
import { useGetGroupRankingQuery, useGetMyGroupsQuery } from "../../features/group/groupApi";
import type { Group } from "../../features/group/groupApi";
import {
  useGetMySportRankingsQuery,
  type SportRankingSummaryItem,
} from "../../features/user/userApi";

const SPORT_EMOJI: Record<string, string> = {
  탁구: "🏓",
  배드민턴: "🏸",
  테니스: "🎾",
};

function getSportEmoji(sport?: string | null) {
  if (!sport) return "🏆";
  return SPORT_EMOJI[sport] ?? "🏆";
}

export default function RankingHubPage() {
  const navigate = useNavigate();
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const { data: groupsData, isLoading: isGroupsLoading } = useGetMyGroupsQuery(undefined, {
    skip: !token,
  });
  const { data: sportsData, isLoading: isSportsLoading } = useGetMySportRankingsQuery(undefined, {
    skip: !token,
  });
  const groups = groupsData?.groups ?? [];
  const sports = sportsData?.sports ?? [];

  if (!token) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">로그인 후 랭킹을 확인할 수 있습니다.</Typography>
      </Box>
    );
  }

  if (isGroupsLoading || isSportsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ pb: 2.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={900} flex={1}>
          랭킹
        </Typography>
      </Stack>

      <Card elevation={0} sx={{ borderRadius: 1.25, bgcolor: "#F5F5F5" }}>
        <CardContent sx={{ py: 1.8, px: 1.8, "&:last-child": { pb: 1.8 } }}>
          <Typography fontWeight={800} fontSize={14}>
            종목별 개인 랭킹과 클럽 랭킹을 한 번에 확인해보세요
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: 12, color: "text.secondary", lineHeight: 1.55 }}>
            먼저 내 종목별 통합 랭킹을 보고, 아래에서 가입한 클럽별 순위도 이어서 확인할 수 있어요.
          </Typography>
        </CardContent>
      </Card>

      <Stack spacing={0.8}>
        <Typography fontWeight={900} fontSize={15}>
          종목별 개인 통합 랭킹
        </Typography>
        {sports.length === 0 ? (
          <EmptyCard message="아직 종목별 개인 랭킹이 없습니다." />
        ) : (
          <Stack spacing={1}>
            {sports.map((sport) => (
              <SportRankingCard
                key={sport.sport}
                item={sport}
                onClick={() => navigate(`/ranking/sport/${encodeURIComponent(sport.sport)}`)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={0.8}>
        <Typography fontWeight={900} fontSize={15}>
          가입한 클럽 랭킹
        </Typography>
        {groups.length === 0 ? (
          <EmptyCard message="가입한 클럽이 없습니다." />
        ) : (
          <Stack spacing={1}>
            {groups.map((group) => (
              <RankingClubCard
                key={group.id}
                group={group}
                currentUserId={user?.id}
                onClick={() => navigate(`/club/${group.club_code ?? group.id}/ranking`)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

function SportRankingCard({
  item,
  onClick,
}: {
  item: SportRankingSummaryItem;
  onClick: () => void;
}) {
  return (
    <Card
      elevation={2}
      onClick={onClick}
      sx={{
        borderRadius: 0.9,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        cursor: "pointer",
        "&:hover": { bgcolor: "#F9FAFB" },
      }}
    >
      <CardContent sx={{ py: 1.35, px: 1.6, "&:last-child": { pb: 1.35 } }}>
        <Stack direction="row" alignItems="center" spacing={1.15}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              bgcolor: "#EEF2FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 17,
            }}
          >
            {getSportEmoji(item.sport)}
          </Box>

          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={0.55}>
              <Typography fontWeight={800} fontSize={14} noWrap>
                {item.sport}
              </Typography>
              <Typography sx={{ fontSize: 10.5, color: "text.secondary", fontWeight: 600 }}>
                참여 클럽 {item.club_count}곳
              </Typography>
            </Stack>

            <Typography sx={{ mt: 0.2, fontSize: 11.5, color: "text.secondary", fontWeight: 600, lineHeight: 1.4 }}>
              {item.my_ranking?.rank
                ? `내 순위 ${item.my_ranking.rank}위 · 레이팅 ${item.my_ranking.rating}`
                : "아직 반영된 개인 랭킹이 없습니다."}
            </Typography>

            <Stack direction="row" spacing={0.55} sx={{ mt: 0.55, flexWrap: "wrap" }}>
              {item.top3.length > 0 ? (
                item.top3.map((row) => (
                  <Box
                    key={row.member_id}
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.45,
                        px: 0.75,
                        py: 0.3,
                        borderRadius: 999,
                        bgcolor: "#F9FAFB",
                      }}
                    >
                    <EmojiEventsOutlinedIcon sx={{ fontSize: 11.5, color: "#F59E0B" }} />
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#374151" }}>
                      {row.rank}위 {row.name}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography sx={{ fontSize: 10.5, color: "text.secondary", lineHeight: 1.35 }}>
                  아직 반영된 경기 기록이 없습니다.
                </Typography>
              )}
            </Stack>
          </Box>

          <ChevronRightIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function RankingClubCard({
  group,
  currentUserId,
  onClick,
}: {
  group: Group;
  currentUserId?: number;
  onClick: () => void;
}) {
  const { data, isLoading } = useGetGroupRankingQuery({ groupId: group.id });
  const myRank = data?.rankings.find((row) => row.member_id === currentUserId);
  const top3 = data?.rankings.filter((row) => row.rank && row.rank <= 3).slice(0, 3) ?? [];

  return (
    <Card
      elevation={2}
      onClick={onClick}
      sx={{
        borderRadius: 0.9,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        cursor: "pointer",
        "&:hover": { bgcolor: "#F9FAFB" },
      }}
    >
      <CardContent sx={{ py: 1.35, px: 1.6, "&:last-child": { pb: 1.35 } }}>
        <Stack direction="row" alignItems="center" spacing={1.15}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              bgcolor: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 17,
            }}
          >
            {getSportEmoji(group.sport)}
          </Box>

          <Box flex={1} minWidth={0}>
            <Typography fontWeight={800} fontSize={14} noWrap>
              {group.name}
            </Typography>
            {isLoading ? (
              <Typography sx={{ mt: 0.2, fontSize: 11.5, color: "text.secondary" }}>
                랭킹을 불러오는 중...
              </Typography>
            ) : (
              <>
                <Typography sx={{ mt: 0.2, fontSize: 11.5, color: "text.secondary", fontWeight: 600, lineHeight: 1.4 }}>
                  {myRank?.rank ? `내 순위 ${myRank.rank}위 · 레이팅 ${myRank.rating}` : "아직 클럽 랭킹이 없습니다."}
                </Typography>
                <Stack direction="row" spacing={0.55} sx={{ mt: 0.55, flexWrap: "wrap" }}>
                  {top3.length > 0 ? top3.map((row) => (
                    <Box
                      key={row.member_id}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.45,
                        px: 0.75,
                        py: 0.3,
                        borderRadius: 999,
                        bgcolor: "#F9FAFB",
                      }}
                    >
                      <EmojiEventsOutlinedIcon sx={{ fontSize: 11.5, color: "#F59E0B" }} />
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: "#374151" }}>
                        {row.rank}위 {row.name}
                      </Typography>
                    </Box>
                  )) : (
                    <Typography sx={{ fontSize: 10.5, color: "text.secondary", lineHeight: 1.35 }}>
                      아직 랭킹 반영 경기가 없습니다.
                    </Typography>
                  )}
                </Stack>
              </>
            )}
          </Box>

          <ChevronRightIcon sx={{ color: "text.secondary", fontSize: 20 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <Card elevation={2} sx={{ borderRadius: 0.9, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <CardContent sx={{ py: 3, px: 1.8, "&:last-child": { pb: 3 } }}>
        <Typography textAlign="center" color="text.secondary" fontWeight={700}>
          {message}
        </Typography>
      </CardContent>
    </Card>
  );
}
