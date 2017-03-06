require('dotenv').config()
const express = require('express')
const logger = require('morgan')
const path = require('path')
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const router = require('./router')
const passport = require('passport')

// Necessary for passport to work
passport.serializeUser(function (user, done) {
  done(null, user)
})

passport.deserializeUser(function (user, done) {
  done(null, user)
})

const app = express()

app.use(logger('dev')) // Log requests to API using morgan
app.use(cookieParser(process.env.SERVER_SECRET))
app.use(bodyParser.json()) // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })) // support encoded bodie
app.use(session({
  secret: process.env.SERVER_SECRET
}))
app.use(passport.initialize())
app.use(passport.session())


console.log("CLIENTURL", process.env.CLIENT_URL)
// Add headers
app.use(function (req, res, next) {
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL);

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// Routes
router(app)

// Database
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1/book-buddy')
const db = mongoose.connection
db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', function () {
  // we're connected!
  console.log('connected to database')
})

app.listen( process.env.PORT || 3000)
console.log(`Server is now running at http://localhost:${process.env.PORT || 3000}.`)
