import { createBrowserRouter } from "react-router-dom";
import AppShell from "../components/Appshell";
import Home from "../pages/Home";
// import League from "../pages/League";
// import Match from "../pages/Match";
// import My from "../pages/My";
// import Login from "../pages/Login";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
    //   { path: "/league", element: <League /> },
    //   { path: "/match", element: <Match /> },
    //   { path: "/my", element: <My /> },
    ],
  },
//   { path: "/login", element: <Login /> },
]);
