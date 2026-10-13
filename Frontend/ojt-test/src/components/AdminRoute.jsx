import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";

function AdminRoute({ children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem("access_token");

      if (!token) {
        setStatus("unauthenticated");
        return;
      }

      try {
        const response = await api.get("/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.role === "admin") {
          setStatus("admin");
        } else {
          setStatus("user");
        }
      } catch (error) {
        localStorage.removeItem("access_token");
        setStatus("unauthenticated");
      }
    };

    checkAdmin();
  }, []);

  if (status === "checking") {
    return <div>Checking authentication...</div>;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "user") {
    return <Navigate to="/user" replace />;
  }

  return children;
}

export default AdminRoute;