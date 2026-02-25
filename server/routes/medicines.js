const express = require('express');
const auth = require('../middleware/auth');
const {
  getMedicines,
  addMedicine,
  updateMedicine,
  deleteMedicine,
  getRefillAlerts,
} = require('../controllers/medicinesController');

const router = express.Router();

router.get('/refill-alerts', auth, getRefillAlerts);
router.get('/', auth, getMedicines);
router.post('/', auth, addMedicine);
router.put('/:id', auth, updateMedicine);
router.delete('/:id', auth, deleteMedicine);

module.exports = router;
