const jwt = require('jsonwebtoken')
const User = require('../models/user')
const passport = require('passport')
const crypto = require('crypto');
const mailgun = require('../config/mailgun');

function generateToken (user) {
  return jwt.sign(user, process.env.SERVER_SECRET, {
    expiresIn: 7*24*60*60 // in days
  })
}

// Set user info from request
function setUserInfo (request) {
  return {
    _id: request._id,
    email: request.email
  }
}

// ========================================
// Login Route
// ========================================

exports.login = function (req, res, next) {
  passport.authenticate('local', (err, result, info) => {
    if (err) { return next(err) }
    if (!result) {
      return res.status(401).json(info)
    }
    req.logIn(result, function (err) {
      if (err) { return next(err) }

      let userInfo = setUserInfo(req.user)
      res.status(200).json({
        token: 'JWT ' + generateToken(userInfo),
        user: userInfo
      })
    })
  })(req, res, next)
}

// For refreshing info from a token (case when user is already logged in but refreshes)
exports.meFromToken = function (req, res, next) {
  passport.authenticate('jwt', (err, result, info) => {
    if (err) { return next(err) }
    if (!result) {
      return res.status(401).json(info)
    }
    req.logIn(result, function (err) {
      if (err) { return next(err) }

      let userInfo = setUserInfo(req.user)
      res.status(200).json({
        token: 'JWT ' + generateToken(userInfo),
        user: userInfo
      })
    })
  })(req, res, next)
}

// ========================================
// Registration Route
// ========================================
exports.register = function (req, res, next) {
  // Check for registration errors
  const email = req.body.email
  const password = req.body.password

  // Return error if no email provided
  if (!email) {
    return res.status(422).send({ message: 'You must enter an email address.' })
  }

  // Return error if no password provided
  if (!password) {
    return res.status(422).send({ message: 'You must enter a password.' })
  }

  User.findOne({ email: email }, function (err, existingUser) {
    if (err) { return next(err) }

    // If user is not unique, return error
    if (existingUser) {
      return res.status(422).send({ message: 'That email address is already in use.' })
    }


    // Generate a token with Crypto
    crypto.randomBytes(48, (err, buffer) => {
      const verifyEmailToken = buffer.toString('hex');
      if (err) { return next(err); }

      // If email is unique and password was provided, create account
      let user = new User({
        email: email,
        password: password,
        verifyEmailToken: verifyEmailToken
      })

      user.save(function (err, user) {
        if (err) { return next(err) }

        const message = {
          subject: "Confirm your new BookBuddy account",
          text: `${'Welcome to BookBuddy!\n\n' +
            'Please confirm your new account:\n\n'}` +
            `${process.env.CLIENT_URL}/auth/verify-email/${verifyEmailToken}\n\n`
        }

        // Send user email via Mailgun
        mailgun.sendEmail(user.email, message);

        return res.status(200).json({ message: "Almost there: check your inbox for a confirmation email, and click on the the link." });
      });
    })
  })
}


//= =======================================
// Verify Email Route
//= =======================================

exports.verifyEmail = function (req, res, next) {
  User.findOne({ verifyEmailToken: req.params.token }, (err, verifiedUser) => {
    // If query returned no results, token expired or was invalid. Return error.
    if (!verifiedUser || err) {
      res.status(422).json({ message: 'Sorry, I could not find any user with that email.' });
      return next(err)
    }

    verifiedUser.isVerified = true;
    verifiedUser.verifyEmailToken = undefined;

    verifiedUser.save(function (err) {
        if (err) return console.error(err);
        res.send({message: 'Your account is live! Please login to get started.'});
    });
  });
};

//= =======================================
// Forgot Password Route (from https://github.com/joshuaslate/mern-starter/blob/master/server/controllers/authentication.js)
//= =======================================

exports.forgotPassword = function (req, res, next) {
  const email = req.body.email;

  User.findOne({ email }, (err, existingUser) => {
    // If user is not found, return error
    if (err) {
      res.status(422).json({ message: err });
      return next(err);
    }
    if (existingUser == null) {
      res.status(422).json({ message: "I couldn't find an account with that email. Did you type it correctly?" });
      return next(err);
    }

    // If user is found, generate and save resetToken

    // Generate a token with Crypto
    crypto.randomBytes(48, (err, buffer) => {
      const resetToken = buffer.toString('hex');
      if (err) { return next(err); }

      existingUser.resetPasswordToken = resetToken;
      existingUser.resetPasswordExpires = Date.now() + 3600000; // 1 hour

      existingUser.save((err) => {
        // If error in saving token, return it
        if (err) { return next(err); }

        const message = {
          subject: 'Reset Password',
          text: `${'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
            'Please click on the following link, or paste this into your browser to complete the process:\n'}
            ${process.env.CLIENT_URL}/auth/reset-password/${resetToken}\n\n` +
            `If you did not request this, please ignore this email and your password will remain unchanged.\n`
        };

        // Otherwise, send user email via Mailgun
        mailgun.sendEmail(existingUser.email, message);

        return res.status(200).json({ message: "Thank you kindly. Now, go check your email. I just sent you an email with a link to reset your password." });
      });
    });
  });
};

//= =======================================
// Reset Password Route
//= =======================================

exports.verifyToken = function (req, res, next) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, (err, resetUser) => {
    // If query returned no results, token expired or was invalid. Return error.
    if (!resetUser || err) {
      res.status(422).json({ message: 'Your token has expired. Please attempt to reset your password again.' });
      return next(err)
    }

    if (req.body.password !== req.body.confirmPassword) {
      res.status(422).json({ message: 'Make sure your passwords match.' });
      return next()
    }

    // Otherwise, save new password and clear resetToken from database
    resetUser.password = req.body.password;
    resetUser.resetPasswordToken = undefined;
    resetUser.resetPasswordExpires = undefined;

    resetUser.save((err) => {
      if (err) { return next(err); }

      // If password change saved successfully, alert user via email
      const message = {
        subject: 'Password Changed',
        text: 'You are receiving this email because you changed your password. \n\n' +
        'If you did not request this change, please contact us immediately.'
      };

      // Otherwise, send user email confirmation of password change via Mailgun
      mailgun.sendEmail(resetUser.email, message);

      return res.status(200).json({ message: 'Password changed successfully. Please login with your new password.' });
    });
  });
};
