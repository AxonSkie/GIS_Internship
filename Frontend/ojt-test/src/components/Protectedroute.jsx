import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";

function ProtectedRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkToken = async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setIsAuthenticated(false);
      setIsChecking(false);
      return;
    }

    try {
      await api.get("/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setIsAuthenticated(true);
    } catch (error) {
      localStorage.removeItem("access_token");
      setIsAuthenticated(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkToken();

    const handlePageShow = () => {
      checkToken();
    };

    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  if (isChecking) {
    return <div>Checking login...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;