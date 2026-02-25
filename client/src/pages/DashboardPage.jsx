import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import {
  requestNotificationPermission,
  sendNotification,
  scheduleReminder,
  cacheData,
  getCachedData,
} from '../utils/notifications';
import {
  Clock, CheckCircle2, AlertTriangle, Pill, BarChart3, Bot,
  RefreshCw, ChevronRight, Package, UserCheck,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();

  const [doseLogs, setDoseLogs]     = useState([]);
  const [medicines, setMedicines]   = useState([]);
  const [refillAlerts, setRefillAlerts] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [greeting, setGreeting]     = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12)      setGreeting('Good Morning');
    else if (hour < 17) setGreeting('Good Afternoon');
    else                setGreeting('Good Evening');

    requestNotificationPermission();
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      await api.generateLogs().catch(() => {});

      const [logsData, medsData, refillData] = await Promise.all([
        api.getTodayLogs(),
        api.getMedicines(),
        api.getRefillAlerts(),
      ]);

      setDoseLogs(logsData);
      setMedicines(medsData);
      setRefillAlerts(refillData);

      cacheData('doseLogs', logsData);
      cacheData('medicines', medsData);

      medsData.forEach(med => {
        (med.timeSlots || []).forEach(slot => scheduleReminder(med, slot));
      });
    } catch (err) {
      const cached = getCachedData('doseLogs');
      if (cached) setDoseLogs(cached);
      const cachedMeds = getCachedData('medicines');
      if (cachedMeds) setMedicines(cachedMeds);
    } finally {
      setLoading(false);
    }
  }

  async function handleTakeDose(logId) {
    try {
      const updated = await api.markDoseTaken(logId);
      setDoseLogs(prev => prev.map(l => l._id === logId ? updated : l));
      sendNotification('✅ Dose Recorded', 'Great job! Keep it up!');
    } catch (err) {
      console.error(err);
    }
  }

  const totalToday   = doseLogs.length;
  const takenToday   = doseLogs.filter(l => l.taken).length;
  const missedToday  = doseLogs.filter(l => l.missed).length;
  const pendingToday = totalToday - takenToday - missedToday;
  const progressPct  = totalToday > 0 ? Math.round((takenToday / totalToday) * 100) : 0;

  const groupedLogs = {
    morning:   doseLogs.filter(l => { const h = new Date(l.scheduledTime).getHours(); return h >= 4 && h < 12; }),
    afternoon: doseLogs.filter(l => { const h = new Date(l.scheduledTime).getHours(); return h >= 12 && h < 17; }),
    night:     doseLogs.filter(l => { const h = new Date(l.scheduledTime).getHours(); return h >= 17 || h < 4; }),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 dark:text-gray-400 text-elder-base mt-1">
            {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={loadData} className="btn-ghost flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Caregiver info banner — only shown to elderly users who have a caregiver linked */}
      {user?.role === 'elderly' && user?.caregiverName && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800/30">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold flex-shrink-0">
            {user.caregiverName[0]}
          </div>
          <div>
            <p className="text-xs text-brand-500 font-semibold uppercase tracking-wide">Your Caregiver</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-1">
              <UserCheck className="w-4 h-4 text-brand-500" />
              {user.caregiverName}
            </p>
          </div>
          <p className="ml-auto text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
            Manages your medicine settings
          </p>
        </div>
      )}

      {/* Progress card */}
      <div className="card !p-0 overflow-hidden bg-gradient-to-r from-brand-500 to-brand-600 !border-0">
        <div className="p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-brand-100 text-sm font-medium">Today's Progress</p>
              <p className="text-4xl font-bold mt-1">{progressPct}%</p>
            </div>
            <div className="w-20 h-20 relative">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${progressPct}, 100`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-200" />
              <p className="text-2xl font-bold">{takenToday}</p>
              <p className="text-xs text-brand-100">Taken</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
              <Clock className="w-5 h-5 mx-auto mb-1 text-yellow-200" />
              <p className="text-2xl font-bold">{pendingToday}</p>
              <p className="text-xs text-brand-100">Pending</p>
            </div>
            <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-200" />
              <p className="text-2xl font-bold">{missedToday}</p>
              <p className="text-xs text-brand-100">Missed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refill alerts */}
      {refillAlerts.length > 0 && (
        <div className="card !bg-warm-50 dark:!bg-warm-500/10 !border-warm-200 dark:!border-warm-500/20">
          <div className="flex items-start gap-3">
            <Package className="w-6 h-6 text-warm-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-warm-700 dark:text-warm-400">Refill Needed Soon</h3>
              {refillAlerts.map((alert, i) => (
                <p key={i} className="text-warm-600 dark:text-warm-300 text-sm mt-1">
                  <span className="font-bold">{alert.medicine.name}</span> —{' '}
                  {alert.daysLeft <= 0 ? 'Overdue!' : `${alert.daysLeft} days left`}
                  {alert.medicine.pillsRemaining !== undefined && ` (${alert.medicine.pillsRemaining} pills)`}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Today's schedule */}
      <div>
        <h2 className="section-title mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-brand-500" />
          Today's Schedule
        </h2>

        {doseLogs.length === 0 ? (
          <div className="card text-center py-12">
            <Pill className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No medicines scheduled today</p>
            <Link to="/medicines" className="btn-primary inline-flex items-center gap-2 mt-4">
              <Pill className="w-5 h-5" /> Add Medicine
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedLogs).map(([period, logs]) => {
              if (logs.length === 0) return null;
              const emojis = { morning: '🌅', afternoon: '☀️', night: '🌙' };
              return (
                <div key={period}>
                  <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>{emojis[period]}</span> {period}
                  </h3>
                  <div className="space-y-2">
                    {logs.map(log => (
                      <DoseLogItem key={log._id} log={log} onTake={handleTakeDose} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link to="/medicines" className="card flex items-center gap-4 !p-4 group">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Pill className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">Medicines</p>
            <p className="text-sm text-gray-500">{medicines.length} active</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </Link>

        <Link to="/summary" className="card flex items-center gap-4 !p-4 group">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">Weekly Report</p>
            <p className="text-sm text-gray-500">View adherence</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </Link>

        <Link to="/ai-assistant" className="card flex items-center gap-4 !p-4 group">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">AI Assistant</p>
            <p className="text-sm text-gray-500">Get suggestions</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </Link>
      </div>
    </div>
  );
}

function DoseLogItem({ log, onTake }) {
  const med = log.medicineId;
  const scheduledTime = new Date(log.scheduledTime);
  const now = new Date();
  const isPast = now >= scheduledTime;
  const isWithinTakeWindow = isPast && now <= new Date(scheduledTime.getTime() + 30 * 60 * 1000);
  const timeStr = scheduledTime.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`p-4 rounded-xl flex items-center gap-4 transition-all ${
      log.taken  ? 'bg-brand-50 dark:bg-brand-900/30' :
      log.missed ? 'bg-danger-50 dark:bg-danger-500/10' :
                   'bg-white dark:bg-gray-700/50'
    }`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
        log.taken  ? 'bg-brand-500' :
        log.missed ? 'bg-danger-400' :
                     'bg-gray-200 dark:bg-gray-600'
      }`}>
        {log.taken  ? <CheckCircle2 className="w-6 h-6 text-white" /> :
         log.missed ? <AlertTriangle className="w-6 h-6 text-white" /> :
                      <Pill className="w-6 h-6 text-gray-500 dark:text-gray-300" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 dark:text-white">{med?.name || 'Unknown'}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{med?.dosage} · {timeStr}</p>
      </div>

      <div className="flex-shrink-0">
        {log.taken ? (
          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">Done ✓</span>
        ) : log.missed ? (
          <span className="text-sm font-semibold text-danger-500">Missed</span>
        ) : isWithinTakeWindow ? (
          <button onClick={() => onTake(log._id)} className="btn-primary">Take</button>
        ) : (
          <span className="text-sm text-gray-400">{!isPast ? 'Upcoming' : 'Pending'}</span>
        )}
      </div>
    </div>
  );
}
