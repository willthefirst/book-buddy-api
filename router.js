const AuthenticationController = require('./controllers/authentication')
const BooksController = require('./controllers/books')
const express = require('express')
require('./config/passport')
const passport = require('passport')

// Middleware to require login/auth
const requireAuth = passport.authenticate('jwt', { session: false })

// (this.req, this.res, this.next);

module.exports = function (app) {
  // Initializing route groups
  const apiRoutes = express.Router()
  const authRoutes = express.Router()

  // =========================
  // Auth Routes
  // =========================

  // Set auth routes as subgroup/middleware to apiRoutes
  apiRoutes.use('/auth', authRoutes)

  // Registration route /api/auth/register
  authRoutes.post('/register', AuthenticationController.register)

  // Login route /api/auth/login
  authRoutes.post('/login', AuthenticationController.login)

  // Refresh user details from already existing token.
  authRoutes.get('/meFromToken', AuthenticationController.meFromToken)

  // Set url for API group routes
  app.use('/api', apiRoutes)

  // =========================
  // API Routes
  // =========================

  // '/api/books/'
  // =========================

  // Get all user books
  apiRoutes.get('/books', requireAuth, BooksController.getBooks)

  // Create book
  apiRoutes.post('/books', requireAuth, BooksController.createBook)

  // '/api/books/:id'
  // =========================

  // GET: get a single book
  apiRoutes.get('/book/:id', requireAuth, BooksController.getBook)

  // PUT: update the current book
  apiRoutes.put('/book/:id', requireAuth, BooksController.updateBook)

  // DELETE: get the current book
  apiRoutes.delete('/book/:id', requireAuth, BooksController.deleteBook)

  // Dailies
  // =========================

  // GET: get dailies for a user
  apiRoutes.get('/dailies', requireAuth, BooksController.getDailiesByDate)

  // POST: create or update a daily
  apiRoutes.post('/dailies', requireAuth, BooksController.createDaily)

  // DELETE: delete a daily
  apiRoutes.delete('/dailies', requireAuth, BooksController.deleteDaily)
}
