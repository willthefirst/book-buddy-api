// Importing Passport, strategies, and config
const passport = require('passport')
const User = require('../models/user')
const JwtStrategy = require('passport-jwt').Strategy
const ExtractJwt = require('passport-jwt').ExtractJwt
const LocalStrategy = require('passport-local')

const localOptions = { usernameField: 'email' }

// Setting up local login strategy
const localLogin = new LocalStrategy(localOptions, function (email, password, done) {
  User.findOne({ email: email }, function (err, user) {
    if (err) { return done(err) }
    if (!user) {
      return done(
        null,
        false,
        {
          message: "I couldn't find a user with that email address. Please try again."
        }
      )
    }
    user.comparePassword(password, function (err, isMatch) {
      if (err) { return done(err) }
      if (!isMatch) { return done(null, false, { message: "That's not the right password. Please try again." }) }

      // If user has not confirmed email, block
      if (!user.isVerified) { return done(null, false, { message: "You still need to confirm your email address. Check your inbox for a confirmation email and click the link inside." }) }

      return done(null, user)
    })
  })
})

const jwtOptions = {
  // Telling Passport to check authorization headers for JWT
  jwtFromRequest: ExtractJwt.fromAuthHeader(),
  // Telling Passport where to find the secret
  secretOrKey: process.env.SERVER_SECRET
}

// Setting up JWT login strategy
const jwtLogin = new JwtStrategy(jwtOptions, function (payload, done) {
  User.findById(payload._id, function (err, user) {
    if (err) { return done(err, false) }

    if (user) {
      done(null, user)
    } else {
      done(null, false)
    }
  })
})

passport.use(jwtLogin)
passport.use(localLogin)
