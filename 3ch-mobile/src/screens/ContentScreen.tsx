import { useRoute } from "@react-navigation/native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useCreateInquiryMutation, useGetFaqsQuery, useGetInquiriesQuery, useGetInquiryQuery, useGetNoticeQuery, useGetNoticesQuery, useGetPolicyQuery, type Faq, type Inquiry, type Notice } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Button, Card, Empty, Field, Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function ContentScreen() {
  const route = useRoute<any>();
  const kind = route.params?.kind as string;
  const title = route.params?.title ?? route.name;
  const notices = useGetNoticesQuery(undefined, { skip: kind !== "notice" });
  const faqs = useGetFaqsQuery(undefined, { skip: kind !== "faq" });
  const policy = useGetPolicyQuery(kind === "privacy" ? "privacy" : "terms", { skip: kind !== "privacy" && kind !== "terms" });
  const inquiries = useGetInquiriesQuery(undefined, { skip: kind !== "inquiry" });
  const loading = notices.isLoading || faqs.isLoading || policy.isLoading || inquiries.isLoading;

  return (
    <Screen refreshing={notices.isFetching || faqs.isFetching || policy.isFetching || inquiries.isFetching}>
      <PageHeader title={title} />
      {loading ? <Loading /> : null}
      {kind === "notice" ? <NoticeList items={notices.data?.notices ?? []} /> : null}
      {kind === "faq" ? <FaqList items={faqs.data?.faqs ?? []} /> : null}
      {(kind === "terms" || kind === "privacy") && policy.data ? <Card><Text style={styles.title}>{policy.data.label}</Text><Text style={styles.meta}>시행일 {policy.data.effective_date}</Text><Text style={styles.body}>{stripHtml(policy.data.body)}</Text></Card> : null}
      {kind === "inquiry" ? <InquiryList items={inquiries.data?.inquiries ?? []} refetch={inquiries.refetch} /> : null}
      {!loading && kind === "notice" && !notices.data?.notices.length ? <Empty message="공지사항이 없습니다." /> : null}
      {!loading && kind === "faq" && !faqs.data?.faqs.length ? <Empty message="등록된 FAQ가 없습니다." /> : null}
    </Screen>
  );
}

function NoticeList({ items }: { items: Notice[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  return <>{items.map((item) => <NoticeRow key={item.id} item={item} open={openId === item.id} onPress={() => setOpenId(openId === item.id ? null : item.id)} />)}</>;
}

function NoticeRow({ item, open, onPress }: { item: { id: number; category?: string; title: string; content_preview?: string; created_at: string }; open: boolean; onPress: () => void }) {
  const detail = useGetNoticeQuery(item.id, { skip: !open });
  return <Pressable onPress={onPress}><Card><View style={styles.row}><Text style={styles.title}>{item.title}</Text><Text style={styles.chevron}>{open ? "⌃" : "⌄"}</Text></View><Text style={styles.meta}>{item.category ?? "안내"} · {new Date(item.created_at).toLocaleDateString("ko-KR")}</Text>{open ? detail.isLoading ? <Loading /> : <Text style={styles.body}>{stripHtml(detail.data?.content ?? "")}</Text> : <Text style={styles.preview}>{item.content_preview}</Text>}</Card></Pressable>;
}

function FaqList({ items }: { items: Faq[] }) {
  const [tab, setTab] = useState<"leader" | "member">("leader");
  const [openId, setOpenId] = useState<number | null>(null);
  const filtered = items.filter((item) => item.tab === tab);
  return <><View style={styles.tabs}><Tab label="리더 / 운영진" active={tab === "leader"} onPress={() => { setTab("leader"); setOpenId(null); }} /><Tab label="일반 회원" active={tab === "member"} onPress={() => { setTab("member"); setOpenId(null); }} /></View>{filtered.map((item) => <Pressable key={item.id} onPress={() => setOpenId(openId === item.id ? null : item.id)}><Card><Text style={styles.section}>{item.section}</Text><Text style={styles.title}>Q. {item.question}</Text>{openId === item.id ? <Text style={styles.answer}>A. {stripHtml(item.answer)}</Text> : null}</Card></Pressable>)}</>;
}

function InquiryList({ items, refetch }: { items: Inquiry[]; refetch: () => unknown }) {
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [create, state] = useCreateInquiryMutation();
  return <><Button title={formOpen ? "작성 취소" : "새 문의 작성"} onPress={() => setFormOpen(!formOpen)} />{formOpen ? <Card><Field placeholder="제목" value={subject} onChangeText={setSubject} /><Field placeholder="문의 내용" value={content} onChangeText={setContent} multiline /><Button loading={state.isLoading} title="문의 접수" onPress={async () => { if (!subject.trim() || !content.trim()) return Alert.alert("확인", "제목과 문의 내용을 입력해주세요."); await create({ category: "기타", title: subject.trim(), content: content.trim() }).unwrap(); setSubject(""); setContent(""); setFormOpen(false); refetch(); }} /></Card> : null}{items.map((item) => <InquiryRow key={item.id} id={item.id} title={item.title} status={item.status} createdAt={item.created_at} open={openId === item.id} onPress={() => setOpenId(openId === item.id ? null : item.id)} />)}{!items.length ? <Empty message="접수한 문의가 없습니다." /> : null}</>;
}

function InquiryRow({ id, title, status, createdAt, open, onPress }: { id: number; title: string; status: string; createdAt: string; open: boolean; onPress: () => void }) {
  const detail = useGetInquiryQuery(id, { skip: !open });
  return <Pressable onPress={onPress}><Card><View style={styles.row}><Text style={styles.title}>{title}</Text><Text style={[styles.status, status === "answered" && styles.answered]}>{status === "answered" ? "답변 완료" : "답변 대기"}</Text></View><Text style={styles.meta}>{new Date(createdAt).toLocaleDateString("ko-KR")}</Text>{open && detail.isLoading ? <Loading /> : null}{open && detail.data ? <><Text style={styles.body}>{detail.data.content}</Text><View style={styles.reply}><Text style={styles.section}>관리자 답변</Text><Text style={styles.body}>{detail.data.reply || "아직 답변이 등록되지 않았습니다."}</Text></View></> : null}</Card></Pressable>;
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeTabText]}>{label}</Text></Pressable>;
}

const stripHtml = (value: string) => value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>|<\/li>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 11 },
  body: { color: colors.text, fontSize: 13, lineHeight: 21 },
  preview: { color: colors.muted, fontSize: 12 },
  chevron: { color: colors.muted, fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, padding: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activeTab: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  activeTabText: { color: "#fff" },
  section: { color: colors.primary, fontWeight: "800", fontSize: 11 },
  answer: { color: colors.text, backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8, fontSize: 13, lineHeight: 21 },
  status: { color: "#D97706", fontSize: 10, fontWeight: "800" },
  answered: { color: "#059669" },
  reply: { backgroundColor: colors.blueSoft, padding: 12, borderRadius: 8, gap: 6 },
});
