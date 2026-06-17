import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../theme";

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PageHeader({ title }: { title: string }) {
  const navigation = useNavigation<any>();
  return (
    <View style={styles.pageHeader}>
      <Pressable onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={colors.text} /></Pressable>
      <Text style={styles.pageTitle}>{title}</Text>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Empty({ message }: { message: string }) {
  return <Card><Text style={styles.empty}>{message}</Text></Card>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.field} {...props} />;
}

export function Button({
  title,
  onPress,
  loading,
  tone = "primary",
  rounded = false,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  tone?: "primary" | "danger";
  rounded?: boolean;
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        rounded && styles.roundedButton,
        tone === "danger" && styles.dangerButton,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </Pressable>
  );
}

export function Loading() {
  return <ActivityIndicator color={colors.primary} size="large" style={styles.loading} />;
}

export function ErrorMessage({ message }: { message: string }) {
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 4 },
  pageHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  empty: { color: colors.muted, textAlign: "center", paddingVertical: 16 },
  field: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  button: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  dangerButton: { backgroundColor: colors.danger },
  roundedButton: { borderRadius: 999 },
  pressed: { opacity: 0.8 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  loading: { paddingVertical: 36 },
  error: { color: colors.danger, lineHeight: 20 },
});
