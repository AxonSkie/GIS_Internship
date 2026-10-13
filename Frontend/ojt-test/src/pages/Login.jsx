
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "./auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
  const checkExistingLogin = async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      return;
    }

    try {
      const userResponse = await api.get("/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const role = userResponse.data.role;

      if (role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/user";
      }

    } catch (error) {
      console.log("No valid login session");

      localStorage.removeItem("access_token");
    }
  };

  checkExistingLogin();
}, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await api.post("/auth/login", {
        email,
        password,
      });

      const token = response.data.access_token;

      localStorage.setItem("access_token", token);

      const userResponse = await api.get("/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Current user:", userResponse.data);

      const role = userResponse.data.role;

      if (role === "admin") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/user";
      }

    } catch (error) {
      console.error("Login failed:", error);
      setErrorMessage(error.response?.data?.detail || "Login failed. Check your details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <aside className="auth-aside">
          <Link className="auth-brand" to="/login" aria-label="Workspace sign in">
            <span className="auth-brand-mark" aria-hidden="true">W</span>
            <span>WORKSPACE</span>
          </Link>
          <div className="auth-aside-copy">
            <span className="auth-aside-kicker">PEOPLE & ACCESS</span>
            <p>OJT Test</p>
          </div>
          <div className="auth-aside-footer"><span /> A calmer way to work together</div>
        </aside>

        <section className="auth-main" aria-labelledby="auth-title">
          <div className="auth-form-wrap">
            <p className="auth-eyebrow">SAMPLE TEST FOR OJT</p>
            <h1 id="auth-title" className="auth-title">Welcome back</h1>
            <p className="auth-description">Sign in with your account details to continue.</p>

            <form className="auth-form" onSubmit={handleLogin}>
              <label className="auth-field">
                <span>Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </label>

              {errorMessage && <p className="auth-message is-error" role="alert">{errorMessage}</p>}

              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="auth-switch">Register Now! <Link to="/register">Create an account</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Login;





