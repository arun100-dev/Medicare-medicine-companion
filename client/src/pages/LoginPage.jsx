import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Heart, Eye, EyeOff, Sun, Moon, ArrowRight, UserPlus, LogIn } from 'lucide-react';

export default function LoginPage() {
  const { login, register } = useAuth();
  const { dark, toggle } = useTheme();

  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPIN, setShowPIN] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'elderly',
    caregiverPIN: '',
    caregiverCode: '',
  });

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (form.role === 'caregiver') {
          if (!form.caregiverPIN || form.caregiverPIN.length !== 4) {
            setError('Please set a 4-digit PIN. Patients will use this to unlock medicine edits.');
            setLoading(false);
            return;
          }
        }
        if (form.role === 'elderly') {
          if (!form.caregiverCode || form.caregiverCode.trim().length === 0) {
            setError('Caregiver code is required. Ask your caregiver for their 6-character code.');
            setLoading(false);
            return;
          }
        }
        await register(form);
      } else {
        await login(form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(prev => !prev);
    setError('');
    setForm({ name: '', email: '', password: '', role: 'elderly', caregiverPIN: '', caregiverCode: '' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#f4f7f5] dark:bg-[#0d1210]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-300/10 rounded-full blur-3xl" />
      </div>

      <button onClick={toggle} className="absolute top-6 right-6 p-3 rounded-2xl glass hover:shadow-md transition-all z-10">
        {dark ? <Sun className="w-5 h-5 text-warm-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
      </button>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow mb-4">
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="font-display text-elder-3xl text-gray-900 dark:text-white mb-1">MediCare</h1>
          <p className="text-elder-base text-gray-500 dark:text-gray-400">Your Medicine Companion</p>
        </div>

        <div className="card !p-8">
          <h2 className="font-display text-elder-xl text-gray-900 dark:text-white mb-6 text-center">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>

          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 text-danger-600 dark:text-danger-400 text-sm animate-scale-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Full Name</label>
                <input type="text" className="input-field" placeholder="Enter your name"
                  value={form.name} onChange={e => updateForm('name', e.target.value)} required />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Email</label>
              <input type="email" className="input-field" placeholder="your@email.com"
                value={form.email} onChange={e => updateForm('email', e.target.value)} required />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input-field !pr-12"
                  placeholder="••••••••" value={form.password}
                  onChange={e => updateForm('password', e.target.value)} required />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isRegister && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">I am a...</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'elderly', label: '👴 Patient' },
                      { value: 'caregiver', label: '👨‍⚕️ Caregiver' },
                    ].map(option => (
                      <button key={option.value} type="button" onClick={() => updateForm('role', option.value)}
                        className={`p-3 rounded-2xl border-2 text-center font-semibold transition-all ${
                          form.role === option.value
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                            : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                        }`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caregiver sets their PIN here */}
                {form.role === 'caregiver' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Your 4-Digit PIN <span className="text-danger-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPIN ? 'text' : 'password'}
                        className="input-field !pr-12 tracking-widest text-lg"
                        placeholder="••••"
                        maxLength={4}
                        value={form.caregiverPIN}
                        onChange={e => updateForm('caregiverPIN', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        required
                      />
                      <button type="button" onClick={() => setShowPIN(p => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPIN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Patients will enter this PIN whenever they want to edit medicines. Keep it safe.
                    </p>
                  </div>
                )}

                {/* Patient must enter caregiver code — required, not optional */}
                {form.role === 'elderly' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      Caregiver Code <span className="text-danger-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="input-field uppercase tracking-widest text-lg font-mono"
                      placeholder="e.g. A3F9B2"
                      maxLength={6}
                      value={form.caregiverCode}
                      onChange={e => updateForm('caregiverCode', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Ask your caregiver for their 6-character code. You cannot register without it.
                    </p>
                  </div>
                )}
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isRegister ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                  {isRegister ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={switchMode} className="text-brand-600 dark:text-brand-400 font-semibold text-sm hover:underline">
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Medicine Companion — Safe & Simple Medication Tracking
        </p>
      </div>
    </div>
  );
}
