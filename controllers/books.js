const Book = require('../models/book')
const User = require('../models/user')
const Daily = require('../models/daily')
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
      if (err) return console.error(err)

      let results = user.books.map(function (book) {
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
  const bookGeneral = Book.findById(req.params.id)
    .select(['_id', 'title', 'authors', 'thumbnailUrl'])

  const bookPersonal = User.findById(req.user._id)
    .populate({
      path: 'dailies',
      select: ['_id', 'date', 'book_id', 'currentPage'],
      match: {
        'book_id': req.params.id
      },
      options: {
        sort: { date: -1 }
      }
    })
    .select([
      'dailies',
      'books'
    ])
    .exec()

  Promise.all([bookGeneral, bookPersonal]).then((results) => {
    // Get user specific data
    const bookPersonal = results[1].books.find((item) => {
      return (item.book_id.toString() === req.params.id.toString())
    })

    res.send({
      status: bookPersonal.status[0],
      totalPages: bookPersonal.totalPages,
      dailies: results[1].dailies,
      notes: bookPersonal.notes,
      _id: results[0]._id,
      thumbnailUrl: results[0].thumbnailUrl,
      authors: results[0].authors,
      title: results[0].title
    })
  }).catch((error) => {
    return res.status(404).send({ message: `Error getting book: ${error}` })
  })
}

// Add a daily to a given book
exports.createDaily = function (req, res) {
  const newDaily = new Daily({
    date: req.body.date,
    user_id: req.user._id,
    book_id: req.body.book_id,
    currentPage: req.body.currentPage
  })

  let savedDaily

  let queryOptions = {
    path: 'dailies',
    match: {},
    options: {
      sort: { date: -1 }
    }
  }

  // If request specifies a minimum date, only retrieve dailies after that date
  if (req.body.filterByThisBook) {
    queryOptions.match['book_id'] = req.body.book_id
  }

  // Save Daily document
  newDaily.save().then((newDaily) => {
    // Save daily to scope so we can respond with it
    savedDaily = newDaily

    // Add daily to User document
    return User.findByIdAndUpdate(
      req.user._id,
      { $push: { dailies: savedDaily._id } },
      { new: true })
      .populate(queryOptions)
      .exec()
  }).then((newUser) => {
    console.log(newUser);
    res.send(newUser.dailies)
  }).catch((error) => {
    console.log(error)
    return res.status(404).send({ message: error })
  });
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
// Params allowed:
  // date: doesn't do anything yet!
  // dateMin: only return dailies after this date, defaults to none
  // bookID: only return dailies for this book, defaults none
exports.getDailiesByDate = function (req, res) {
  const dateQuery = moment.utc(req.query.date) || moment.utc()

  let queryOptions = {
    path: 'dailies',
    select: ['_id', 'date', 'book_id', 'currentPage'],
    options: {
      sort: { date: -1 }
    },
    match: {},
    populate: {
      path: 'book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    }
  }

  // If request specifies a minimum date, only retrieve dailies after that date
  if (req.query.dateMin) {
    queryOptions.match['date'] = {
      '$gt': moment.utc(req.query.dateMin)
    }
  }

  // If request specifies dailies for a particular book,
  // only return dailies for that book
  if (req.query.bookId) {
    queryOptions.match['book_id'] = req.query.bookId
  }

  // Get dailies from specific user
  User
    .findOne({ '_id': req.user._id }, 'books dailies')
    .populate(queryOptions)
    .populate({
      path: 'books.book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    })
    .exec()
    .then((user) => {
      // // Get user's current books
      // const currentBooks = [];
      //
      // user.books.forEach((book) => {
      //   if (book.status[0] === "Current") {
      //     currentBooks.push({
      //       book_id: book.book_id._id,
      //       thumbnailUrl: book.book_id.thumbnailUrl,
      //       authors: book.book_id.authors,
      //       title: book.book_id.title
      //     })
      //   }
      // })

      const dailies = user.dailies.map((daily) => {
        return {
          daily_id: daily._id,
          date: daily.date,
          book_id: daily.book_id._id,
          thumbnailUrl: daily.book_id.thumbnailUrl,
          authors: daily.book_id.authors,
          title: daily.book_id.title,
          currentPage: daily.currentPage
        }
      })

      res.send(dailies);
    }).catch(function (error) {
      return res.status(404).send({ message: error })
    })
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
