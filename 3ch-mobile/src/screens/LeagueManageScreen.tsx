import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { useDeleteLeagueMutation, useGetGroupDetailQuery, useGetLeagueQuery, useUpdateLeagueMutation } from "../api/mobileApi";
import { Button, Card, Empty, Field, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

export function LeagueManageScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const leagueQuery = useGetLeagueQuery(id);
  const groupQuery = useGetGroupDetailQuery(leagueQuery.data?.league.group_id ?? "", { skip: !leagueQuery.data?.league.group_id });
  const [update, updateState] = useUpdateLeagueMutation();
  const [remove, removeState] = useDeleteLeagueMutation();
  const league = leagueQuery.data?.league;
  const [title, setTitle] = useState(""); const [sport, setSport] = useState("");
  const [date, setDate] = useState(""); const [rules, setRules] = useState(""); const [status, setStatus] = useState("draft");
  useEffect(() => { if (!league) return; setTitle(league.title || league.name || ""); setSport(league.sport || ""); setDate((league.start_date || "").slice(0, 10)); setRules(league.rules || ""); setStatus(league.status || "draft"); }, [league]);
  const showError = (error: unknown) => Alert.alert("처리하지 못했습니다", typeof error === "object" && error && "data" in error ? String((error as any).data?.message ?? "잠시 후 다시 시도해 주세요.") : "잠시 후 다시 시도해 주세요.");
  const save = async () => {
    const startDate = new Date(`${date}T00:00:00`);
    if (!title.trim() || !sport.trim() || Number.isNaN(startDate.getTime()) || !["draft", "active", "completed"].includes(status)) { Alert.alert("입력 확인", "리그명, 종목, 시작일과 상태를 확인해 주세요."); return; }
    try { await update({ leagueId: id, updates: { title: title.trim(), name: title.trim(), sport: sport.trim(), start_date: startDate.toISOString(), rules: rules.trim(), status } }).unwrap(); Alert.alert("저장 완료", "리그 정보가 수정되었습니다."); } catch (error) { showError(error); }
  };
  const deleteLeague = () => Alert.alert("리그 삭제", "경기와 참가자 정보도 함께 삭제될 수 있습니다. 계속할까요?", [{ text: "취소", style: "cancel" }, { text: "삭제", style: "destructive", onPress: async () => { try { await remove(id).unwrap(); navigation.navigate("Leagues"); } catch (error) { showError(error); } } }]);
  const canManage = groupQuery.data?.myRole === "owner" || groupQuery.data?.myRole === "admin";
  return <Screen refreshing={leagueQuery.isFetching || groupQuery.isFetching} onRefresh={() => { leagueQuery.refetch(); groupQuery.refetch(); }}><PageHeader title="리그 관리" />{leagueQuery.isLoading || groupQuery.isLoading ? <Loading /> : null}{league && !canManage && !groupQuery.isLoading ? <Empty message="리그 운영진만 관리할 수 있습니다." /> : null}{league && canManage ? <><Card><Text style={styles.section}>기본 정보</Text><Field value={title} onChangeText={setTitle} placeholder="리그 이름" /><Field value={sport} onChangeText={setSport} placeholder="종목" /><Field value={date} onChangeText={setDate} placeholder="시작일 (YYYY-MM-DD)" /><Field value={rules} onChangeText={setRules} placeholder="운영 규칙" multiline /><Text style={styles.label}>상태: {status}</Text><Text style={styles.hint}>상태는 draft · active · completed 중 하나로 입력해 저장합니다.</Text><Field value={status} onChangeText={setStatus} placeholder="draft / active / completed" autoCapitalize="none" /><Button title="변경사항 저장" loading={updateState.isLoading} onPress={save} /></Card><Card><Text style={styles.section}>위험 구역</Text><Text style={styles.hint}>삭제한 리그는 복구할 수 없습니다.</Text><Button title="리그 삭제" tone="danger" loading={removeState.isLoading} onPress={deleteLeague} /></Card></> : null}{!league && !leagueQuery.isLoading ? <Empty message="리그 정보를 찾을 수 없습니다." /> : null}</Screen>;
}

const styles = StyleSheet.create({ section: { color: colors.text, fontWeight: "900", fontSize: 18 }, label: { color: colors.text, fontWeight: "700" }, hint: { color: colors.muted, fontSize: 12, lineHeight: 18 } });
