import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import "./auth.css";

function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await api.post("/auth/register", {
        username,
        email,
        password,
      });

      setSuccessMessage("Your account is ready. You can sign in now.");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Registration failed:", error);
      setErrorMessage(error.response?.data?.detail || "Registration failed. Please try again.");
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
            <p>OJT TEST</p>
          </div>
          <div className="auth-aside-footer"><span /> A calmer way to work together</div>
        </aside>

        <section className="auth-main" aria-labelledby="auth-title">
          <div className="auth-form-wrap">
            <p className="auth-eyebrow">GET STARTED</p>
            <h1 id="auth-title" className="auth-title">Create your account</h1>
            <p className="auth-description">Set up your workspace account in a few details.</p>

            <form className="auth-form" onSubmit={handleRegister}>
              <label className="auth-field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Choose a username"
                  required
                />
              </label>

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
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                />
              </label>

              {errorMessage && <p className="auth-message is-error" role="alert">{errorMessage}</p>}
              {successMessage && <p className="auth-message is-success" role="status">{successMessage} <Link to="/login">Sign in</Link></p>}

              <button className="auth-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating account..." : "Create account"}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Register;