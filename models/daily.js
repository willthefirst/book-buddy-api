const mongoose = require('mongoose')
const Schema = mongoose.Schema

const DailySchema = mongoose.Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    match: [/[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])/, '{VALUE} must be formatted YYYY-MM-DD'],
    required: true
  },
  book_id: {
    type: Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  currentPage: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('Daily', DailySchema)
