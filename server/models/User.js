const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    stayType: { type: String, default: 'hosteller' },
    pocketMoney: { type: Number, default: 0 },
    monthlyBudget: { type: Number, default: 0 },
    semesterBudget: { type: Number, default: 0 },
    semesterEnd: { type: String, default: '' },
    semesterStart: { type: String, default: '' }
}, { _id: false, versionKey: false });

// Singleton pattern — one user document per database
module.exports = mongoose.models.User || mongoose.model('User', UserSchema, 'user');
