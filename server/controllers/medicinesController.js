const jwt = require('jsonwebtoken');
const Medicine = require('../models/Medicine');
const DoseLog = require('../models/DoseLog');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'medicine-companion-secret-key';

async function resolveTargetUserId(req, res) {
  if (req.user.role === 'caregiver') {
    const patientId = req.query.patientId || req.body.patientId;

    if (!patientId) {
      res.status(400).json({ error: 'patientId is required for caregivers' });
      return null;
    }

    const patient = await User.findOne({ _id: patientId, assignedCaregiverId: req.user._id });
    if (!patient) {
      res.status(403).json({ error: 'You are not the assigned caregiver for this patient' });
      return null;
    }

    return patient._id;
  }

  return req.user._id;
}

// Verify that the caregiver token (set after PIN entry) is valid and scoped to the correct patient
function verifyCaregiverTokenForPatient(req, res, patientId) {
  const caregiverToken = req.header('X-Caregiver-Token');

  if (!caregiverToken) {
    res.status(403).json({ error: 'PIN verification required. Please enter the caregiver PIN.' });
    return false;
  }

  try {
    const decoded = jwt.verify(caregiverToken, JWT_SECRET);

    if (!decoded.caregiverVerified) {
      res.status(403).json({ error: 'Invalid PIN session' });
      return false;
    }

    // Make sure this PIN session was issued for the correct patient
    if (String(decoded.patientId) !== String(patientId)) {
      res.status(403).json({ error: 'PIN session does not match this patient. Please re-enter the PIN.' });
      return false;
    }

    return true;
  } catch {
    res.status(403).json({ error: 'PIN session has expired. Please re-enter the PIN.' });
    return false;
  }
}

// Convert the user's local midnight to a UTC Date using their timezone offset
function getLocalMidnightUTC(timezoneOffset) {
  const offsetMs = timezoneOffset * 60 * 1000;
  const localTimeMs = Date.now() - offsetMs;
  const midnightLocal = new Date(localTimeMs);
  midnightLocal.setUTCHours(0, 0, 0, 0);
  return new Date(midnightLocal.getTime() + offsetMs);
}

// GET /medicines
async function getMedicines(req, res) {
  try {
    const targetId = await resolveTargetUserId(req, res);
    if (!targetId) return;

    const medicines = await Medicine.find({ userId: targetId, isActive: true }).sort({ createdAt: -1 });
    return res.json(medicines);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /medicines  (requires caregiver PIN)
async function addMedicine(req, res) {
  try {
    const { timezoneOffset, patientId, ...medicineData } = req.body;

    const targetUserId = await resolveTargetUserId(req, res);
    if (!targetUserId) return;

    // Verify the caregiver token is valid and scoped to this patient
    const tokenValid = verifyCaregiverTokenForPatient(req, res, targetUserId);
    if (!tokenValid) return;

    const medicine = new Medicine({ ...medicineData, userId: targetUserId });
    await medicine.save();

    // Auto-generate dose logs for today
    const offset = timezoneOffset || 0;
    const todayStart = getLocalMidnightUTC(offset);

    for (const slot of medicine.timeSlots || []) {
      const [hours, minutes] = slot.time.split(':').map(Number);
      let hours24 = hours;
      if (slot.period === 'PM' && hours < 12) hours24 += 12;
      else if (slot.period === 'AM' && hours === 12) hours24 = 0;

      const scheduledTime = new Date(todayStart.getTime() + hours24 * 3600000 + minutes * 60000);
      const isMissed = Date.now() - scheduledTime > 30 * 60 * 1000;

      await new DoseLog({ userId: targetUserId, medicineId: medicine._id, scheduledTime, missed: isMissed }).save();
    }

    return res.status(201).json(medicine);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// PUT /medicines/:id  (requires caregiver PIN)
async function updateMedicine(req, res) {
  try {
    const targetUserId = await resolveTargetUserId(req, res);
    if (!targetUserId) return;

    const tokenValid = verifyCaregiverTokenForPatient(req, res, targetUserId);
    if (!tokenValid) return;

    const { patientId, ...updateData } = req.body;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: targetUserId },
      updateData,
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    return res.json(medicine);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /medicines/:id  (requires caregiver PIN)
async function deleteMedicine(req, res) {
  try {
    const targetUserId = await resolveTargetUserId(req, res);
    if (!targetUserId) return;

    const tokenValid = verifyCaregiverTokenForPatient(req, res, targetUserId);
    if (!tokenValid) return;

    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: targetUserId },
      { isActive: false },
      { new: true }
    );

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    return res.json({ message: 'Medicine removed successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /medicines/refill-alerts
async function getRefillAlerts(req, res) {
  try {
    const targetId = await resolveTargetUserId(req, res);
    if (!targetId) return;

    const medicines = await Medicine.find({ userId: targetId, isActive: true });

    const alerts = medicines
      .filter(med => {
        if (!med.lastRefillDate || !med.refillInterval) return false;
        const nextRefill = new Date(med.lastRefillDate);
        nextRefill.setDate(nextRefill.getDate() + med.refillInterval);
        const daysLeft = Math.ceil((nextRefill - new Date()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 5;
      })
      .map(med => {
        const nextRefill = new Date(med.lastRefillDate);
        nextRefill.setDate(nextRefill.getDate() + med.refillInterval);
        const daysLeft = Math.ceil((nextRefill - new Date()) / (1000 * 60 * 60 * 24));
        return { medicine: med, daysLeft, nextRefillDate: nextRefill };
      });

    return res.json(alerts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getMedicines, addMedicine, updateMedicine, deleteMedicine, getRefillAlerts };
