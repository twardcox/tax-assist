import { useQuery } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/user-data", label: "My Data" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/documents", label: "Documents" },
  { to: "/planning", label: "Planning" },
  { to: "/tax-law", label: "Tax Law" },
  { to: "/reports", label: "Reports" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: alertData } = useQuery({
    queryKey: ["tax-law-alert-count"],
    queryFn: api.getAlertCount,
    refetchInterval: 60_000,
  });
  const alertCount = alertData?.count ?? 0;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
      <span className="text-emerald-400 font-bold tracking-wide mr-4">UTBIS</span>
      {links.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `text-sm transition-colors inline-flex items-center gap-1 ${
              isActive
                ? "text-white border-b border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`
          }
        >
          {label}
          {label === "Tax Law" && alertCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {alertCount > 99 ? "99+" : alertCount}
            </span>
          )}
        </NavLink>
      ))}

      {/* Spacer + user info */}
      <div className="ml-auto flex items-center gap-3">
        {user && (
          <span className="text-xs text-gray-500 truncate max-w-[160px]">
            {user.display_name || user.email}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
