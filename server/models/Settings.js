const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    theme: { type: String, default: 'light' },
    notifications: { type: Boolean, default: true },
    aiInsights: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true }
}, { _id: false, versionKey: false });

module.exports = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema, 'settings');
