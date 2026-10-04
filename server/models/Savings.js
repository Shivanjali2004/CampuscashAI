const mongoose = require('mongoose');

const SavingsSchema = new mongoose.Schema({
    name: { type: String, default: null },
    target: { type: Number, default: 0 },
    saved: { type: Number, default: 0 },
    startDate: { type: String, default: null }
}, { _id: false, versionKey: false });

module.exports = mongoose.models.Savings || mongoose.model('Savings', SavingsSchema, 'savings');
