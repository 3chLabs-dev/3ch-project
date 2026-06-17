import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Group } from "../api/mobileApi";
import { colors } from "../theme";

export function GroupSelector({
  groups,
  selected,
  onSelect,
}: {
  groups: Group[];
  selected?: Group;
  onSelect: (group: Group) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!groups.length) return null;

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)}>
        <Text numberOfLines={1} style={styles.triggerText}>{selected?.name ?? "클럽 선택"}</Text>
        <Ionicons name="chevron-down" size={16} color="#4F46E5" />
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.title}>클럽 선택</Text>
            {groups.map((group) => (
              <Pressable
                key={group.id}
                style={[styles.item, selected?.id === group.id && styles.selected]}
                onPress={() => {
                  onSelect(group);
                  setOpen(false);
                }}
              >
                <View style={styles.grow}>
                  <Text style={styles.itemTitle}>{group.name}</Text>
                  <Text style={styles.itemSub}>{group.sport ?? "종목 미설정"} · 회원 {group.member_count ?? 0}명</Text>
                </View>
                {selected?.id === group.id ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { maxWidth: 150, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, height: 34, borderRadius: 8, backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" },
  triggerText: { flexShrink: 1, color: "#3730A3", fontSize: 12, fontWeight: "800" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { gap: 8, padding: 20, paddingBottom: 34, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 6 },
  item: { minHeight: 64, padding: 14, flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, backgroundColor: colors.blueSoft },
  grow: { flex: 1 },
  itemTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  itemSub: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
