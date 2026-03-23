import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";

type GuideTab = "create" | "join";

export default function GuestHome() {
    const [guideTab, setGuideTab] = useState<GuideTab>("create");

    return (
        <Box
            sx={{
                px: 0,
                pt: 2,
                pb: 4,
                mx: -2,
                // backgroundColor: "#F3F4F6",
                minHeight: "100%",
            }}
        >
            <Stack sx={{}}>
                <Typography sx={{ mx: 2, fontSize: 24, fontWeight: 800, color: "#111827", mb: 2.5 }}>
                    우리리그란?
                </Typography>

                <FeatureCard
                    title="간편한 리그 생성"
                    description={
                        <>
                            클릭 몇 번만으로 30초 안에 리그를 뚝딱
                            <br />
                            비슷스한 규칙, 리그에 참가할 수 있습니다.
                        </>
                    }
                />

                <FeatureCard
                    title="자동화된 경기 운영"
                    description={
                        <>
                            경기 순서 자동 배정
                            <br />
                            점수판 생성 및 실시간 순위 업데이트
                        </>
                    }
                    bgColor="#F3F4F6"
                />

                <FeatureCard
                    title="간편한 경기결과 등록"
                    description={
                        <>
                            참가자끼리 본여서 확인하는 리그 진행현황
                            <br />
                            조 편성 결과, 대진표, 경기결과 입력 가능
                        </>
                    }
                />

                <Box>
                    <Typography
                        sx={{
                            mt: 2.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mb: 1.2,
                            fontSize: 24,
                            fontWeight: 800,
                            color: "#111827",
                        }}
                    >
                        우리리그에서는 이렇게 진행됩니다
                    </Typography>

                    <Box sx={{ mb: 2, px: 2 }}>
                        <GuideTabGroup value={guideTab} onChange={setGuideTab} />
                    </Box>

                    <Box
                        sx={{
                            width: "100%",
                            height: 400,
                            backgroundColor: "#D1D5DB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#4B5563",
                            fontSize: 18,
                            fontWeight: 700,
                            mb: 1.5,
                        }}
                    >
                        {guideTab === "create" ? "리그 생성 GIF 영역" : "리그 참가 GIF 영역"}
                    </Box>

                    <Box sx={{ mx: 2 }}>
                        <Typography
                            sx={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#374151",
                                mb: 0.5,
                            }}
                        >
                            {guideTab === "create" ? "리그 생성 흐름" : "리그 참가 흐름"}
                        </Typography>

                        <Typography
                            sx={{
                                fontSize: 13,
                                lineHeight: 1.6,
                                color: "#6B7280",
                            }}
                        >
                            {guideTab === "create"
                                ? "리그를 만들고 참가자를 등록한 뒤 경기 일정과 결과를 관리할 수 있습니다."
                                : "초대 코드나 참여 기능을 통해 리그에 참가하고 경기 일정과 결과를 확인할 수 있습니다."}
                        </Typography>
                    </Box>
                </Box>

                <Box
                    sx={{
                        mt: 3,
                        px: 2,
                        py: 2,
                        // borderRadius: 0.6,
                        backgroundColor: "#DBEAFE",
                    }}
                >
                    <Typography
                        sx={{
                            mt: 3,
                            mb: 1.2,
                            fontSize: 18,
                            fontWeight: 800,
                            color: "#111827",
                        }}
                    >
                        우리리그와 함께 해보세요
                    </Typography>

                    <Button
                        fullWidth
                        variant="outlined"
                        sx={{
                            mb: 3,
                            height: 40,
                            borderRadius: 9999,
                            backgroundColor: "#FFFFFF",
                            borderColor: "#60A5FA",
                            color: "#2563EB",
                            fontWeight: 700,
                            "&:hover": {
                                borderColor: "#3B82F6",
                                backgroundColor: "#F8FAFC",
                            },
                        }}
                    >
                        제휴 문의
                    </Button>
                </Box>
            </Stack>
        </Box>
    );
}

function FeatureCard({
    title,
    description,
    bgColor = "#DBEAFE",
}: {
    title: string;
    description: React.ReactNode;
    bgColor?: string;
}) {
    return (
        <Box
            sx={{
                px: 2,
                py: 2,
                // borderRadius: 0.6,
                backgroundColor: bgColor,
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mx: 2, mt: 2, mb: 2 }}>
                <Box
                    sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 0,
                        backgroundColor: "#D1D5DB",
                        flexShrink: 0,
                        mt: 0.2,
                    }}
                />

                <Box>
                    <Typography
                        sx={{
                            mb: 0.7,
                            fontSize: 19,
                            fontWeight: 800,
                            color: "#111827",
                        }}
                    >
                        {title}
                    </Typography>

                    <Typography
                        sx={{
                            fontSize: 15,
                            lineHeight: 1.55,
                            color: "#4B5563",
                        }}
                    >
                        {description}
                    </Typography>
                </Box>
            </Stack>
        </Box>
    );
}

function GuideTabGroup({
    value,
    onChange,
}: {
    value: "create" | "join";
    onChange: (value: "create" | "join") => void;
}) {
    return (
        <Box
            sx={{
                display: "flex",
                width: "100%",
                border: "1px solid #CFCFCF",
                borderRadius: 9999,
                overflow: "hidden",
                backgroundColor: "#FFFFFF",
            }}
        >
            <Button
                onClick={() => onChange("create")}
                sx={{
                    flex: 1,
                    height: 44,
                    borderRadius: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#222222",
                    backgroundColor: value === "create" ? "#D9D9D9" : "#FFFFFF",
                    "&:hover": {
                        backgroundColor: value === "create" ? "#D9D9D9" : "#F7F7F7",
                    },
                }}
            >
                리그 생성
            </Button>

            <Box sx={{ width: "1px", backgroundColor: "#CFCFCF" }} />

            <Button
                onClick={() => onChange("join")}
                sx={{
                    flex: 1,
                    height: 44,
                    borderRadius: 0,
                    fontSize: 20,
                    fontWeight: 800,
                    color: "#222222",
                    backgroundColor: value === "join" ? "#D9D9D9" : "#FFFFFF",
                    "&:hover": {
                        backgroundColor: value === "join" ? "#D9D9D9" : "#F7F7F7",
                    },
                }}
            >
                리그 참가
            </Button>
        </Box>
    );
}