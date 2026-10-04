const mongoose = require('mongoose');

const ReminderSchema = new mongoose.Schema({
    type: { type: String, default: 'custom' },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },
    createdAt: { type: Number, default: () => Date.now() }
}, { versionKey: false });

module.exports = mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema, 'reminders');
