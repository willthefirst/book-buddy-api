const Book = require('../models/book')
const User = require('../models/user')
const Daily = require('../models/daily')
const moment = require('moment')

// Get all the books
// Params: q=title query, status= status query
exports.getBooks = function (req, res) {
  let bookQueryOptions = {
    path: 'books.book_id',
    select: ['thumbnailUrl', 'title', 'authors']
  }

  let userCriteria = {
    '_id': req.user._id,
  }

  User
  .findOne(userCriteria, 'books')
  .populate(bookQueryOptions)
  .exec(function (err, user) {
    if (err) return console.error(err)
    if (!user) {
      res.send('No results.')
    } else {
      let results = user.books.map(function (book) {
        return {
          book_id: book.book_id._id,
          title: book.book_id.title,
          authors: book.book_id.authors,
          thumbnailUrl: book.book_id.thumbnailUrl,
          status: book.status
        }
      })

      if (req.query.status) {
        results = results.filter(function(book) {
          return book.status === req.query.status
        })
      }

      if (req.query.q) {
        const regEx = new RegExp('.*' + req.query.q + '.*', 'i')

        results = results.filter(function(book) {
          return regEx.test(book.title)
        })
      }

      res.send(results)
    }
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
      return user
    })

    // Save user to book
    book.users.push(req.user._id)
    const saveUserToBook = book.save().then(function (book) {
      return book
    })

    return Promise.all([saveBookToUser, saveUserToBook]).then(function (results) {
      return results
    })
  }).then(function (results) {
    const updatedBook = results[1]
    res.send(updatedBook)
  }).catch(function (error) {
    return res.status(404).send({ message: `Error creating book: ${error}` })
  })
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
      status: bookPersonal.status,
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


let dailyDefaults = {
  populateOptions: {
    path: 'dailies',
    match: {},
    options: {
      sort: { date: -1 }
    },
    populate: {
      path: 'book_id',
      select: ['thumbnailUrl', 'title', 'authors']
    }
  }
}


// Add a daily to a given book
exports.createDaily = function (req, res) {
  const newDaily = {
    date: moment.utc(new Date(req.body.date)).format('YYYY-MM-DD'),
    user_id: req.user._id,
    book_id: req.body.book_id,
    currentPage: req.body.currentPage
  }

  // If daily with same book and day exists for user, update it
  // There should only ever be one daily per book per day
  Daily.findOneAndUpdate(
    {
      date: newDaily.date,
      user_id: newDaily.user_id,
      book_id: newDaily.book_id
    },
    newDaily,
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  ).then((newDaily) => {

    // Setting up how we'd like data returned
    let queryOptions = dailyDefaults.populateOptions

    // If request asks for dailies for a specific book, update the query
    if (req.body.filterByThisBook) {
      queryOptions.match['book_id'] = req.body.book_id
    }

    // Add daily to User document
    return User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { dailies: newDaily._id } },
      { new: true })
      .populate(queryOptions)
      .exec()
    }).then((newUser) => {
      // #todo these populate moves for daily are repeated, turn into function
      const dailies = newUser.dailies.map((daily) => {
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
      res.send(dailies)
    }).catch((error) => {
      return res.status(404).send({ message: error.message })
    });
  }

// Get dailies around a given date
// Params allowed:
// date: doesn't do anything yet!
// dateMin: only return dailies after this date, defaults to none
// bookID: only return dailies for this book, defaults none
exports.getDailiesByDate = function (req, res) {
  const dateQuery = moment.utc(new Date(req.query.date)) || moment.utc()

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

exports.deleteDaily = function (req, res) {
  Daily.findOneAndRemove({
    date: req.body.date,
    book_id: req.body.book_id,
    user_id: req.user._id
  }).exec().then((daily) => {
    if (!daily) {
      res.send('Nothing to delete')
      return
    }

    User
    .findOneAndUpdate(
      { '_id': req.user._id },
      {
        $pull: {
          dailies: daily._id
        }
      },
      {
        select: 'dailies',
        new: true
      }
    )
    .populate(dailyDefaults.populateOptions)
    .exec()
    .then((newUser) => {
      const dailies = newUser.dailies.map((daily) => {
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
      res.send(dailies)
    })
    .catch((error) => {
      return res.status(404).send({ message: error })
    })
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
    return res.status(404).send({ message: `Error deleteing book: ${error}` })
  })
}
