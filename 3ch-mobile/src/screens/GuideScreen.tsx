import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useGetGuidesQuery, type Guide } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Empty, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

type GuideTab = "leader" | "member";

export function GuideScreen() {
  const [tab, setTab] = useState<GuideTab>("leader");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data, isLoading, isFetching, isError, refetch } = useGetGuidesQuery(tab);
  const guides = data?.guides ?? [];

  useEffect(() => {
    setSelectedId((currentId) =>
      guides.some((guide) => guide.id === currentId) ? currentId : guides[0]?.id ?? null,
    );
  }, [guides]);

  const current = useMemo(
    () => guides.find((guide) => guide.id === selectedId) ?? guides[0],
    [guides, selectedId],
  );

  const changeTab = (nextTab: GuideTab) => {
    if (nextTab === tab) return;
    setSelectedId(null);
    setTab(nextTab);
  };

  return (
    <Screen refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <PageHeader title="이용방법" />

      <View style={styles.tabs}>
        <RoleTab active={tab === "leader"} icon="people-outline" label="리더 / 운영진" onPress={() => changeTab("leader")} />
        <RoleTab active={tab === "member"} icon="person-outline" label="일반 회원" onPress={() => changeTab("member")} />
      </View>

      <View style={[styles.intro, tab === "member" && styles.memberIntro]}>
        <Text style={[styles.introText, tab === "member" && styles.memberIntroText]}>
          {tab === "leader"
            ? "클럽 리더와 운영진을 위한 안내입니다.\n클럽 생성부터 리그와 추첨 진행까지 확인해보세요."
            : "일반 회원을 위한 안내입니다.\n클럽 가입부터 리그 참가와 추첨 확인 방법을 확인해보세요."}
        </Text>
      </View>

      {isLoading ? <Loading /> : null}

      {!isLoading && guides.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
          {guides.map((guide) => (
            <Pressable
              key={guide.id}
              onPress={() => setSelectedId(guide.id)}
              style={[styles.sectionButton, current?.id === guide.id && styles.activeSectionButton]}
            >
              <Text style={[styles.sectionText, current?.id === guide.id && styles.activeSectionText]}>{guide.section}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!isLoading && current ? <GuideContent guide={current} /> : null}
      {!isLoading && !isError && guides.length === 0 ? <Empty message="아직 등록된 이용방법이 없습니다." /> : null}
      {!isLoading && isError ? (
        <Pressable onPress={refetch} style={styles.retry}>
          <Text style={styles.retryText}>이용방법을 불러오지 못했습니다. 다시 시도</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function RoleTab({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.roleTab, active && styles.activeRoleTab]}>
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : colors.muted} />
      <Text style={[styles.roleText, active && styles.activeRoleText]}>{label}</Text>
    </Pressable>
  );
}

function GuideContent({ guide }: { guide: Guide }) {
  return (
    <View style={styles.content}>
      <Text style={styles.contentTitle}>{guide.section}</Text>
      <Text style={styles.contentBody}>{stripHtml(guide.content)}</Text>
    </View>
  );
}

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8 },
  roleTab: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  activeRoleTab: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  activeRoleText: { color: "#FFFFFF" },
  intro: { borderRadius: 8, padding: 16, backgroundColor: "#F0FDF4" },
  memberIntro: { backgroundColor: colors.blueSoft },
  introText: { color: "#065F46", fontSize: 13, fontWeight: "600", lineHeight: 21 },
  memberIntroText: { color: "#1D4ED8" },
  sections: { gap: 8, paddingRight: 16 },
  sectionButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface },
  activeSectionButton: { borderColor: colors.text, backgroundColor: colors.text },
  sectionText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  activeSectionText: { color: "#FFFFFF" },
  content: { borderRadius: 8, padding: 18, backgroundColor: colors.surface, gap: 14 },
  contentTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  contentBody: { color: colors.text, fontSize: 14, lineHeight: 24 },
  retry: { paddingVertical: 30, alignItems: "center" },
  retryText: { color: colors.primary, fontWeight: "800" },
});
