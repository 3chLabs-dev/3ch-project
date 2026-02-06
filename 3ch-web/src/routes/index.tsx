import { createBrowserRouter } from "react-router-dom";
import AppShell from "../components/AppShell";
import Home from "../pages/Home";
import Login from "../pages/sign/Login";
import SignUp from "../pages/sign/SignUp";
import AuthSuccess from "../pages/util/AuthSuccess";
import LeagueCreationWizard from "../pages/league/LeagueCreationWizard";

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
      { path: "/auth/success", element: <AuthSuccess />},
    //   { path: "/match", element: <Match /> },
    //   { path: "/my", element: <My /> },

    ],
  },
//   { path: "/login", element: <Login /> },
]);
