import { createBrowserRouter } from "react-router-dom";
import AppShell from "../components/AppShell";
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
      { path: "/mypage", element: <MyPage />},
      { path: "/auth/success", element: <AuthSuccess />},
      { path: "/auth/fail", element: <AuthFail />},
      { path: "/social-signup", element: <SocialSignUp />},
      { path: "/group", element: <GroupMain /> },
      { path: "/group/create", element: <GroupCreate /> },
      { path: "/group/:id/manage", element: <GroupManage /> },
      { path: "/group/:id/manage/league", element: <GroupLeagueManage /> },
      { path: "/draw", element: <DrawMain /> },
      { path: "/member/password-check", element: <MemberCheckPage />},
      { path: "/member/edit", element: <MemberEditPage />},
      { path: "/settings", element: <SettingsPage />},
      { path: "/password/help", element: <PasswordHelpPage />},
      { path: "/password/verify-email", element: <PasswordResetRequestPage />},
      { path: "/notice", element: <NoticePage />},
      { path: "/support", element: <SupportCenterPage />},
      { path: "/donate", element: <DonatePage />},
      { path: "/terms", element: <TermsPage />},
      { path: "/privacy", element: <PrivacyPolicyPage />},


    //   { path: "/my", element: <My /> },

    ],
  },
//   { path: "/login", element: <Login /> },
]);
