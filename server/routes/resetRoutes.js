const express = require('express');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Savings = require('../models/Savings');
const Reminder = require('../models/Reminder');
const Event = require('../models/Event');
const Exam = require('../models/Exam');
const Settings = require('../models/Settings');

const router = express.Router();

// DELETE /api/reset — wipe all data
router.delete('/', async (req, res) => {
    try {
        await Promise.all([
            User.deleteMany({}),
            Transaction.deleteMany({}),
            Savings.deleteMany({}),
            Reminder.deleteMany({}),
            Event.deleteMany({}),
            Exam.deleteMany({}),
            Settings.deleteMany({})
        ]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
