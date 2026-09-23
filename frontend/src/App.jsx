import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import Login from './pages/Login.jsx';

import WebLayout from './pages/web/Layout.jsx';
import Dashboard from './pages/web/Dashboard.jsx';
import Housing from './pages/web/Housing.jsx';
import Users from './pages/web/Users.jsx';
import Bills from './pages/web/Bills.jsx';
import Payments from './pages/web/Payments.jsx';
import Finance from './pages/web/Finance.jsx';
import Complaints from './pages/web/Complaints.jsx';
import Announcements from './pages/web/Announcements.jsx';
import Logs from './pages/web/Logs.jsx';
import SettingsPage from './pages/web/Settings.jsx';

import WargaLayout from './pages/warga/Layout.jsx';
import WargaHome from './pages/warga/Home.jsx';
import WargaBills from './pages/warga/Bills.jsx';
import WargaGuests from './pages/warga/Guests.jsx';
import WargaComplaints from './pages/warga/Complaints.jsx';
import WargaNotif from './pages/warga/Notifications.jsx';

import GateLayout from './pages/gate/Layout.jsx';
import GateScan from './pages/gate/Scan.jsx';
import GateBook from './pages/gate/GuestBook.jsx';
import GateActivity from './pages/gate/Activity.jsx';

function RequireAuth({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />

      {/* Web Dashboard — Super Admin & Pengurus */}
      <Route path="/app" element={<RequireAuth roles={['super_admin', 'pengurus']}><WebLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="housing" element={<Housing />} />
        <Route path="users" element={<RequireAuth roles={['super_admin']}><Users /></RequireAuth>} />
        <Route path="bills" element={<Bills />} />
        <Route path="payments" element={<Payments />} />
        <Route path="finance" element={<Finance />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="logs" element={<RequireAuth roles={['super_admin']}><Logs /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth roles={['super_admin']}><SettingsPage /></RequireAuth>} />
      </Route>

      {/* Mobile App — Warga (staff boleh pratinjau) */}
      <Route path="/m" element={<RequireAuth roles={['warga', 'super_admin', 'pengurus']}><WargaLayout /></RequireAuth>}>
        <Route index element={<WargaHome />} />
        <Route path="bills" element={<WargaBills />} />
        <Route path="guests" element={<WargaGuests />} />
        <Route path="complaints" element={<WargaComplaints />} />
        <Route path="notifications" element={<WargaNotif />} />
      </Route>

      {/* Mobile App — Satpam / Pos Gerbang */}
      <Route path="/gate" element={<RequireAuth roles={['satpam', 'super_admin', 'pengurus']}><GateLayout /></RequireAuth>}>
        <Route index element={<GateScan />} />
        <Route path="book" element={<GateBook />} />
        <Route path="activity" element={<GateActivity />} />
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
