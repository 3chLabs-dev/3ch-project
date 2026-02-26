import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../app/hooks";

export default function AdminGuard() {
  const token = useAppSelector((s) => s.admin.token);
  if (!token) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
