const express = require('express');
const Reminder = require('../models/Reminder');

const router = express.Router();

// GET /api/reminders
router.get('/', async (req, res) => {
    try {
        const reminders = await Reminder.find().lean();
        res.json(reminders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/reminders
router.post('/', async (req, res) => {
    try {
        const reminder = await Reminder.create({
            type: req.body.type || 'custom',
            name: req.body.name || '',
            amount: Number(req.body.amount) || 0,
            date: req.body.date || '',
            createdAt: req.body.createdAt || Date.now()
        });
        res.status(201).json(reminder.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/reminders — replace all (used by import)
router.put('/', async (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ message: 'Expected an array' });
        }
        await Reminder.deleteMany({});
        if (req.body.length > 0) {
            await Reminder.insertMany(req.body);
        }
        const reminders = await Reminder.find().lean();
        res.json(reminders);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Reminder.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Reminder not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
