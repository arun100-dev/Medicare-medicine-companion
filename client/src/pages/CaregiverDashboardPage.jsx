import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import CaregiverPINModal from '../components/CaregiverPINModal';
import {
  Users, Pill, Clock, Calendar, AlertCircle, X, Package,
  Edit3, Trash2, Plus, ChevronRight, UserCheck, Shield, ArrowLeft,
  BarChart3, TrendingUp, CheckCircle2, AlertTriangle, Award,
} from 'lucide-react';

// Tab options when viewing a patient
const TABS = { medicines: 'Medicines', report: 'Weekly Report' };

export default function CaregiverDashboardPage() {
  const { user, caregiverVerified, expireCaregiverSession, setActivePatientId } = useAuth();

  const [patients, setPatients]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab]       = useState('medicines');

  // medicines state
  const [medicines, setMedicines]       = useState([]);
  const [medLoading, setMedLoading]     = useState(false);
  const [showMedForm, setShowMedForm]   = useState(false);
  const [editingMed, setEditingMed]     = useState(null);

  // weekly report state
  const [summary, setSummary]           = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // PIN modal state
  const [showPINModal, setShowPINModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    setLoading(true);
    try {
      const data = await api.getPatients();
      setPatients(data.patients || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function selectPatient(patient) {
    setSelectedPatient(patient);
    setActivePatientId(patient._id);
    setActiveTab('medicines');
    expireCaregiverSession(); // fresh PIN for every patient switch

    setMedLoading(true);
    try {
      const meds = await api.getMedicines(patient._id);
      setMedicines(meds);
    } catch (e) {
      console.error(e);
    } finally {
      setMedLoading(false);
    }
  }

  async function loadWeeklyReport(patientId) {
    setSummaryLoading(true);
    try {
      const data = await api.getWeeklySummary(patientId);
      setSummary(data);
    } catch (e) {
      console.error(e);
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'report' && !summary) {
      loadWeeklyReport(selectedPatient._id);
    }
  }

  function backToList() {
    setSelectedPatient(null);
    setActivePatientId(null);
    expireCaregiverSession();
    setSummary(null);
  }

  // Wrap any write action with PIN check
  function requirePIN(action) {
    if (caregiverVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPINModal(true);
    }
  }

  function handleAdd()        { requirePIN(() => { setEditingMed(null); setShowMedForm(true); }); }
  function handleEdit(med)    { requirePIN(() => { setEditingMed(med);  setShowMedForm(true); }); }

  function handleDelete(med) {
    requirePIN(async () => {
      if (!confirm(`Delete "${med.name}" for ${selectedPatient.name}?`)) return;
      try {
        await api.deleteMedicine(med._id, selectedPatient._id);
        setMedicines(prev => prev.filter(m => m._id !== med._id));
      } catch (e) {
        alert(e.message);
      }
    });
  }

  async function handleSave(formData) {
    try {
      if (editingMed) {
        const updated = await api.updateMedicine(editingMed._id, formData, selectedPatient._id);
        setMedicines(prev => prev.map(m => m._id === updated._id ? updated : m));
      } else {
        const added = await api.addMedicine(formData, selectedPatient._id);
        setMedicines(prev => [added, ...prev]);
      }
      setShowMedForm(false);
      setEditingMed(null);
    } catch (e) {
      alert(e.message);
    }
  }

  const freqLabel = f => ({
    daily: 'Once daily', twice_daily: 'Twice daily',
    thrice_daily: 'Three times', weekly: 'Weekly', as_needed: 'As needed',
  }[f] || f);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Patient detail view ────────────────────────────────────────────────────
  if (selectedPatient) {
    return (
      <div className="space-y-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={backToList} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold text-lg">
                {selectedPatient.name[0]}
              </div>
              <div>
                <h1 className="font-display text-elder-xl text-gray-900 dark:text-white leading-tight">
                  {selectedPatient.name}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedPatient.email}</p>
              </div>
            </div>
          </div>
          {activeTab === 'medicines' && (
            <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" /> Add Medicine
            </button>
          )}
        </div>

        {/* PIN status */}
        <div className={`rounded-2xl p-3 flex items-center gap-3 text-sm font-medium border ${
          caregiverVerified
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700/30'
            : 'bg-warm-50 dark:bg-warm-900/20 text-warm-700 dark:text-warm-400 border-warm-200 dark:border-warm-700/30'
        }`}>
          <Shield className="w-4 h-4 flex-shrink-0" />
          {caregiverVerified
            ? '✅ PIN verified — you can edit medicines for 5 minutes'
            : '🔒 Enter PIN to add, edit or delete medicines for this patient'}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          {Object.entries(TABS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {key === 'medicines' ? <span className="flex items-center justify-center gap-1.5"><Pill className="w-4 h-4" />{label}</span>
                : <span className="flex items-center justify-center gap-1.5"><BarChart3 className="w-4 h-4" />{label}</span>}
            </button>
          ))}
        </div>

        {/* Medicines tab */}
        {activeTab === 'medicines' && (
          medLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : medicines.length === 0 ? (
            <div className="card text-center py-14">
              <Pill className="w-14 h-14 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No medicines added for this patient yet</p>
              <button onClick={handleAdd} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-5 h-5" /> Add Medicine
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {medicines.map(med => (
                <div key={med._id} className="card !p-0 overflow-hidden">
                  <div className="p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
                      <Pill className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{med.name}</h3>
                          <p className="text-gray-500 text-sm">{med.dosage} · {freqLabel(med.frequency)}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => handleEdit(med)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-400 hover:text-brand-500 transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(med)} className="p-2 rounded-xl hover:bg-danger-50 dark:hover:bg-danger-500/10 text-gray-400 hover:text-danger-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {med.category && <span className="badge-green text-xs">{med.category}</span>}
                        {(med.timeSlots || []).map((slot, i) => (
                          <span key={i} className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {slot.time} {slot.period}
                          </span>
                        ))}
                        {med.pillsRemaining !== undefined && med.pillsRemaining <= 10 && (
                          <span className="badge-red text-xs flex items-center gap-1">
                            <Package className="w-3 h-3" /> {med.pillsRemaining} pills left
                          </span>
                        )}
                      </div>
                      {med.precautions && (
                        <div className="mt-2 p-2 rounded-xl bg-warm-50 dark:bg-warm-500/10 border border-warm-200/50">
                          <p className="text-xs text-warm-600 dark:text-warm-400 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            {med.precautions}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 flex items-center text-xs text-gray-400 gap-1">
                    <Calendar className="w-3 h-3" /> Started {new Date(med.startDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* Weekly Report tab */}
        {activeTab === 'report' && (
          summaryLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : !summary ? (
            <div className="card text-center py-14">
              <BarChart3 className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">No data available yet</p>
            </div>
          ) : (
            <WeeklyReportView summary={summary} patientName={selectedPatient.name} />
          )
        )}

        {/* Medicine form modal */}
        {showMedForm && (
          <MedicineFormModal
            medicine={editingMed}
            onSave={handleSave}
            onClose={() => { setShowMedForm(false); setEditingMed(null); }}
          />
        )}

        {/* PIN modal */}
        <CaregiverPINModal
          isOpen={showPINModal}
          patientId={selectedPatient._id}
          onClose={() => { setShowPINModal(false); setPendingAction(null); }}
          onVerified={() => { if (pendingAction) pendingAction(); setPendingAction(null); }}
          action={`manage medicines for ${selectedPatient.name}`}
        />
      </div>
    );
  }

  // ── Patient list ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-3">
          <Users className="w-8 h-8 text-brand-500" /> My Patients
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {patients.length} patient{patients.length !== 1 ? 's' : ''} linked to you
        </p>
      </div>

      {/* Caregiver code card */}
      <div className="card bg-gradient-to-r from-brand-500 to-brand-600 !border-0 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-5 h-5" />
          <span className="font-semibold">Your Caregiver Code</span>
        </div>
        <div className="text-3xl font-mono font-bold tracking-widest mb-2">
          {user?.caregiverCode || '------'}
        </div>
        <p className="text-brand-100 text-sm">
          Share this code with your patients. They need it to register and link your account.
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-16 h-16 text-gray-200 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No patients linked yet</p>
          <p className="text-gray-400 text-sm">Share your caregiver code above with your patients so they can link you during signup.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {patients.map(patient => (
            <button
              key={patient._id}
              onClick={() => selectPatient(patient)}
              className="card text-left hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                {patient.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white">{patient.name}</h3>
                <p className="text-gray-500 text-sm">{patient.email}</p>
                <div className="flex items-center gap-1 mt-1">
                  <UserCheck className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">Linked patient</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-500 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Weekly report sub-component ────────────────────────────────────────────────
function WeeklyReportView({ summary, patientName }) {
  const { adherencePercent, taken, missed, pending, total, byMedicine, daily } = summary;
  const maxDayTotal = Math.max(...daily.map(d => d.total), 1);

  const getColor = pct => pct >= 90 ? 'text-brand-500' : pct >= 70 ? 'text-warm-500' : 'text-danger-500';
  const getEmoji = pct => pct >= 90 ? '🌟' : pct >= 70 ? '💪' : pct >= 50 ? '📈' : '⚠️';

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Showing last 7 days for <span className="font-semibold text-gray-700 dark:text-gray-200">{patientName}</span>
      </p>

      {/* Score card */}
      <div className="card !p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 to-brand-600 p-8 text-center text-white">
          <p className="text-brand-100 font-medium mb-2">Adherence Score</p>
          <div className="flex items-center justify-center gap-4">
            <span className="text-7xl font-bold">{adherencePercent}%</span>
            <span className="text-5xl">{getEmoji(adherencePercent)}</span>
          </div>
          <p className="mt-3 text-brand-100 text-lg">
            {adherencePercent >= 90 ? 'Excellent! Keep it up!' :
             adherencePercent >= 70 ? 'Good progress! Stay consistent.' :
             'Room for improvement. Check in with patient.'}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700">
          <div className="p-5 text-center">
            <CheckCircle2 className="w-6 h-6 text-brand-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{taken}</p>
            <p className="text-sm text-gray-500">Taken</p>
          </div>
          <div className="p-5 text-center">
            <AlertTriangle className="w-6 h-6 text-danger-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{missed}</p>
            <p className="text-sm text-gray-500">Missed</p>
          </div>
          <div className="p-5 text-center">
            <Clock className="w-6 h-6 text-warm-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{pending}</p>
            <p className="text-sm text-gray-500">Pending</p>
          </div>
        </div>
      </div>

      {/* Daily bar chart */}
      <div className="card">
        <h3 className="section-title mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-500" /> Daily Breakdown
        </h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {daily.map((day, i) => {
            const takenH  = day.total > 0 ? (day.taken  / maxDayTotal) * 100 : 0;
            const missedH = day.total > 0 ? (day.missed / maxDayTotal) * 100 : 0;
            const isToday = i === daily.length - 1;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col items-center" style={{ height: '160px', justifyContent: 'flex-end' }}>
                  {day.missed > 0 && (
                    <div className="w-full max-w-[40px] bg-danger-400/80 rounded-t-lg transition-all duration-500"
                         style={{ height: `${missedH}%`, minHeight: '8px' }} />
                  )}
                  <div className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${isToday ? 'bg-brand-500' : 'bg-brand-400/70'}`}
                       style={{ height: `${takenH}%`, minHeight: day.taken > 0 ? '8px' : 0, borderRadius: day.missed > 0 ? '0' : '8px 8px 0 0' }} />
                </div>
                <div className="text-center">
                  <p className={`text-xs font-bold ${isToday ? 'text-brand-500' : 'text-gray-400'}`}>{day.dayName}</p>
                  <p className="text-[10px] text-gray-400">{day.taken}/{day.total}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded bg-brand-400" /> Taken</div>
          <div className="flex items-center gap-2 text-xs text-gray-500"><div className="w-3 h-3 rounded bg-danger-400" /> Missed</div>
        </div>
      </div>

      {/* By medicine */}
      <div className="card">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-500" /> By Medicine
        </h3>
        <div className="space-y-4">
          {Object.entries(byMedicine).map(([name, data]) => {
            const pct = data.total > 0 ? Math.round((data.taken / data.total) * 100) : 0;
            return (
              <div key={name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{name}</span>
                  <span className={`font-bold ${getColor(pct)}`}>{pct}%</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all duration-700"
                       style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{data.taken} taken · {data.missed} missed · {data.total} total</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Medicine form modal ────────────────────────────────────────────────────────
function MedicineFormModal({ medicine, onSave, onClose }) {
  const [form, setForm] = useState({
    name:           medicine?.name           || '',
    dosage:         medicine?.dosage         || '',
    frequency:      medicine?.frequency      || 'daily',
    timeSlots:      medicine?.timeSlots      || [{ time: '08:00', hour: '08', minute: '00', period: 'AM' }],
    category:       medicine?.category       || '',
    precautions:    medicine?.precautions    || '',
    refillInterval: medicine?.refillInterval || 30,
    pillsRemaining: medicine?.pillsRemaining || 30,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function parseSlot(slot) {
    if (slot.hour && slot.minute) return slot;
    const [hStr, mStr] = (slot.time || '08:00').split(':');
    let h = parseInt(hStr, 10);
    const period = slot.period || (h >= 12 ? 'PM' : 'AM');
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { ...slot, hour: String(h).padStart(2, '0'), minute: mStr || '00', period };
  }

  function handleTimeSlotChange(index, field, value) {
    const slots = [...form.timeSlots];
    slots[index] = { ...slots[index], [field]: value };
    if (['hour', 'minute', 'period'].includes(field)) {
      const s = slots[index];
      let h24 = parseInt(field === 'hour' ? value : s.hour, 10);
      const min = field === 'minute' ? value : s.minute;
      const per = field === 'period' ? value : s.period;
      if (per === 'AM' && h24 === 12) h24 = 0;
      if (per === 'PM' && h24 !== 12) h24 += 12;
      slots[index].time = `${String(h24).padStart(2, '0')}:${min}`;
    }
    set('timeSlots', slots);
  }

  const addSlot    = () => set('timeSlots', [...form.timeSlots, { time: '20:00', hour: '08', minute: '00', period: 'PM' }]);
  const removeSlot = i  => set('timeSlots', form.timeSlots.filter((_, idx) => idx !== i));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, refillInterval: Number(form.refillInterval), pillsRemaining: Number(form.pillsRemaining) });
    setSaving(false);
  }

  const categories = ['Blood Pressure', 'Diabetes', 'Cholesterol', 'Thyroid', 'Heart', 'Pain Relief', 'Vitamins', 'Other'];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="card !p-0 w-full max-w-lg my-8 animate-scale-in">
        <div className="flex items-center justify-between p-6 pb-0">
          <h3 className="font-display text-elder-xl text-gray-900 dark:text-white">
            {medicine ? 'Edit Medicine' : 'Add Medicine'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Medicine Name *</label>
            <input className="input-field" placeholder="e.g. Metformin" value={form.name}
              onChange={e => set('name', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Dosage *</label>
              <input className="input-field" placeholder="e.g. 500mg" value={form.dosage}
                onChange={e => set('dosage', e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Frequency</label>
              <select className="input-field" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                <option value="daily">Once daily</option>
                <option value="twice_daily">Twice daily</option>
                <option value="thrice_daily">Three times</option>
                <option value="weekly">Weekly</option>
                <option value="as_needed">As needed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Time Slots</label>
            <div className="space-y-2">
              {form.timeSlots.map((slot, index) => {
                const p = parseSlot(slot);
                return (
                  <div key={index} className="flex items-center gap-2">
                    <select className="input-field w-20 text-center" value={p.hour}
                      onChange={e => handleTimeSlotChange(index, 'hour', e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <span className="text-gray-400 font-bold text-lg select-none">:</span>
                    <select className="input-field w-20 text-center" value={p.minute}
                      onChange={e => handleTimeSlotChange(index, 'minute', e.target.value)}>
                      {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 flex-shrink-0">
                      {['AM', 'PM'].map(per => (
                        <button key={per} type="button" onClick={() => handleTimeSlotChange(index, 'period', per)}
                          className={`px-3 py-2 text-sm font-semibold transition-all ${
                            p.period === per
                              ? 'bg-brand-500 text-white'
                              : 'bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}>
                          {per}
                        </button>
                      ))}
                    </div>
                    {form.timeSlots.length > 1 && (
                      <button type="button" onClick={() => removeSlot(index)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50">
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={addSlot} className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-500">
              + Add Time Slot
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button key={cat} type="button" onClick={() => set('category', cat)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    form.category === cat
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Refill Interval (days)</label>
              <input type="number" className="input-field" value={form.refillInterval}
                onChange={e => set('refillInterval', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Pills Remaining</label>
              <input type="number" className="input-field" value={form.pillsRemaining}
                onChange={e => set('pillsRemaining', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Precautions</label>
            <textarea className="input-field min-h-[80px] resize-none" placeholder="Any special instructions..."
              value={form.precautions} onChange={e => set('precautions', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Pill className="w-5 h-5" /> {medicine ? 'Update' : 'Add Medicine'}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
