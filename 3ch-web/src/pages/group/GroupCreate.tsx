import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Stack,
    Typography,
    TextField,
    Button,
    Select,
    MenuItem,
    FormControl,
    IconButton,
    Dialog,
    DialogContent,
    DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import type { SelectChangeEvent } from "@mui/material";
import { useCreateGroupMutation, useLazyCheckGroupNameQuery } from "../../features/group/groupApi";
import { REGION_DATA } from "./regionData";

export default function GroupCreate() {
    const navigate = useNavigate();
    const [createGroup, { isLoading: creating }] = useCreateGroupMutation();
    const [checkName] = useLazyCheckGroupNameQuery();

    const [sport, setSport] = useState("");
    // const [groupType, setGroupType] = useState("");
    const [regionCity, setRegionCity] = useState("");
    const [regionDistrict, setRegionDistrict] = useState("");
    const [groupName, setGroupName] = useState("");
    const [foundedAt, setFoundedAt] = useState("");

    const [nameChecked, setNameChecked] = useState<boolean | null>(null); // null=미확인, true=사용가능, false=중복
    const [nameCheckMsg, setNameCheckMsg] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [done, setDone] = useState(false);

    const districts = regionCity ? (REGION_DATA[regionCity] ?? []) : [];

    const canSubmit =
        sport.trim() !== "" &&
        // groupType.trim() !== "" &&
        regionCity.trim() !== "" &&
        regionDistrict.trim() !== "" &&
        groupName.trim() !== "" &&
        nameChecked === true &&
        foundedAt.length === 10;

    const handleCityChange = (e: SelectChangeEvent<string>) => {
        setRegionCity(e.target.value);
        setRegionDistrict("");
    };

    const handleNameChange = (val: string) => {
        setGroupName(val);
        setNameChecked(null);
        setNameCheckMsg("");
    };

    const handleCheckName = async () => {
        const trimmed = groupName.trim();
        if (!trimmed) return;

        try {
            const result = await checkName(trimmed).unwrap();
            if (result.available) {
                setNameChecked(true);
                setNameCheckMsg("*사용할 수 있는 모임명입니다.");
            } else {
                setNameChecked(false);
                setNameCheckMsg("*사용할 수 없는 모임명입니다. 다른 모임명을 입력해주세요.");
            }
        } catch {
            setNameChecked(false);
            setNameCheckMsg("*중복검사 중 오류가 발생했습니다.");
        }
    };

    const handleFoundedAtChange = (val: string) => {
        // 숫자와 하이픈만 허용, 자동 하이픈 삽입
        const digits = val.replace(/[^\d]/g, "");
        let formatted = "";
        for (let i = 0; i < digits.length && i < 8; i++) {
            if (i === 4 || i === 6) formatted += "-";
            formatted += digits[i];
        }
        setFoundedAt(formatted);
    };

    const handleSubmit = () => {
        if (!canSubmit) return;
        setConfirmOpen(true);
    };

    const handleConfirmCreate = async () => {
        setConfirmOpen(false);
        try {
            await createGroup({
                name: groupName.trim(),
                sport: sport,
                // type: groupType,
                region_city: regionCity,
                region_district: regionDistrict,
                founded_at: foundedAt,
            }).unwrap();
            setDone(true);
        } catch {
            alert("모임 생성에 실패했습니다.");
        }
    };

    const selectSx = {
        borderRadius: 1,
        bgcolor: "#fff",
        height: 40,
        "& .MuiSelect-select": { fontWeight: 600, py: 0.8 },
    };

    const inputSx = {
        "& .MuiOutlinedInput-root": {
            borderRadius: 1,
            bgcolor: "#fff",
            height: 40,
        },
        "& .MuiOutlinedInput-input": {
            py: 0.8,
            fontSize: "0.95rem",
        },
    };

    if (done) {
        return (
            <Box sx={{ px: 2.5, pt: 2 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 900, textAlign: "center", mt: 2 }}>
                    모임 생성 완료
                </Typography>

                <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: "center", mt: 1, color: "#6B7280" }}>
                    이제 우리리그에서 모임을 관리하고{"\n"}리그를 개최할 수 있습니다!
                </Typography>

                <Box
                    sx={{
                        mt: 3,
                        width: "100%",
                        height: 200,
                        border: "2px solid #2F80ED",
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#2F80ED",
                        fontWeight: 900,
                    }}
                >
                    🎉
                </Box>

                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    onClick={() => navigate("/group")}
                    sx={{
                        mt: 3,
                        borderRadius: 1,
                        height: 44,
                        fontWeight: 900,
                        bgcolor: "#2F80ED",
                        "&:hover": { bgcolor: "#256FD1" },
                    }}
                >
                    확인
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            {/* 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
                <IconButton onClick={() => navigate(-1)} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography sx={{ fontSize: 20, fontWeight: 900 }}>
                    모임 생성
                </Typography>
            </Stack>

            <Stack spacing={3}>
                {/* 종목 */}
                <Box>
                    <Typography sx={{ fontWeight: 900, mb: 1 }}>종목</Typography>
                    <FormControl fullWidth>
                        <Select
                            displayEmpty
                            value={sport}
                            onChange={(e: SelectChangeEvent<string>) => setSport(e.target.value)}
                            size="small"
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>종목 선택</em>
                            </MenuItem>
                            <MenuItem value="탁구">탁구</MenuItem>
                            <MenuItem value="배드민턴">배드민턴</MenuItem>
                            <MenuItem value="테니스">테니스</MenuItem>
                            <MenuItem value="축구">축구</MenuItem>
                            <MenuItem value="농구">농구</MenuItem>
                            <MenuItem value="기타">기타</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                {/* 종류 */}
                {/* <Box>
                    <Typography sx={{ fontWeight: 900, mb: 1 }}>종류</Typography>
                    <FormControl fullWidth>
                        <Select
                            displayEmpty
                            value={groupType}
                            onChange={(e: SelectChangeEvent<string>) => setGroupType(e.target.value)}
                            size="small"
                            sx={selectSx}
                        >
                            <MenuItem value="">
                                <em>종류 선택</em>
                            </MenuItem>
                            <MenuItem value="동호회">동호회</MenuItem>
                            <MenuItem value="학교">학교</MenuItem>
                            <MenuItem value="직장">직장</MenuItem>
                            <MenuItem value="지역">지역</MenuItem>
                            <MenuItem value="기타">기타</MenuItem>
                        </Select>
                    </FormControl>
                </Box> */}

                {/* 지역 */}
                <Box>
                    <Typography sx={{ fontWeight: 900, mb: 1 }}>지역</Typography>
                    <Stack direction="row" spacing={1}>
                        <FormControl sx={{ flex: 1 }}>
                            <Select
                                displayEmpty
                                value={regionCity}
                                onChange={handleCityChange}
                                size="small"
                                sx={selectSx}
                            >
                                <MenuItem value="">
                                    <em>광역시/도 선택</em>
                                </MenuItem>
                                {Object.keys(REGION_DATA).map((city) => (
                                    <MenuItem key={city} value={city}>{city}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl sx={{ flex: 1 }}>
                            <Select
                                displayEmpty
                                value={regionDistrict}
                                onChange={(e: SelectChangeEvent<string>) => setRegionDistrict(e.target.value)}
                                size="small"
                                sx={selectSx}
                                disabled={!regionCity}
                            >
                                <MenuItem value="">
                                    <em>시/군/구 선택</em>
                                </MenuItem>
                                {districts.map((d) => (
                                    <MenuItem key={d} value={d}>{d}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>

                {/* 모임명 */}
                <Box>
                    <Typography sx={{ fontWeight: 900, mb: 1 }}>모임명</Typography>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                            placeholder="모임명"
                            size="small"
                            value={groupName}
                            onChange={(e) => handleNameChange(e.target.value)}
                            sx={{ ...inputSx, flex: 1 }}
                        />
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCheckName}
                            disabled={!groupName.trim()}
                            sx={{
                                borderRadius: 1,
                                height: 40,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                            }}
                        >
                            중복검사
                        </Button>
                    </Stack>
                    {nameCheckMsg && (
                        <Typography
                            sx={{
                                fontSize: 12,
                                fontWeight: 600,
                                mt: 0.5,
                                color: nameChecked ? "#1976D2" : "#E53935",
                            }}
                        >
                            {nameCheckMsg}
                        </Typography>
                    )}
                </Box>

                {/* 모임 창단일 */}
                <Box>
                    <Typography sx={{ fontWeight: 900, mb: 1 }}>모임 창단일</Typography>
                    <TextField
                        placeholder="YYYY-MM-DD"
                        size="small"
                        fullWidth
                        value={foundedAt}
                        onChange={(e) => handleFoundedAtChange(e.target.value)}
                        inputProps={{ maxLength: 10, inputMode: "numeric" }}
                        sx={inputSx}
                    />
                </Box>

                {/* 모임 생성 버튼 */}
                <Button
                    fullWidth
                    variant="contained"
                    disableElevation
                    disabled={!canSubmit || creating}
                    onClick={handleSubmit}
                    sx={{
                        borderRadius: 1,
                        py: 1.2,
                        fontWeight: 900,
                        fontSize: 16,
                        mt: 2,
                    }}
                >
                    모임 생성
                </Button>
            </Stack>

            {/* 확인 다이얼로그 */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogContent sx={{ pt: 2.5, pb: 1.5 }}>
                    <Typography sx={{ fontWeight: 900, mb: 1.5, textAlign: "left" }}>
                        모임 생성 확인
                    </Typography>
                    <Typography sx={{ fontSize: 15, lineHeight: 1.6, textAlign: "left", whiteSpace: "pre-line" }}>
                        {/* 종목: {sport} / 종류: {groupType}{"\n"} */}
                        종목: {sport}{"\n"}
                        {regionCity} {regionDistrict}{"\n"}
                        "{groupName}" 모임을 생성하겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
                    <Button onClick={() => setConfirmOpen(false)} sx={{ fontWeight: 900, color: "#111827" }}>
                        취소
                    </Button>
                    <Button onClick={handleConfirmCreate} disabled={creating} sx={{ fontWeight: 900, color: "#111827" }}>
                        확인
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
