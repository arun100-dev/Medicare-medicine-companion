const express = require('express');
const DoseLog = require('../models/DoseLog');
const Medicine = require('../models/Medicine');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Helper: get user's local midnight as UTC date
function getLocalMidnightUTC(timezoneOffset) {
  const offsetMs = timezoneOffset * 60 * 1000;
  const localTimeMs = Date.now() - offsetMs;
  const midnightLocal = new Date(localTimeMs);
  midnightLocal.setUTCHours(0, 0, 0, 0);
  return new Date(midnightLocal.getTime() + offsetMs);
}

// Helper: resolve which user's logs we want
// Caregivers pass ?patientId= to view a patient's data
async function resolveTargetUserId(req, res) {
  if (req.user.role === 'caregiver') {
    const patientId = req.query.patientId;
    if (!patientId) {
      res.status(400).json({ error: 'patientId is required for caregivers' });
      return null;
    }
    const patient = await User.findOne({ _id: patientId, assignedCaregiverId: req.user._id });
    if (!patient) {
      res.status(403).json({ error: 'This patient is not assigned to you' });
      return null;
    }
    return patient._id;
  }
  return req.user._id;
}

// GET /dose-logs/today
router.get('/today', auth, async (req, res) => {
  try {
    const targetId = await resolveTargetUserId(req, res);
    if (!targetId) return;

    const start = req.query.start ? new Date(req.query.start) : (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return d; })();
    const end   = req.query.end   ? new Date(req.query.end)   : (() => { const d = new Date(); d.setUTCHours(23,59,59,999); return d; })();

    const logs = await DoseLog.find({
      userId: targetId,
      scheduledTime: { $gte: start, $lte: end }
    }).populate('medicineId');

    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /dose-logs/:id/take
router.put('/:id/take', auth, async (req, res) => {
  try {
    const log = await DoseLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { taken: true, missed: false, takenAt: new Date() },
      { new: true }
    ).populate('medicineId');

    if (!log) return res.status(404).json({ error: 'Dose log not found' });

    if (log.medicineId) {
      await Medicine.findByIdAndUpdate(log.medicineId._id, { $inc: { pillsRemaining: -1 } });
    }

    res.json(log);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /dose-logs/weekly-summary
// Supports ?patientId= for caregivers to view a patient's weekly report
router.get('/weekly-summary', auth, async (req, res) => {
  try {
    const targetId = await resolveTargetUserId(req, res);
    if (!targetId) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const logs = await DoseLog.find({
      userId: targetId,
      scheduledTime: { $gte: weekAgo, $lte: now }
    }).populate('medicineId');

    const total = logs.length;
    const taken = logs.filter(l => l.taken).length;
    const missed = logs.filter(l => l.missed).length;
    const pending = total - taken - missed;
    const adherencePercent = total > 0 ? Math.round((taken / total) * 100) : 100;

    const byMedicine = {};
    logs.forEach(log => {
      const name = log.medicineId?.name || 'Unknown';
      if (!byMedicine[name]) byMedicine[name] = { total: 0, taken: 0, missed: 0 };
      byMedicine[name].total++;
      if (log.taken) byMedicine[name].taken++;
      if (log.missed) byMedicine[name].missed++;
    });

    const timezoneOffset = parseInt(req.query.timezoneOffset) || 0;
    const offsetMs = timezoneOffset * 60 * 1000;
    const daily = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const localNow = new Date(now.getTime() - offsetMs);
      const localDate = new Date(localNow.getTime() - i * 24 * 60 * 60 * 1000);
      localDate.setUTCHours(0, 0, 0, 0);
      const dayStartUTC = new Date(localDate.getTime() + offsetMs);
      const dayEndUTC = new Date(dayStartUTC.getTime() + 24 * 60 * 60 * 1000);
      const dayLogs = logs.filter(l => l.scheduledTime >= dayStartUTC && l.scheduledTime < dayEndUTC);

      daily.push({
        date: localDate.toISOString().split('T')[0],
        dayName: dayNames[localDate.getUTCDay()],
        total: dayLogs.length,
        taken: dayLogs.filter(l => l.taken).length,
        missed: dayLogs.filter(l => l.missed).length,
      });
    }

    res.json({ total, taken, missed, pending, adherencePercent, byMedicine, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /dose-logs/generate
router.post('/generate', auth, async (req, res) => {
  try {
    const timezoneOffset = req.body.timezoneOffset || 0;
    const todayStart = getLocalMidnightUTC(timezoneOffset);
    const medicines = await Medicine.find({ userId: req.userId, isActive: true });

    let created = 0;
    for (const medicine of medicines) {
      for (const slot of medicine.timeSlots || []) {
        const [hours, minutes] = slot.time.split(':').map(Number);
        let hours24 = hours;
        if (slot.period === 'PM' && hours < 12) hours24 += 12;
        else if (slot.period === 'AM' && hours === 12) hours24 = 0;

        const scheduledTime = new Date(todayStart.getTime() + hours24 * 3600000 + minutes * 60000);
        const exists = await DoseLog.findOne({ userId: req.userId, medicineId: medicine._id, scheduledTime });

        if (!exists) {
          const isMissed = (Date.now() - scheduledTime) > 30 * 60 * 1000;
          await new DoseLog({ userId: req.userId, medicineId: medicine._id, scheduledTime, missed: isMissed }).save();
          created++;
        }
      }
    }

    res.json({ message: `Generated ${created} dose logs for today` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
