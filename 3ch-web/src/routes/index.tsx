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
import MemberCheckPage from "../pages/mypage/userinfo/MemberCheckPage.tsx";
import MemberEditPage from "../pages/mypage/userinfo/MemberEditPage.tsx";

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
      { path: "/mypage", element: <MyPage />},
      { path: "/auth/success", element: <AuthSuccess />},
      { path: "/auth/fail", element: <AuthFail />},
      { path: "/social-signup", element: <SocialSignUp />},
      { path: "/member/password-check", element: <MemberCheckPage />},
      { path: "/member/edit", element: <MemberEditPage />},
    //   { path: "/match", element: <Match /> },
    //   { path: "/my", element: <My /> },

    ],
  },
//   { path: "/login", element: <Login /> },
]);
