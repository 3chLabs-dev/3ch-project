import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  type Group,
  useGetMyGroupsQuery,
  useRecommendGroupsMutation,
  useSearchGroupsQuery,
} from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, ErrorMessage, Field, Header, Loading } from "../components/Ui";
import { colors } from "../theme";

const SPORTS = ["탁구", "배드민턴", "테니스", "모든 종목"];

export function GroupsScreen() {
  const navigation = useNavigation<any>();
  const myGroupsQuery = useGetMyGroupsQuery();
  const myGroups = useMemo(() => myGroupsQuery.data?.groups ?? [], [myGroupsQuery.data]);
  const myRegionCity = myGroups.find((group) => group.region_city)?.region_city;
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [gpsClubs, setGpsClubs] = useState<Group[] | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [recommend, recommendState] = useRecommendGroupsMutation();
  const recommendedQuery = useSearchGroupsQuery({
    q: search.trim() || undefined,
    regionCity: !search.trim() ? myRegionCity : undefined,
    limit: 10,
    sortByRegion: !search.trim() && !!myRegionCity,
  });
  const recommendedGroups = (recommendedQuery.data?.groups ?? []).filter(
    (group) => !sport || sport === "모든 종목" || group.sport === sport,
  );

  const getGpsRecommendations = async () => {
    setGpsError("");
    setGpsClubs(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      setGpsError("위치 권한을 허용해야 주변 클럽을 추천할 수 있습니다.");
      return;
    }
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const result = await recommend({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        sport: sport && sport !== "모든 종목" ? sport : undefined,
      }).unwrap();
      setGpsClubs(result.clubs);
    } catch {
      setGpsError("현재 위치 기반 추천을 불러오지 못했습니다.");
    }
  };

  return (
    <Screen refreshing={myGroupsQuery.isFetching} onRefresh={myGroupsQuery.refetch}>
      <Header title="클럽" subtitle="가입한 클럽과 주변 추천 클럽을 확인하세요." />

      <Text style={styles.sectionTitle}>가입한 클럽</Text>
      {myGroupsQuery.isLoading ? <Loading /> : null}
      {myGroupsQuery.isError ? <ErrorMessage message="클럽 목록을 불러오지 못했습니다." /> : null}
      {!myGroups.length && !myGroupsQuery.isLoading ? <Empty message="가입한 클럽이 없습니다." /> : null}
      {myGroups.map((group) => (
        <GroupCard key={group.id} group={group} onPress={() => navigation.navigate("GroupDetail", { id: group.club_code ?? group.id })} />
      ))}
      <Button title="새 클럽 만들기" onPress={() => navigation.navigate("GroupCreate")} />

      <Text style={styles.sectionTitle}>AI 추천 클럽</Text>
      <View style={styles.filters}>
        {SPORTS.map((item) => {
          const selected = sport === item;
          return (
            <Pressable key={item} onPress={() => setSport(selected ? null : item)} style={[styles.filter, selected && styles.filterSelected]}>
              <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable disabled={recommendState.isLoading} onPress={getGpsRecommendations} style={styles.locationButton}>
        <Ionicons name="locate" size={19} color={colors.primary} />
        <Text style={styles.locationText}>{recommendState.isLoading ? "위치 분석 중..." : "내 위치로 AI 추천받기"}</Text>
      </Pressable>
      {gpsError ? <ErrorMessage message={gpsError} /> : null}
      {gpsClubs !== null ? (
        gpsClubs.length ? (
          <View style={styles.list}>
            {gpsClubs.map((group) => (
              <GroupCard key={`gps-${group.id}`} group={group} showDistance onPress={() => navigation.navigate("GroupDetail", { id: group.club_code ?? group.id })} />
            ))}
          </View>
        ) : <Empty message="주변에 추천할 클럽이 없습니다." />
      ) : null}

      <Text style={styles.sectionTitle}>{search ? "클럽 검색 결과" : myRegionCity ? `${myRegionCity} 우선 추천` : "추천 클럽"}</Text>
      <Field placeholder="클럽 검색" value={search} onChangeText={setSearch} />
      {recommendedQuery.isLoading ? <Loading /> : null}
      {recommendedGroups.length ? recommendedGroups.map((group) => (
        <GroupCard key={`recommended-${group.id}`} group={group} onPress={() => navigation.navigate("GroupDetail", { id: group.club_code ?? group.id })} />
      )) : !recommendedQuery.isLoading ? <Empty message={search ? "검색 결과가 없습니다." : "추천할 클럽이 없습니다."} /> : null}
    </Screen>
  );
}

function GroupCard({ group, onPress, showDistance = false }: { group: Group; onPress: () => void; showDistance?: boolean }) {
  const region = [group.region_city, group.region_district].filter(Boolean).join(" ");
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.row}>
          <View style={styles.iconCircle}><Ionicons name="people" size={23} color={colors.primary} /></View>
          <View style={styles.grow}>
            <Text style={styles.title}>{group.name}</Text>
            <View style={styles.metaRow}>
              {region ? <Text style={styles.muted}>{region}</Text> : null}
              {showDistance ? <Text style={styles.distance}>{group.distance_km != null ? `${Number(group.distance_km).toFixed(1)}km` : "지역 기반"}</Text> : null}
              <Text style={styles.muted}>{group.sport ?? "종목 미설정"} · 회원 {group.member_count ?? 0}명</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={19} color="#9CA3AF" />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 4 },
  list: { gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  muted: { color: colors.muted, fontSize: 11 },
  distance: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F3F4F6" },
  filterSelected: { backgroundColor: colors.text },
  filterText: { color: "#374151", fontSize: 11, fontWeight: "800" },
  filterTextSelected: { color: "#fff" },
  locationButton: { minHeight: 48, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.surface },
  locationText: { color: colors.primary, fontWeight: "800" },
});
