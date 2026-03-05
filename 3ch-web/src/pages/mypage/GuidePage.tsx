import { useState } from "react";
import {
    Box, IconButton, Stack, Typography,
    Accordion, AccordionSummary, AccordionDetails, Divider, Button,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SportsOutlinedIcon from "@mui/icons-material/SportsOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { useNavigate } from "react-router-dom";

type Section = {
    icon: React.ReactNode;
    iconBg: string;
    title: string;
    items: { q: string; a: string }[];
};

const LEADER_SECTIONS: Section[] = [
    {
        icon: <GroupsOutlinedIcon sx={{ fontSize: 20, color: "#6366F1" }} />,
        iconBg: "#EEF2FF",
        title: "클럽 만들기 & 멤버 관리",
        items: [
            { q: "클럽은 어떻게 만드나요?", a: "홈 화면에서 '클럽 만들기' 버튼을 눌러 클럽명, 종목, 지역 정보를 입력하면 바로 생성됩니다. 생성된 클럽의 모임장이 되어 멤버를 초대할 수 있습니다." },
            { q: "멤버는 어떻게 초대하나요?", a: "클럽 관리 페이지에서 초대 링크를 생성하여 카카오톡 등으로 공유하면 됩니다. 링크를 통해 가입한 멤버는 자동으로 클럽에 배정됩니다." },
            { q: "운영진을 지정할 수 있나요?", a: "클럽 멤버 목록에서 원하는 멤버를 선택하여 '운영진' 역할을 부여할 수 있습니다. 운영진은 리그 생성, 조편성, 경기 결과 입력 등의 기능을 사용할 수 있습니다." },
        ],
    },
    {
        icon: <GridViewOutlinedIcon sx={{ fontSize: 20, color: "#2F80ED" }} />,
        iconBg: "#EFF6FF",
        title: "리그 만들기 & 조편성",
        items: [
            { q: "리그는 어떻게 생성하나요?", a: "홈 화면의 '신규 생성' 버튼을 눌러 리그 이름, 날짜, 모집 인원을 설정합니다. 생성 후 멤버들이 참가 신청을 하거나 직접 초대할 수 있습니다." },
            { q: "조편성은 어떻게 진행하나요?", a: "리그 페이지에서 참가 멤버를 확인한 뒤 '조편성' 버튼을 누르면 자동으로 공정하게 조가 배정됩니다. 조편성 후에도 수동으로 멤버를 조정할 수 있습니다." },
            { q: "경기 결과는 어떻게 입력하나요?", a: "리그 페이지에서 해당 경기를 선택하고 점수를 입력하면 자동으로 순위에 반영됩니다. 운영진만 결과를 입력할 수 있습니다." },
        ],
    },
    {
        icon: <EmojiEventsOutlinedIcon sx={{ fontSize: 20, color: "#D97706" }} />,
        iconBg: "#FFFBEB",
        title: "추첨 진행",
        items: [
            { q: "추첨은 어떻게 진행하나요?", a: "리그 페이지에서 '추첨 만들기'를 누르고 항목과 참가자를 설정하면 공정한 무작위 추첨이 진행됩니다. 추첨 결과는 카카오톡 등으로 바로 공유할 수 있습니다." },
            { q: "추첨 항목을 커스텀할 수 있나요?", a: "추첨 생성 시 항목 이름과 수량을 자유롭게 설정할 수 있습니다. 예를 들어 '코트 A 2명, 코트 B 3명'처럼 구성할 수 있습니다." },
        ],
    },
    {
        icon: <ManageAccountsOutlinedIcon sx={{ fontSize: 20, color: "#059669" }} />,
        iconBg: "#F0FDF4",
        title: "클럽 설정 & 공지",
        items: [
            { q: "공지사항은 어디서 작성하나요?", a: "어드민 페이지의 게시판 관리 > 공지사항에서 작성할 수 있습니다. 중요·안내·이벤트 등 유형을 지정하여 멤버에게 공지할 수 있습니다." },
            { q: "클럽 정보를 수정하려면?", a: "클럽 관리 페이지에서 클럽명, 소개, 지역, 종목 등을 수정할 수 있습니다. 모임장만 클럽 정보를 변경할 수 있습니다." },
        ],
    },
];

const MEMBER_SECTIONS: Section[] = [
    {
        icon: <GroupsOutlinedIcon sx={{ fontSize: 20, color: "#6366F1" }} />,
        iconBg: "#EEF2FF",
        title: "클럽 가입",
        items: [
            { q: "클럽에 가입하려면 어떻게 하나요?", a: "클럽 리더가 공유한 초대 링크를 클릭하면 바로 가입할 수 있습니다. 로그인이 되어 있지 않은 경우 먼저 로그인 후 가입이 완료됩니다." },
            { q: "여러 클럽에 동시에 가입할 수 있나요?", a: "네, 여러 클럽에 동시에 가입할 수 있습니다. 홈 화면 상단에서 클럽을 선택해 전환할 수 있습니다." },
        ],
    },
    {
        icon: <SportsOutlinedIcon sx={{ fontSize: 20, color: "#059669" }} />,
        iconBg: "#F0FDF4",
        title: "리그 참가 & 경기",
        items: [
            { q: "리그에 참가하려면 어떻게 하나요?", a: "홈 화면에 표시된 리그 카드를 선택하고 '참가 신청' 버튼을 누르면 됩니다. 모집 마감 전까지 참가 신청이 가능합니다." },
            { q: "조편성 결과는 어디서 확인하나요?", a: "리그 상세 페이지에서 자신이 배정된 조와 상대방을 확인할 수 있습니다. 조편성 완료 시 알림이 발송됩니다." },
            { q: "경기 순위는 어디서 볼 수 있나요?", a: "리그 페이지에서 실시간 순위표를 확인할 수 있습니다. 경기 결과가 입력될 때마다 자동으로 업데이트됩니다." },
        ],
    },
    {
        icon: <EmojiEventsOutlinedIcon sx={{ fontSize: 20, color: "#D97706" }} />,
        iconBg: "#FFFBEB",
        title: "추첨 & 당첨내역",
        items: [
            { q: "추첨에 참가하려면 어떻게 하나요?", a: "리더/운영진이 추첨을 시작하면 참가 대상에 자동으로 포함됩니다. 별도의 신청 없이 결과를 기다리면 됩니다." },
            { q: "당첨 결과는 어디서 확인하나요?", a: "마이페이지 > '당첨내역'에서 지난 추첨 결과를 모두 확인할 수 있습니다. 추첨 완료 시 결과 링크가 공유됩니다." },
        ],
    },
];

export default function GuidePage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<"leader" | "member">("member");
    const [expanded, setExpanded] = useState<string | false>(false);

    const sections = tab === "leader" ? LEADER_SECTIONS : MEMBER_SECTIONS;

    const toggle = (key: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? key : false);
    };

    return (
        <Stack spacing={2.5} sx={{ width: "100%", mx: "auto", mt: "-4px" }}>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={900} flex={1}>이용방법</Typography>
            </Stack>

            {/* 탭 */}
            <Stack direction="row" spacing={1}>
                <Button
                    fullWidth
                    variant={tab === "member" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => { setTab("member"); setExpanded(false); }}
                    startIcon={<PersonOutlineIcon />}
                    sx={{
                        borderRadius: 1.5, fontWeight: 700, fontSize: 13,
                        ...(tab === "member" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }),
                    }}
                >
                    일반 회원
                </Button>
                <Button
                    fullWidth
                    variant={tab === "leader" ? "contained" : "outlined"}
                    disableElevation
                    onClick={() => { setTab("leader"); setExpanded(false); }}
                    startIcon={<ManageAccountsOutlinedIcon />}
                    sx={{
                        borderRadius: 1.5, fontWeight: 700, fontSize: 13,
                        ...(tab === "leader" ? {} : { borderColor: "#E5E7EB", color: "text.secondary" }),
                    }}
                >
                    리더 / 운영진
                </Button>
            </Stack>

            {/* 안내 배너 */}
            <Box sx={{ bgcolor: tab === "leader" ? "#F0FDF4" : "#EFF6FF", borderRadius: 1.5, px: 2, py: 1.5 }}>
                <Typography fontSize={13} color={tab === "leader" ? "#065F46" : "#1D4ED8"} fontWeight={600} lineHeight={1.7}>
                    {tab === "leader"
                        ? "클럽 리더 / 운영진을 위한 기능 안내입니다.\n클럽 생성부터 리그 운영까지 확인해보세요."
                        : "일반 회원을 위한 기능 안내입니다.\n클럽 가입부터 리그 참가 방법을 확인해보세요."}
                </Typography>
            </Box>

            {/* 섹션별 가이드 */}
            {sections.map((section) => (
                <Box key={section.title}>
                    <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.2 }}>
                        <Box sx={{
                            width: 30, height: 30, borderRadius: 1.2, flexShrink: 0,
                            bgcolor: section.iconBg, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                            {section.icon}
                        </Box>
                        <Typography fontSize={14} fontWeight={800} color="text.primary">{section.title}</Typography>
                    </Stack>

                    <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 1.5, overflow: "hidden" }}>
                        {section.items.map((item, i) => (
                            <Box key={i}>
                                {i > 0 && <Divider />}
                                <Accordion
                                    expanded={expanded === `${section.title}-${i}`}
                                    onChange={toggle(`${section.title}-${i}`)}
                                    disableGutters
                                    elevation={0}
                                    sx={{ "&:before": { display: "none" } }}
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: "text.disabled" }} />}
                                        sx={{ px: 2, py: 0.5, minHeight: 48, "& .MuiAccordionSummary-content": { my: 1 } }}
                                    >
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Typography fontSize={13} fontWeight={700} color="primary.main" sx={{ flexShrink: 0 }}>Q</Typography>
                                            <Typography fontSize={13} fontWeight={600} color="text.primary">{item.q}</Typography>
                                        </Stack>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ px: 2, pt: 1.5, pb: 2, bgcolor: "#F9FAFB" }}>
                                        <Stack direction="row" spacing={1} alignItems="flex-start">
                                            <Typography fontSize={13} fontWeight={700} color="success.main" sx={{ flexShrink: 0, mt: 0.1 }}>A</Typography>
                                            <Typography fontSize={13} color="text.secondary" lineHeight={1.8}>{item.a}</Typography>
                                        </Stack>
                                    </AccordionDetails>
                                </Accordion>
                            </Box>
                        ))}
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}
