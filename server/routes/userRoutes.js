const express = require('express');
const User = require('../models/User');

const router = express.Router();

// GET /api/user — fetch user info & balance
router.get('/', async (req, res) => {
    try {
        let user = await User.findOne();
        if (!user) {
            return res.status(200).json(null);
        }
        res.json(user.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/user — create or update user profile
router.put('/', async (req, res) => {
    try {
        const data = {
            name: req.body.name || '',
            stayType: req.body.stayType || 'hosteller',
            pocketMoney: Number(req.body.pocketMoney) || 0,
            monthlyBudget: Number(req.body.monthlyBudget) || 0,
            semesterBudget: Number(req.body.semesterBudget) || 0,
            semesterEnd: req.body.semesterEnd || '',
            semesterStart: req.body.semesterStart || ''
        };

        let user = await User.findOne();
        if (user) {
            Object.assign(user, data);
            await user.save();
        } else {
            user = await User.create(data);
        }
        res.json(user.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
