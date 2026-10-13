import { useEffect, useState } from "react";
import api from "../services/api";
import "./admin.css";

function Admin() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    getUsers();
  }, []);


  useEffect(() => {
  const handlePageShow = async () => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      window.location.replace("/login");
      return;
    }

    try {
      await api.get("/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (error) {
      localStorage.removeItem("access_token");
      window.location.replace("/login");
    }
  };

  window.addEventListener("pageshow", handlePageShow);

  return () => {
    window.removeEventListener("pageshow", handlePageShow);
  };
}, []);
  async function getUsers() {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");

      const response = await api.get("/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(response.data);
    } catch (error) {
      console.error("Failed to get users:", error);

      alert(
        error.response?.data?.detail ||
        "Failed to load users"
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const token = localStorage.getItem("access_token");
      const formData = new FormData(event.currentTarget);

      await api.put(`/admin/users/${editingUser.id}`, {
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password"),
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEditingUser(null);
      await getUsers();
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete ${user.username}? This action cannot be undone.`)) return;

    setDeletingUserId(user.id);
    try {
      const token = localStorage.getItem("access_token");
      await api.delete(`/admin/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== user.id));
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }

  const filteredUsers = users.filter((user) =>
    [user.username, user.email, user.role, String(user.id)]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))
  );
    const adminCount = users.filter((user) => user.role === "admin").length;
    const handleLogout = () => {
  localStorage.removeItem("access_token");
  window.location.replace("/login");
};

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-topbar">
          <a className="admin-brand" href="/admin" aria-label="Admin home">
            <span className="admin-brand-mark" aria-hidden="true">A</span>
            <span>OJT <span className="admin-brand-divider">/</span> Admin</span>
          </a>
          <span className="admin-topbar-label"><button onClick={handleLogout}>
  Logout
</button></span>
        </header>

        <section className="admin-intro" aria-labelledby="admin-title">
          <div>
            <p className="admin-eyebrow">PEOPLE & ACCESS</p>
            <h1 id="admin-title">User directory</h1>
            <p className="admin-description">Manage the people and roles in your workspace.</p>
          </div>
          <button className="admin-refresh" type="button" onClick={getUsers} disabled={loading}>
            <span aria-hidden="true">↻</span>
            {loading ? "Loading" : "Refresh"}
          </button>
        </section>

        <section className="admin-stats" aria-label="User summary">
          <article className="admin-stat">
            <span className="admin-stat-label">TOTAL USERS</span>
            <strong>{users.length}</strong>
            <span className="admin-stat-note">in this workspace</span>
          </article>
          <article className="admin-stat admin-stat-accent">
            <span className="admin-stat-label">ADMINISTRATORS</span>
            <strong>{adminCount}</strong>
            <span className="admin-stat-note">with elevated access</span>
          </article>
          <article className="admin-stat admin-stat-wide">
            <span className="admin-stat-label">DIRECTORY STATUS</span>
            <strong className="admin-status"><span />{loading ? "Updating" : "Up to date"}</strong>
            <span className="admin-stat-note">Last checked just now</span>
          </article>
        </section>

        <section className="admin-directory" aria-labelledby="directory-title">
          <div className="admin-directory-heading">
            <div>
              <h2 id="directory-title">All users</h2>
              <p>{filteredUsers.length} {filteredUsers.length === 1 ? "person" : "people"}</p>
            </div>
            <label className="admin-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search users"
              />
              <kbd>/</kbd>
            </label>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">USER</th>
                  <th scope="col">EMAIL ADDRESS</th>
                  <th scope="col">ROLE</th>
                  <th scope="col">ID</th>
                  <th scope="col"><span className="visually-hidden">ACTIONS</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="admin-message" colSpan="5">Loading users...</td></tr>
                ) : filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-cell">
                          <span className="admin-avatar" aria-hidden="true">
                            {(user.username || user.email || "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="admin-username">{user.username}</span>
                        </div>
                      </td>
                      <td className="admin-email">{user.email}</td>
                      <td><span className={`admin-role ${user.role === "admin" ? "is-admin" : ""}`}>{user.role}</span></td>
                      <td className="admin-id">#{user.id}</td>
                      <td className="admin-actions-cell">
                        <button className="admin-row-action" type="button" onClick={() => setEditingUser(user)} aria-label={`Edit ${user.username}`}>
                          Edit
                        </button>
                        <button
                          className="admin-row-action is-danger"
                          type="button"
                          onClick={() => deleteUser(user)}
                          disabled={deletingUserId === user.id}
                          aria-label={`Delete ${user.username}`}
                        >
                          {deletingUserId === user.id ? "Deleting..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="admin-message" colSpan="5">
                      {search ? "No users match your search." : "No users found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="admin-table-footer">
            <span>Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> users</span>
            <span className="admin-secure-label"><span aria-hidden="true">●</span> Private workspace</span>
          </footer>
        </section>
        <footer className="admin-page-footer">WORKSPACE ADMINISTRATION <span>•</span> USER ACCESS</footer>
      </div>
      {editingUser && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditingUser(null);
        }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
            <div className="admin-modal-heading">
              <div>
                <p className="admin-eyebrow">USER ACCESS</p>
                <h2 id="edit-user-title">Edit user</h2>
              </div>
              <button className="admin-modal-close" type="button" onClick={() => setEditingUser(null)} disabled={saving} aria-label="Close edit user dialog">×</button>
            </div>
            <form className="admin-edit-form" onSubmit={updateUser}>
              <label>
                Username
                <input name="username" type="text" defaultValue={editingUser.username} autoComplete="username" required />
              </label>
              <label>
                Email address
                <input name="email" type="email" defaultValue={editingUser.email} autoComplete="email" required />
              </label>
              <label>
                New password
                <input name="password" type="password" autoComplete="new-password" minLength="1" required />
              </label>
              <div className="admin-modal-actions">
                <button className="admin-cancel" type="button" onClick={() => setEditingUser(null)} disabled={saving}>Cancel</button>
                <button className="admin-save" type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Admin;
