import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Admin from "./pages/admin";
import ProtectedRoute from "./components/Protectedroute";
import User from "./pages/user";
import AdminRoute from "./components/AdminRoute";
import MasterFile from "./pages/MasterFile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
  path="/user"
  element={
    <ProtectedRoute>
      <User />
    </ProtectedRoute>
    
  }
        />

        <Route
  path="/master-file"
  element={
    <ProtectedRoute>
      <MasterFile />
    </ProtectedRoute>
  }
/>
        <Route
  path="/admin"
  element={
    <AdminRoute>
      <Admin />
    </AdminRoute>
  }
/>


      </Routes>
    </BrowserRouter>
  );
}

export default App;
