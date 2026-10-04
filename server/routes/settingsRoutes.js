const express = require('express');
const Settings = require('../models/Settings');

const router = express.Router();

// GET /api/settings
router.get('/', async (req, res) => {
    try {
        let settings = await Settings.findOne();
        if (!settings) {
            return res.status(200).json({ theme: 'light', notifications: true, aiInsights: true, autoSave: true });
        }
        res.json(settings.toObject());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT /api/settings
router.put('/', async (req, res) => {
    try {
        const data = {
            theme: req.body.theme || 'light',
            notifications: req.body.notifications !== undefined ? Boolean(req.body.notifications) : true,
            aiInsights: req.body.aiInsights !== undefined ? Boolean(req.body.aiInsights) : true,
            autoSave: req.body.autoSave !== undefined ? Boolean(req.body.autoSave) : true
        };

        let settings = await Settings.findOne();
        if (settings) {
            Object.assign(settings, data);
            await settings.save();
        } else {
            settings = await Settings.create(data);
        }
        res.json(settings.toObject());
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
