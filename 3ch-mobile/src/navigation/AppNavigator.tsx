import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentScreen } from "../screens/ContentScreen";
import { ClubRankingScreen } from "../screens/ClubRankingScreen";
import { DonateScreen } from "../screens/DonateScreen";
import { DrawDetailScreen } from "../screens/DrawDetailScreen";
import { DrawListScreen } from "../screens/DrawListScreen";
import { DrawScreen } from "../screens/DrawScreen";
import { GroupCreateScreen } from "../screens/GroupCreateScreen";
import { GroupDetailScreen } from "../screens/GroupDetailScreen";
import { GroupsScreen } from "../screens/GroupsScreen";
import { GuideScreen } from "../screens/GuideScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LeagueCreateScreen } from "../screens/LeagueCreateScreen";
import { LeagueDetailScreen } from "../screens/LeagueDetailScreen";
import { LeaguesScreen } from "../screens/LeaguesScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { MatchesScreen } from "../screens/MatchesScreen";
import { MyPageScreen } from "../screens/MyPageScreen";
import { ParticipantsScreen } from "../screens/ParticipantsScreen";
import { PricingScreen } from "../screens/PricingScreen";
import { ProfileEditScreen } from "../screens/ProfileEditScreen";
import { RankingScreen } from "../screens/RankingScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SignUpScreen } from "../screens/SignUpScreen";
import { SportRankingScreen } from "../screens/SportRankingScreen";
import { SupportChatScreen } from "../screens/SupportChatScreen";
import { useAppSelector } from "../store/hooks";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MyStack = createNativeStackNavigator();
const GroupStack = createNativeStackNavigator();
const LeagueStack = createNativeStackNavigator();
const DrawStack = createNativeStackNavigator();

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  홈: "home",
  "리그·대회": "trophy",
  클럽: "people",
  추첨: "dice",
  마이: "person",
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);

  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: "700" }, tabBarStyle: { height: 56 + bottomInset, paddingTop: 5, paddingBottom: bottomInset, borderTopColor: colors.border, backgroundColor: colors.surface }, tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name]} color={color} size={size} /> })}>
    <Tab.Screen name="홈" component={HomeScreen} />
    <Tab.Screen name="리그·대회" component={LeagueNavigator} />
    <Tab.Screen name="클럽" component={GroupNavigator} />
    <Tab.Screen name="추첨" component={DrawNavigator} />
    <Tab.Screen name="마이" component={MyNavigator} />
  </Tab.Navigator>;
}

function GroupNavigator() {
  return <GroupStack.Navigator screenOptions={{ headerShown: false }}><GroupStack.Screen name="Groups" component={GroupsScreen} /><GroupStack.Screen name="GroupDetail" component={GroupDetailScreen} /><GroupStack.Screen name="GroupCreate" component={GroupCreateScreen} /></GroupStack.Navigator>;
}

function LeagueNavigator() {
  return <LeagueStack.Navigator screenOptions={{ headerShown: false }}><LeagueStack.Screen name="Leagues" component={LeaguesScreen} /><LeagueStack.Screen name="LeagueDetail" component={LeagueDetailScreen} /><LeagueStack.Screen name="LeagueCreate" component={LeagueCreateScreen} /><LeagueStack.Screen name="Participants" component={ParticipantsScreen} /><LeagueStack.Screen name="Matches" component={MatchesScreen} /></LeagueStack.Navigator>;
}

function DrawNavigator() {
  return <DrawStack.Navigator screenOptions={{ headerShown: false }}><DrawStack.Screen name="DrawHome" component={DrawScreen} /><DrawStack.Screen name="DrawList" component={DrawListScreen} /><DrawStack.Screen name="DrawDetail" component={DrawDetailScreen} /></DrawStack.Navigator>;
}

const contentScreens = [
  ["Notice", "공지사항", "notice"],
  ["Faq", "자주 묻는 질문", "faq"],
  ["Inquiry", "1:1 문의", "inquiry"],
  ["Terms", "이용약관", "terms"],
  ["Privacy", "개인정보 처리방침", "privacy"],
] as const;

function MyNavigator() {
  return <MyStack.Navigator screenOptions={{ headerShown: false }}>
    <MyStack.Screen name="MyPage" component={MyPageScreen} />
    <MyStack.Screen name="Settings" component={SettingsScreen} />
    <MyStack.Screen name="ProfileEdit" component={ProfileEditScreen} />
    <MyStack.Screen name="Ranking" component={RankingScreen} />
    <MyStack.Screen name="SportRanking" component={SportRankingScreen} />
    <MyStack.Screen name="ClubRanking" component={ClubRankingScreen} />
    <MyStack.Screen name="Guide" component={GuideScreen} />
    <MyStack.Screen name="Pricing" component={PricingScreen} />
    <MyStack.Screen name="Donate" component={DonateScreen} />
    <MyStack.Screen name="SupportChat" component={SupportChatScreen} />
    {contentScreens.map(([name, title, kind]) => <MyStack.Screen key={name} name={name} component={ContentScreen} initialParams={{ title, kind }} />)}
  </MyStack.Navigator>;
}

export function AppNavigator() {
  const token = useAppSelector((state) => state.auth.token);
  return <Stack.Navigator screenOptions={{ headerShown: false }}>{token ? <Stack.Screen name="Main" component={MainTabs} /> : <><Stack.Screen name="Login" component={LoginScreen} /><Stack.Screen name="SignUp" component={SignUpScreen} /></>}</Stack.Navigator>;
}
