const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Rent', 'Electricity', 'Transport', 'Salary', 'Internet', 'Other'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

expenseSchema.index({ date: -1 });
expenseSchema.index({ name: 'text' });

module.exports = mongoose.model('Expense', expenseSchema);
