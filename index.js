require('dotenv').config()
const express = require('express')
const logger = require('morgan')
const path = require('path')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const router = require('./router')
const passport = require('passport')
const app = express()

app.use(logger('dev'))
app.use(cookieParser(process.env.SERVER_SECRET))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Necessary for passport to work
passport.serializeUser(function (user, done) {
  done(null, user)
})

passport.deserializeUser(function (user, done) {
  done(null, user)
})

app.use(passport.initialize())
app.use(passport.session())

// Add headers
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization')
  res.setHeader('Access-Control-Allow-Credentials', true)
  next();
});

// Routes
router(app)

// Database
mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection
db.on('error', console.error.bind(console, 'Connection error:'))
db.once('open', function () {
  console.log('Connected to database at', process.env.MONGODB_URI)
})

app.listen(process.env.PORT)
console.log(`Server is now running at http://localhost:${process.env.PORT}.`)
