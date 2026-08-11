import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext.jsx";
import Protected from "./components/Protected.jsx";
import Shell from "./components/Shell.jsx";
import AuthScreen from "./pages/AuthScreen.jsx";

export default function App() {
  const { user } = useAuth();
  const authed = useMemo(() => Boolean(user), [user]);

  return (
    <Routes>
      <Route path="/auth" element={authed ? <Navigate to="/" replace /> : <AuthScreen />} />
      <Route path="/*" element={<Protected><Shell /></Protected>} />
    </Routes>
  );
}
