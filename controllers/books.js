const Book = require('../models/book')
const User = require('../models/user')
const moment = require('moment')

// Get all the books
exports.getAllBooks = function (req, res) {
  User
    .findOne({ '_id': req.user._id }, 'books')
    .populate({
      path: 'books.book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    })
    .exec(function (err, user) {
      // console.log('Books found:', user);
      if (err) return console.error(err)
      // #todo: could avoid this by writing the write mongodb/mongoose query
      let results = user.books.map(function (book) {
        console.log('Book', book)
        return {
          _id: book.book_id._id,
          title: book.book_id.title,
          authors: book.book_id.authors,
          thumbnailUrl: book.book_id.thumbnailUrl,
          status: book.status
        }
      })
      res.send(results)
    })
}

// Add a new book
exports.createBook = function (req, res) {
  const query = Book.findOne({ gBooks_id: req.body.gBooks_id })
  const promise = query.exec()

  // Check to see books already exists in books collection
  promise.then(function (book) {
    if (!book) {
      // If book doesn't already exists in our db, add it. Once added, return to next promise.
      console.log('Book does not exists yet, creating it...')
      let newBook = {
        title: req.body.title,
        authors: req.body.authors,
        thumbnailUrl: req.body.thumbnailUrl,
        gBooks_id: req.body.gBooks_id
      }
      // this return is important to make then() wait before executing.
      return Book.create(newBook).then(function (book) {
        return book
      })
    } else {
      // If it already exists, just return it.
      return book
    }
  }).then(function (book) {
    // Save book to user
    const bookPersonal = {
      book_id: book._id,
      totalPages: req.body.totalPages
    }
    req.user.books.push(bookPersonal)
    const saveBookToUser = req.user.save().then(function (user) {
      console.log(`Added book ${book.title} to user ${req.user.email}`)
      return user
    })

    // Save user to book
    book.users.push(req.user._id)
    const saveUserToBook = book.save().then(function (book) {
      console.log(`Added user ${req.user.email} to book ${book.title}`)
      return book
    })

    return Promise.all([saveBookToUser, saveUserToBook]).then(function (results) {
      return results
    })
  }).then(function (results) {
    const updatedBook = results[1]
    res.send(updatedBook)
  }).catch(function (error) {
    console.log('Error creating book:', error)
  })
}

function extractDailiesByBook (dailies, bookId) {
  let slimDailies = []

  // Get only entries that correspond to the book_id
  dailies.forEach((entry) => {
    if (entry.book_id.toString() === bookId.toString()) {
      slimDailies.push({
        daily_id: entry._id,
        book_id: entry.book_id,
        date: entry.date,
        currentPage: entry.currentPage
      })
    }
  })

  // Sort entries by date #todo does this need to happen here?
  slimDailies.sort(function (a, b) {
    return b.date - a.date
  })

  // Reformat date once sorted
  slimDailies = slimDailies.map((entry) => {
    return {
      daily_id: entry.daily_id,
      book_id: entry.book_id,
      currentPage: entry.currentPage,
      date: moment(entry.date).format('MM/DD/YYYY')
    }
  })
  // console.log(slimDailies);
  return slimDailies
}

// Find the current book
exports.getBook = function (req, res) {
  // Get book-specific data
  Book.findById(req.params.id).then(function (bookGeneral) {
    // Get user specific data
    const bookPersonal = req.user.books.find((item) => {
      return (item.book_id.toString() === req.params.id.toString())
    })

    const slimDailies = extractDailiesByBook(req.user.dailies, req.params.id)

    // Respond with a combined book object with all the info the client needs
    res.send({
      status: bookPersonal.status[0],
      totalPages: bookPersonal.totalPages,
      dailies: slimDailies,
      notes: bookPersonal.notes,
      _id: bookGeneral._id,
      thumbnailUrl: bookGeneral.thumbnailUrl,
      authors: bookGeneral.authors,
      title: bookGeneral.title
    })
  }).catch(function (error) {
    console.error(error)
    return res.status(404).send({ message: `You don't any books that match the id ${req.params.id}.` })
  })
}

// Add a daily to a given book
exports.createDaily = function (req, res) {
  const newDaily = {
    date: req.body.date,
    book_id: req.body.book_id,
    currentPage: req.body.currentPage
  }

  // Construct query
  const query = {
    '_id': req.user._id
  }

  // Apply the update and respond
  User.findOneAndUpdate(query, { $push: { dailies: newDaily } }, { new: true }, function (err, updatedUser) {
    if (err) return console.error(err)
    const freshDailies = extractDailiesByBook(updatedUser.dailies, newDaily.book_id)
    res.send(freshDailies)
  })
}

// Update a daily that already exists
exports.updateDaily = function (req, res) {
  const updateCurrentPage = req.body.currentPage

  // Construct query
  const query = {
    '_id': req.user._id,
    'dailies._id': req.params.id
  }

  // console.log(query);

  // Apply the update and respond
  User.findOneAndUpdate(query, { $set: { 'dailies.$.currentPage': updateCurrentPage } }, { new: true }, function (err, updatedUser) {
    if (err) return console.error(err)
    // console.log(updatedUser);
    const updatedDaily = updatedUser.dailies.find( (daily) => {
      return daily._id.toString() === req.params.id.toString()
    })

    res.send(updatedDaily)
  })
}

// Get dailies around a given date
exports.getDailies = function (req, res) {
  User
    .findOne({ '_id': req.user._id }, 'books dailies')
    .populate({
      path: 'dailies.book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    })
    .populate({
      path: 'books.book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    })
    .exec(function (err, user) {
      // Get user's current books
      const currentBooks = [];

      user.books.forEach((book) => {
        if (book.status[0] === "Current") {
          currentBooks.push({
            book_id: book.book_id._id,
            thumbnailUrl: book.book_id.thumbnailUrl,
            authors: book.book_id.authors,
            title: book.book_id.title
          })
        }
      })

      // Get dailiesRange and todayRange
      const dateQuery = moment.utc(req.params.date)

      // Set date boundaries
      const dateMax = dateQuery
      const dateMin = moment.utc(dateQuery.clone().add(-30, 'days')) // clone is become moment() objects are mutable

      // Filter through all users dailies to return ones that fall within date range
      const dailiesMatch = []
      const dailiesRange = []

      user.dailies.forEach((daily) => {
        const date = moment.utc(daily.date)

        // If user has a daily that matches date query,
        if (date.isSame(dateQuery, 'day')) {
          dailiesMatch.push({
            daily_id: daily._id,
            date: daily.date,
            book_id: daily.book_id._id,
            thumbnailUrl: daily.book_id.thumbnailUrl,
            authors: daily.book_id.authors,
            title: daily.book_id.title,
            currentPage: daily.currentPage
          })
        }

        if (date.isSameOrAfter(dateMin) && date.isSameOrBefore(dateMax)) {
          dailiesRange.push({
            date: daily.date,
            book_id: daily.book_id._id,
            thumbnailUrl: daily.book_id.thumbnailUrl,
            authors: daily.book_id.authors,
            title: daily.book_id.title,
            currentPage: daily.currentPage
          })
        }
      })

      res.send({
        currentBooks: currentBooks,
        dailiesRange: dailiesRange,
        dailiesMatch: dailiesMatch
      })
    })

  // 1) BOOKS PROGRESS ENTRY
  // dailies/:date
    // get all entries where entry.date matches params.date
      // if no entries for current date (ie. date has not been logged)
        // books = user.books.current
      // if entries exists for params.date (ie. date has been logged previously)
        // books = entries.forEach(book)
    // (always provide option to add an outside book to today's entry...)



  // 2) PROGRESS View
    // load last 30 days of entries
      // when user clicks on a day,
        // push to dailies:/date
}

// Update the current book
exports.updateBook = function (req, res) {
  const requestedUpdate = req.body

  // Construct query
  const query = {
    '_id': req.user._id,
    'books.book_id': req.params.id
  }

  // Construct granular update of subdocs dynamically.
  // Update the specified book with whatever parameters provided by request
  const update = {}
  for (let key in requestedUpdate) {
    update[`books.$.${key}`] = requestedUpdate[key]
  }

  // Apply the update and respond
  User.findOneAndUpdate(query, { $set: update }, { new: true }, function (err, updatedUser) {
    if (err) return console.error(err)
    res.send(requestedUpdate)
  })
}

// Delete the current book
exports.deleteBook = function (req, res) {
  const removeBookFromUser = User.findOneAndUpdate(
    { '_id': req.user._id },
    {
      '$pull': {
        books: { book_id: req.params.id }
      }
    }
  )
  const removeUserFromBook = Book.findOneAndUpdate(
    { '_id': req.params.id },
    { '$pull': { users: req.user._id } }
  )

  Promise.all([removeBookFromUser, removeUserFromBook]).then(function (results) {
    res.send(results)
  }).catch(function (error) {
    console.log('Error deleting book:', error)
  })
}
