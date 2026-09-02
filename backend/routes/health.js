const express = require('express');
const router  = express.Router();

// GET /api/health — wake endpoint, sem autenticação
router.get('/', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

module.exports = router;
