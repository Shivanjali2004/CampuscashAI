const mongoose = require('mongoose');

const ExamExpenseSchema = new mongoose.Schema({
    category: { type: String, default: 'Other' },
    icon: { type: String, default: '📦' },
    amount: { type: Number, required: true },
    note: { type: String, default: '' },
    timestamp: { type: Number, default: () => Date.now() }
}, { _id: false, versionKey: false });

const ExamSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    budget: { type: Number, default: 0 },
    expenses: [ExamExpenseSchema]
}, { _id: false, versionKey: false });

module.exports = mongoose.models.Exam || mongoose.model('Exam', ExamSchema, 'exam');
