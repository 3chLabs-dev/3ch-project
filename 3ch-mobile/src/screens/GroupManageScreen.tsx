import { useNavigation, useRoute } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import {
  useGetGroupDetailQuery,
  useRemoveGroupMemberMutation,
  useUpdateGroupMemberMutation,
  useUpdateGroupMemberRoleMutation,
  useUpdateGroupMutation,
} from "../api/mobileApi";
import { Button, Card, Empty, Field, Loading, PageHeader } from "../components/Ui";
import { Screen } from "../components/Screen";
import { colors } from "../theme";

/** Mobile counterpart to the web club management page. Server-side roles remain authoritative. */
export function GroupManageScreen() {
  const navigation = useNavigation<any>();
  const id = useRoute<any>().params.id as string;
  const detailQuery = useGetGroupDetailQuery(id);
  const [updateGroup, updateGroupState] = useUpdateGroupMutation();
  const [updateMember] = useUpdateGroupMemberMutation();
  const [updateRole] = useUpdateGroupMemberRoleMutation();
  const [removeMember] = useRemoveGroupMemberMutation();
  const group = detailQuery.data?.group;
  const role = detailQuery.data?.myRole;
  const canManageMembers = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (!group) return;
    setName(group.name ?? ""); setDescription(group.description ?? "");
    setSport(group.sport ?? ""); setCity(group.region_city ?? "");
  }, [group]);

  const showError = (error: unknown) => Alert.alert("처리하지 못했습니다", typeof error === "object" && error && "data" in error ? String((error as any).data?.message ?? "잠시 후 다시 시도해 주세요.") : "잠시 후 다시 시도해 주세요.");
  const save = async () => {
    try { await updateGroup({ groupId: id, updates: { name: name.trim(), description: description.trim(), sport: sport.trim(), region_city: city.trim() } }).unwrap(); Alert.alert("저장 완료", "동호회 정보가 수정되었습니다."); }
    catch (error) { showError(error); }
  };
  const setDivision = async (userId: number, division: string) => { try { await updateMember({ groupId: id, userId, division }).unwrap(); } catch (error) { showError(error); } };
  const changeRole = (userId: number, nextRole: "member" | "admin") => Alert.alert("권한 변경", nextRole === "admin" ? "운영진으로 지정할까요?" : "일반 멤버로 변경할까요?", [
    { text: "취소", style: "cancel" }, { text: "변경", onPress: async () => { try { await updateRole({ groupId: id, userId, role: nextRole }).unwrap(); } catch (error) { showError(error); } } },
  ]);
  const remove = (userId: number, memberName: string) => Alert.alert("멤버 내보내기", `${memberName} 님을 동호회에서 내보낼까요?`, [
    { text: "취소", style: "cancel" }, { text: "내보내기", style: "destructive", onPress: async () => { try { await removeMember({ groupId: id, userId }).unwrap(); } catch (error) { showError(error); } } },
  ]);

  return <Screen refreshing={detailQuery.isFetching} onRefresh={detailQuery.refetch}>
    <PageHeader title="동호회 관리" />
    {detailQuery.isLoading ? <Loading /> : null}
    {!canManageMembers && !detailQuery.isLoading ? <Empty message="동호회 운영진만 관리할 수 있습니다." /> : null}
    {canManageMembers ? <>
      {isOwner ? <Card><Text style={styles.section}>기본 정보</Text><Field value={name} onChangeText={setName} placeholder="동호회 이름" /><Field value={sport} onChangeText={setSport} placeholder="종목" /><Field value={city} onChangeText={setCity} placeholder="지역" /><Field value={description} onChangeText={setDescription} placeholder="소개" multiline /><Button title="정보 저장" loading={updateGroupState.isLoading} onPress={save} /></Card> : null}
      <Text style={styles.section}>멤버 관리</Text>
      {detailQuery.data?.members.map((member) => member.user_id !== null ? <MemberRow key={member.id} name={member.name ?? member.email ?? "이름 없음"} role={member.role} division={member.division ?? ""} canChangeRole={isOwner && member.role !== "owner"} canRemove={member.role !== "owner"} onDivision={(value) => setDivision(member.user_id!, value)} onRole={() => changeRole(member.user_id!, member.role === "admin" ? "member" : "admin")} onRemove={() => remove(member.user_id!, member.name ?? member.email ?? "이름 없음")} /> : <Card key={member.id}><Text style={styles.memberName}>{member.name ?? "사전등록 회원"}</Text><Text style={styles.preMember}>계정 연결 대기 · 웹에서 초대/연결을 관리할 수 있습니다.</Text></Card>) }
    </> : null}
    <Button title="완료" onPress={() => navigation.goBack()} />
  </Screen>;
}

function MemberRow({ name, role, division, canChangeRole, canRemove, onDivision, onRole, onRemove }: { name: string; role: string; division: string; canChangeRole: boolean; canRemove: boolean; onDivision: (value: string) => void; onRole: () => void; onRemove: () => void }) {
  const [value, setValue] = useState(division);
  useEffect(() => setValue(division), [division]);
  return <Card><View style={styles.memberHeader}><Text style={styles.memberName}>{name}</Text><Text style={styles.role}>{role}</Text></View><View style={styles.memberActions}><Field value={value} onChangeText={setValue} placeholder="부수" /><Button title="부수 저장" onPress={() => onDivision(value.trim())} /></View>{canChangeRole || canRemove ? <View style={styles.inline}>{canChangeRole ? <View style={styles.grow}><Button title={role === "admin" ? "일반 멤버로" : "운영진으로"} onPress={onRole} /></View> : null}{canRemove ? <View style={styles.grow}><Button title="내보내기" tone="danger" onPress={onRemove} /></View> : null}</View> : null}</Card>;
}

const styles = StyleSheet.create({ section: { color: colors.text, fontSize: 18, fontWeight: "900" }, memberHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, memberName: { color: colors.text, fontWeight: "800", fontSize: 16 }, role: { color: colors.primary, fontWeight: "800", fontSize: 12 }, memberActions: { gap: 8 }, inline: { flexDirection: "row", gap: 8 }, grow: { flex: 1 }, preMember: { color: colors.muted, fontSize: 12 } });
