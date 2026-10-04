const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    category: { type: String, required: true },
    icon: { type: String, default: '📦' },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    date: { type: String, required: true },
    timestamp: { type: Number, default: () => Date.now() }
}, { versionKey: false });

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema, 'transactions');
