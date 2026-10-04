const express = require('express');
const Exam = require('../models/Exam');

const router = express.Router();

// GET /api/exam
router.get('/', async (req, res) => {
    try {
        let exam = await Exam.findOne();
        if (!exam) {
            return res.status(200).json({ enabled: false, budget: 0, expenses: [] });
        }
        res.json(exam.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/exam
router.put('/', async (req, res) => {
    try {
        const data = {
            enabled: Boolean(req.body.enabled),
            budget: Number(req.body.budget) || 0,
            expenses: Array.isArray(req.body.expenses) ? req.body.expenses : []
        };

        let exam = await Exam.findOne();
        if (exam) {
            Object.assign(exam, data);
            await exam.save();
        } else {
            exam = await Exam.create(data);
        }
        res.json(exam.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
