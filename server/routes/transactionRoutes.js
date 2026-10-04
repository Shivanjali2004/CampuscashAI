const express = require('express');
const Transaction = require('../models/Transaction');

const router = express.Router();

// GET /api/transactions — fetch all transactions
router.get('/', async (req, res) => {
    try {
        const transactions = await Transaction.find().lean();
        res.json(transactions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/transactions — add a new transaction
router.post('/', async (req, res) => {
    try {
        const tx = await Transaction.create({
            category: req.body.category || 'other',
            icon: req.body.icon || '📦',
            amount: Number(req.body.amount) || 0,
            note: req.body.note || '',
            date: req.body.date || new Date().toISOString().split('T')[0],
            timestamp: req.body.timestamp || Date.now()
        });
        res.status(201).json(tx.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/transactions — replace all transactions (used by import)
router.put('/', async (req, res) => {
    try {
        if (!Array.isArray(req.body)) {
            return res.status(400).json({ message: 'Expected an array of transactions' });
        }
        await Transaction.deleteMany({});
        if (req.body.length > 0) {
            await Transaction.insertMany(req.body);
        }
        const transactions = await Transaction.find().lean();
        res.json(transactions);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT /api/transactions/:id — update a single transaction
router.put('/:id', async (req, res) => {
    try {
        const updated = await Transaction.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    category: req.body.category,
                    icon: req.body.icon,
                    amount: Number(req.body.amount),
                    note: req.body.note,
                    date: req.body.date,
                    timestamp: req.body.timestamp
                }
            },
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'Transaction not found' });
        res.json(updated.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /api/transactions/:id — delete a single transaction
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Transaction.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Transaction not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
