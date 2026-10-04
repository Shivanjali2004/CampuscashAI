const express = require('express');
const Savings = require('../models/Savings');

const router = express.Router();

// GET /api/savings
router.get('/', async (req, res) => {
    try {
        let savings = await Savings.findOne();
        if (!savings) {
            return res.status(200).json({ name: null, target: 0, saved: 0, startDate: null });
        }
        res.json(savings.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/savings
router.put('/', async (req, res) => {
    try {
        const data = {
            name: req.body.name ?? null,
            target: Number(req.body.target) || 0,
            saved: Number(req.body.saved) || 0,
            startDate: req.body.startDate ?? null
        };

        let savings = await Savings.findOne();
        if (savings) {
            Object.assign(savings, data);
            await savings.save();
        } else {
            savings = await Savings.create(data);
        }
        res.json(savings.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
