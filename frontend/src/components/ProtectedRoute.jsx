import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <span className="text-gray-500 text-sm animate-pulse">Loading…</span>
      </div>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
