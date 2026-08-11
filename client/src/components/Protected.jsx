import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";

export default function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/auth" replace />;
}
