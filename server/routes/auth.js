const express = require('express');
const auth = require('../middleware/auth');
const { register, login, verifyPin, getMe, getPatients } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-pin', auth, verifyPin);
router.get('/me', auth, getMe);
router.get('/patients', auth, getPatients);

module.exports = router;
