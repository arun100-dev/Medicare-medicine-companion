const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['elderly', 'caregiver'], default: 'elderly' },

  // Only caregivers have a PIN — this is what protects edit/delete
  caregiverPIN: { type: String },

  // Only caregivers have a code — patients use it to link during signup
  caregiverCode: { type: String, unique: true, sparse: true },

  // Patient's assigned caregiver
  assignedCaregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Caregiver's list of patients
  patients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isModified('caregiverPIN') && this.caregiverPIN) {
    this.caregiverPIN = await bcrypt.hash(this.caregiverPIN, 10);
  }
  next();
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.comparePIN = function (pin) {
  if (!this.caregiverPIN) return Promise.resolve(false);
  return bcrypt.compare(pin, this.caregiverPIN);
};

module.exports = mongoose.model('User', userSchema);
