const express = require('express');
const Event = require('../models/Event');

const router = express.Router();

// GET /api/events
router.get('/', async (req, res) => {
    try {
        const events = await Event.find().lean();
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/events
router.post('/', async (req, res) => {
    try {
        const event = await Event.create({
            type: req.body.type || 'custom',
            name: req.body.name || '',
            amount: Number(req.body.amount) || 0,
            createdAt: req.body.createdAt || Date.now()
        });
        res.status(201).json(event.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/events — replace all (used by import)
router.put('/', async (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ message: 'Expected an array' });
        }
        await Event.deleteMany({});
        if (req.body.length > 0) {
            await Event.insertMany(req.body);
        }
        const events = await Event.find().lean();
        res.json(events);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Event.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Event not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
