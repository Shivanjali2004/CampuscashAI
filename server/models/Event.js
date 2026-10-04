const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    type: { type: String, default: 'custom' },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    createdAt: { type: Number, default: () => Date.now() }
}, { versionKey: false });

module.exports = mongoose.models.Event || mongoose.model('Event', EventSchema, 'events');
