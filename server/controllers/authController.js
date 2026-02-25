const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'medicine-companion-secret-key';

// Build the user object we send back in every response
function buildUserResponse(user, caregiverName = null) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    caregiverCode: user.caregiverCode || null,
    assignedCaregiverId: user.assignedCaregiverId || null,
    caregiverName: caregiverName || null,
  };
}

// Generate a unique 6-character caregiver code like "A3F9B2"
async function generateUniqueCaregiverCode() {
  let code;
  let alreadyExists = true;

  while (alreadyExists) {
    code = crypto.randomBytes(3).toString('hex').toUpperCase();
    alreadyExists = await User.findOne({ caregiverCode: code });
  }

  return code;
}

// POST /auth/register
async function register(req, res) {
  try {
    const { name, email, password, role, caregiverPIN, caregiverCode } = req.body;

    // Check if email is taken
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'This email is already registered' });
    }

    const userPayload = { name, email, password, role };

    if (role === 'caregiver') {
      // Caregiver must set a 4-digit PIN during signup
      // This PIN is what patients (and the caregiver themselves) will enter to unlock edits
      if (!caregiverPIN || caregiverPIN.length !== 4 || !/^\d{4}$/.test(caregiverPIN)) {
        return res.status(400).json({ error: 'Caregivers must set a 4-digit PIN during signup' });
      }

      userPayload.caregiverPIN = caregiverPIN;
      userPayload.caregiverCode = await generateUniqueCaregiverCode();
    }

    if (role === 'elderly') {
      // Patient MUST provide the caregiver's code — it is not optional
      if (!caregiverCode || caregiverCode.trim().length === 0) {
        return res.status(400).json({ error: 'Caregiver code is required. Ask your caregiver for their 6-character code.' });
      }

      const caregiver = await User.findOne({
        caregiverCode: caregiverCode.trim().toUpperCase(),
        role: 'caregiver',
      });

      if (!caregiver) {
        return res.status(400).json({ error: 'Invalid caregiver code. Please double-check with your caregiver.' });
      }

      userPayload.assignedCaregiverId = caregiver._id;
    }

    const user = new User(userPayload);
    await user.save();

    // Add patient to caregiver's list
    if (role === 'elderly' && userPayload.assignedCaregiverId) {
      await User.findByIdAndUpdate(userPayload.assignedCaregiverId, {
        $addToSet: { patients: user._id },
      });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    // For patients, include their caregiver's name so the dashboard can show it
    let caregiverName = null;
    if (user.role === 'elderly' && user.assignedCaregiverId) {
      const caregiver = await User.findById(user.assignedCaregiverId).select('name');
      if (caregiver) caregiverName = caregiver.name;
    }

    return res.json({
      token,
      user: buildUserResponse(user, caregiverName),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /auth/verify-pin
// The rule is simple: ALWAYS the caregiver's PIN is used.
// - Caregiver calling this: enters their own PIN, provides patientId to scope the token
// - Patient calling this: their caregiver's PIN is checked (patient does not have a PIN)
async function verifyPin(req, res) {
  try {
    const { pin, patientId } = req.body;

    if (req.user.role === 'caregiver') {
      // Caregiver is verifying their own PIN for a specific patient's medicines
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required when a caregiver verifies their PIN' });
      }

      // Make sure this patient is actually assigned to this caregiver
      const patient = await User.findOne({ _id: patientId, assignedCaregiverId: req.user._id });
      if (!patient) {
        return res.status(403).json({ error: 'This patient is not assigned to you' });
      }

      // Check the caregiver's own PIN
      const pinIsCorrect = await req.user.comparePIN(pin);
      if (!pinIsCorrect) {
        return res.status(403).json({ error: 'Incorrect PIN' });
      }

      const caregiverToken = jwt.sign(
        { userId: req.user._id, caregiverVerified: true, patientId: patient._id },
        JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({ verified: true, caregiverToken });
    }

    // Patient is verifying — we check THEIR CAREGIVER's PIN, not the patient's own
    if (!req.user.assignedCaregiverId) {
      return res.status(403).json({
        error: 'Your account has no caregiver linked. Please contact your caregiver.',
      });
    }

    const caregiver = await User.findById(req.user.assignedCaregiverId);
    if (!caregiver) {
      return res.status(403).json({ error: 'Your caregiver account could not be found' });
    }

    const pinIsCorrect = await caregiver.comparePIN(pin);
    if (!pinIsCorrect) {
      return res.status(403).json({ error: 'Incorrect PIN' });
    }

    // Token is scoped to this patient so the backend can verify it later
    const caregiverToken = jwt.sign(
      { userId: caregiver._id, caregiverVerified: true, patientId: req.user._id },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({ verified: true, caregiverToken });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// GET /auth/me
async function getMe(req, res) {
  let caregiverName = null;
  if (req.user.role === 'elderly' && req.user.assignedCaregiverId) {
    const caregiver = await User.findById(req.user.assignedCaregiverId).select('name');
    if (caregiver) caregiverName = caregiver.name;
  }
  return res.json({ user: buildUserResponse(req.user, caregiverName) });
}

// GET /auth/patients  (caregiver only)
async function getPatients(req, res) {
  try {
    if (req.user.role !== 'caregiver') {
      return res.status(403).json({ error: 'Only caregivers can access this' });
    }

    const caregiver = await User.findById(req.user._id).populate('patients', 'name email createdAt');
    return res.json({ patients: caregiver.patients || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, verifyPin, getMe, getPatients };
