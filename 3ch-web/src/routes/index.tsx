import { createBrowserRouter } from "react-router-dom";
import AppShell from "../components/AppShell";
import AdminGuard from "../components/AdminGuard";
import AdminLogin from "../pages/admin/AdminLogin";
import AdminDashboard from "../pages/admin/AdminDashboard";
import Home from "../pages/Home";
import Login from "../pages/sign/Login";
import SignUp from "../pages/sign/SignUp";
import AuthSuccess from "../pages/util/AuthSuccess";
import AuthFail from "../pages/util/AuthFail";
import LeagueCreationWizard from "../pages/league/LeagueCreationWizard";
import MyPage from "../pages/mypage/MyPage.tsx"
import SocialSignUp from "../pages/sign/SocialSignUp.tsx";
import GroupMain from "../pages/group/GroupMain";
import GroupCreate from "../pages/group/GroupCreate";
import GroupManage from "../pages/group/GroupManage";
import GroupLeagueManage from "../pages/group/GroupLeagueManage";
import DrawMain from "../pages/draw/DrawMain";
import LeagueDetail from "../pages/league/LeagueDetail";
import LeagueBracket from "../pages/league/LeagueBracket.tsx";
import DrawList from "../pages/draw/DrawList";
import DrawDetail from "../pages/draw/DrawDetail";
import MemberCheckPage from "../pages/mypage/userinfo/MemberCheckPage.tsx";
import MemberEditPage from "../pages/mypage/userinfo/MemberEditPage.tsx";
import SettingsPage from "../pages/mypage/SettingsPage.tsx";
import PasswordHelpPage from "../pages/sign/findPassword/PasswordHelpPage.tsx";
import PasswordResetRequestPage from "../pages/sign/findPassword/PasswordResetRequestPage.tsx";
import NoticePage from "../pages/mypage/NoticePage.tsx";
import SupportCenterPage from "../pages/mypage/SupportCenterPage.tsx";
import DonatePage from "../pages/mypage/DonatePage.tsx";
import TermsPage from "../pages/mypage/TermsPage.tsx";
import PrivacyPolicyPage from "../pages/mypage/PrivacyPolicyPage.tsx";
// import League from "../pages/League";
// import Match from "../pages/Match";
// import My from "../pages/My";
// import Login from "../pages/Login";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/login", element: <Login />},
      { path: "/signup", element: <SignUp />},
      { path: "/league", element: <LeagueCreationWizard /> },
      { path: "/league/:id", element: <LeagueDetail /> },
      { path: "/league/:id/bracket", element: <LeagueBracket /> },
      { path: "/mypage", element: <MyPage />},
      { path: "/auth/success", element: <AuthSuccess />},
      { path: "/auth/fail", element: <AuthFail />},
      { path: "/social-signup", element: <SocialSignUp />},
      { path: "/club", element: <GroupMain /> },
      { path: "/club/create", element: <GroupCreate /> },
      { path: "/club/:id/manage", element: <GroupManage /> },
      { path: "/club/:id/manage/league", element: <GroupLeagueManage /> },
      { path: "/draw", element: <DrawMain /> },
      { path: "/draw/:leagueId", element: <DrawList /> },
      { path: "/draw/:leagueId/:drawId", element: <DrawDetail /> },
      { path: "/mypage/member/password-check", element: <MemberCheckPage />},
      { path: "/mypage/member/edit", element: <MemberEditPage />},
      { path: "/mypage/settings", element: <SettingsPage />},
      { path: "/password/help", element: <PasswordHelpPage />},
      { path: "/password/verify-email", element: <PasswordResetRequestPage />},
      { path: "/mypage/notice", element: <NoticePage />},
      { path: "/mypage/support", element: <SupportCenterPage />},
      { path: "/mypage/donate", element: <DonatePage />},
      { path: "/mypage/terms", element: <TermsPage />},
      { path: "/mypage/privacy", element: <PrivacyPolicyPage />},


    //   { path: "/my", element: <My /> },

    ],
  },
  // 어드민 (AppShell 밖 - 별도 레이아웃)
  { path: "/admin/login", element: <AdminLogin /> },
  {
    element: <AdminGuard />,
    children: [
      { path: "/admin", element: <AdminDashboard /> },
    ],
  },
]);
