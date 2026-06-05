import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserData from "./pages/UserData";
import Scenarios from "./pages/Scenarios";
import TaxLaw from "./pages/TaxLaw";
import Reports from "./pages/Reports";
import Documents from "./pages/Documents";
import Planning from "./pages/Planning";
import TaxForms from "./pages/TaxForms";

function AppShell() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/user-data" element={<UserData />} />
            <Route path="/scenarios" element={<Scenarios />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/tax-law" element={<TaxLaw />} />
            <Route path="/tax-forms" element={<TaxForms />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </AuthProvider>
  );
}
