import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useGetSupportChatQuery, useSendSupportMessageMutation, type SupportMessage } from "../api/mobileApi";
import { Screen } from "../components/Screen";
import { Loading, PageHeader } from "../components/Ui";
import { colors } from "../theme";

export function SupportChatScreen() {
  const query = useGetSupportChatQuery(undefined, { pollingInterval: 10000 });
  const [send, sendState] = useSendSupportMessageMutation();
  const [message, setMessage] = useState("");
  const listRef = useRef<FlatList<SupportMessage>>(null);

  useEffect(() => {
    if (query.data?.messages.length) requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [query.data?.messages.length]);

  const submit = async () => {
    const content = message.trim();
    if (!content) return;
    try {
      await send(content).unwrap();
      setMessage("");
    } catch {
      Alert.alert("전송 실패", "메시지를 전송하지 못했습니다.");
    }
  };

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <PageHeader title="채팅 문의" />
      <Text style={styles.notice}>문의 내용을 남겨주시면 확인 후 답변드리겠습니다.</Text>
      {query.isLoading ? <Loading /> : (
        <FlatList
          ref={listRef}
          data={query.data?.messages ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.messages}
          renderItem={({ item }) => <Message item={item} />}
          onRefresh={query.refetch}
          refreshing={query.isFetching}
        />
      )}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.composer}>
          <TextInput value={message} onChangeText={setMessage} placeholder="문의 내용을 입력해주세요" placeholderTextColor={colors.muted} multiline maxLength={2000} style={styles.input} />
          <Pressable disabled={!message.trim() || sendState.isLoading} onPress={submit} style={styles.send}>
            <Text style={styles.sendText}>전송</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Message({ item }: { item: SupportMessage }) {
  const mine = item.sender_type === "user";
  return <View style={[styles.messageWrap, mine ? styles.mineWrap : styles.adminWrap]}><View style={[styles.bubble, mine ? styles.mine : styles.admin]}>{!mine ? <Text style={styles.adminName}>우리리그 상담</Text> : null}<Text style={[styles.messageText, mine && styles.mineText]}>{item.content}</Text></View><Text style={styles.time}>{new Date(item.created_at).toLocaleString("ko-KR")}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 8 },
  notice: { color: colors.muted, fontSize: 12, padding: 12, borderRadius: 8, backgroundColor: colors.blueSoft },
  messages: { gap: 12, paddingVertical: 8 },
  messageWrap: { maxWidth: "84%", gap: 4 },
  mineWrap: { alignSelf: "flex-end", alignItems: "flex-end" },
  adminWrap: { alignSelf: "flex-start" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  mine: { backgroundColor: "#EC4899", borderTopRightRadius: 4 },
  admin: { backgroundColor: colors.surface, borderTopLeftRadius: 4 },
  adminName: { color: "#DB2777", fontSize: 10, fontWeight: "900", marginBottom: 4 },
  messageText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  mineText: { color: "#fff" },
  time: { color: colors.muted, fontSize: 9 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  input: { flex: 1, maxHeight: 100, minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, color: colors.text },
  send: { minWidth: 54, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#EC4899" },
  sendText: { color: "#fff", fontWeight: "900" },
});
