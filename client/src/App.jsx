import React, { useState, useEffect } from 'react';
import DisclaimerBanner from './components/DisclaimerBanner';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import DataEntry from './pages/DataEntry';
import Verifications from './pages/Verifications';
import BRSRReport from './pages/BRSRReport';
import EmissionFactors from './pages/EmissionFactors';
import Scope3Roadmap from './pages/Scope3Roadmap';
import Entities from './pages/Entities';
import JuryDemo from './pages/JuryDemo';
import VerificationModal from './components/VerificationModal';
import { authAPI, verificationAPI } from './services/api';

const DEFAULT_PERSONAS = [
  { name: 'Dr. Arun Nambiar (Lead ESG Assurance Auditor)', email: 'auditor@meil.in', role: 'sustainability_auditor', roleTitle: 'Independent Sustainability Auditor (Checker Level 2)' },
  { name: 'Vikram Sharma (Site Engineer)', email: 'collector@meil.in', role: 'site_engineer', roleTitle: 'Site ESG Data Collector (Maker)' },
  { name: 'Priya Iyer (BU Sustainability Manager)', email: 'manager@meil.in', role: 'bu_manager', roleTitle: 'BU ESG Reviewer (Checker Level 1)' },
  { name: 'Chief Sustainability Officer (Admin)', email: 'admin@meil.in', role: 'corporate_admin', roleTitle: 'Chief Sustainability Officer & BRSR Lead' }
];

export default function App() {
  const [currentTab, setTab] = useState('dashboard');
  const [users, setUsers] = useState(DEFAULT_PERSONAS);
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [inspectMetric, setInspectMetric] = useState(null);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Establish initial authenticated session as lead auditor
      const loginRes = await authAPI.login('auditor@meil.in', 'meil123');
      localStorage.setItem('meil_auth_token', loginRes.data.token);
      const loggedInUser = loginRes.data.user;
      setCurrentUser(loggedInUser);

      // Only request full user directory if current user has corporate_admin privilege
      if (loggedInUser?.role === 'corporate_admin') {
        try {
          const userRes = await authAPI.getUsers();
          if (userRes.data?.users && userRes.data.users.length > 0) {
            setUsers(userRes.data.users);
          }
        } catch (err) {
          console.warn('Unable to load user directory:', err.message);
          setUsers(DEFAULT_PERSONAS);
        }
      } else {
        setUsers(DEFAULT_PERSONAS);
      }

      const pendingRes = await verificationAPI.getPending();
      setPendingCount(pendingRes.data.stats?.totalPending || 0);
    } catch (err) {
      console.error('Failed to initialize app data:', err);
      setUsers(DEFAULT_PERSONAS);
    }
  };

  const handleRefreshPending = async () => {
    try {
      const res = await verificationAPI.getPending();
      setPendingCount(res.data.stats?.totalPending || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSwitchUser = async (user) => {
    try {
      const loginRes = await authAPI.login(user.email, 'meil123');
      localStorage.setItem('meil_auth_token', loginRes.data.token);
      const switchedUser = loginRes.data.user;
      setCurrentUser(switchedUser);
      if (switchedUser?.role === 'corporate_admin') {
        try {
          const userRes = await authAPI.getUsers();
          if (userRes.data?.users && userRes.data.users.length > 0) {
            setUsers(userRes.data.users);
          }
        } catch {
          // Retain current personas if list call fails
        }
      }
      await handleRefreshPending();
      return switchedUser;
    } catch (err) {
      console.error('Failed to switch user session:', err);
      alert(`Session authentication failed for ${user.name}: ${err.response?.data?.message || err.message}`);
      throw err;
    }
  };

  const handleTabChange = async (tab) => {
    setTab(tab);
    if (tab === 'jury-demo' && currentUser?.role !== 'site_engineer') {
      const collectorPersona = DEFAULT_PERSONAS.find(p => p.role === 'site_engineer');
      if (collectorPersona) {
        try {
          await handleSwitchUser(collectorPersona);
        } catch {
          // ignore
        }
      }
    }
  };

  const handleInspectMetric = (metric) => {
    setInspectMetric(metric);
  };

  const handleConfirmInspectReview = async (metricId, reviewData) => {
    await verificationAPI.review(metricId, reviewData);
    await handleRefreshPending();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* 1. Mandatory Statutory Disclaimer Banner */}
      <DisclaimerBanner />

      {/* 2. Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        users={users}
        pendingCount={pendingCount}
      />

      {/* 3. Main Body with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          setTab={handleTabChange}
          pendingCount={pendingCount}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentTab === 'dashboard' && (
            <Dashboard
              setTab={handleTabChange}
              onInspectMetric={handleInspectMetric}
            />
          )}

          {currentTab === 'jury-demo' && (
            <JuryDemo
              currentUser={currentUser}
              onSwitchUser={handleSwitchUser}
            />
          )}

          {currentTab === 'data-entry' && (
            <DataEntry
              currentUser={currentUser}
              setTab={handleTabChange}
              onCreated={handleRefreshPending}
            />
          )}

          {currentTab === 'verifications' && (
            <Verifications
              currentUser={currentUser}
              onVerifiedRefresh={handleRefreshPending}
            />
          )}

          {currentTab === 'brsr-report' && (
            <BRSRReport />
          )}

          {currentTab === 'factors' && (
            <EmissionFactors />
          )}

          {currentTab === 'scope3' && (
            <Scope3Roadmap />
          )}

          {currentTab === 'entities' && (
            <Entities />
          )}
        </main>
      </div>

      {/* Quick Inspection Modal from Dashboard */}
      {inspectMetric && (
        <VerificationModal
          isOpen={!!inspectMetric}
          onClose={() => setInspectMetric(null)}
          metric={inspectMetric}
          onConfirmReview={handleConfirmInspectReview}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
