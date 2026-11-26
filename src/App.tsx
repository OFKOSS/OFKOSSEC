import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";
import { RequireAdmin, RequireAuth } from "@/components/layout/RouteGuards";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import OfficerLogin from "@/pages/OfficerLogin";
import Elections from "@/pages/Elections";
import ElectionDetail from "@/pages/ElectionDetail";
import Results from "@/pages/Results";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminInsights from "@/pages/admin/AdminInsights";
import NewElection from "@/pages/admin/NewElection";
import EditElection from "@/pages/admin/EditElection";
import AdminResults from "@/pages/admin/AdminResults";
import AdminVoters from "@/pages/admin/AdminVoters";
import AdminAudit from "@/pages/admin/AdminAudit";
import DeletedElections from "@/pages/admin/DeletedElections";

/** Reset scroll position whenever the route changes. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export default function App() {
  useAuthBootstrap();

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/officer/login" element={<OfficerLogin />} />

        <Route path="/elections" element={<Elections />} />
        <Route path="/elections/:id" element={<ElectionDetail />} />
        <Route path="/elections/:id/results" element={<Results />} />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/voters"
          element={
            <RequireAdmin>
              <AdminVoters />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/insights"
          element={
            <RequireAdmin>
              <AdminInsights />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RequireAdmin>
              <AdminAudit />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/deleted"
          element={
            <RequireAdmin>
              <DeletedElections />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/elections/new"
          element={
            <RequireAdmin>
              <NewElection />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/elections/:id"
          element={
            <RequireAdmin>
              <EditElection />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/elections/:id/results"
          element={
            <RequireAdmin>
              <AdminResults />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
