
/**
* Make any changes you need to make to the database here
*/
export async function up () {
  const User = require('../models/user')
  // Write migration here
  await this('User').update({'isVerified'}, {
    $unset: { unique: '' }
  }, { multi: true });
}

/**
* Make any changes that UNDO the up function side effects here (if possible)
*/
export async function down () {
  // Write migration here
}


//
// 'use strict';
//
// function doSomeWork() {
//   await this('User').update({'isVerified'}, {
//     $unset: { unique: '' }
//   }, { multi: true });
// }
//
// /**
//  * Make any changes you need to make to the database here
//  */
// exports.up = function up (done) {
//   return doSomeWork().then(function() {
//     // Don't forget to call done() or the migration will never finish!
//     done();
//   })
//   .catch(function(error){
//     // If you get an error in your async operations you can call done like so
//     done(error);
//   });
//
//   // Throwing errors also works
//   throw new Error('It should never get here!');
// };
//
// /**
//  * Make any changes that UNDO the up function side effects here (if possible)
//  */
// exports.down = function down(done) {
//   done()
// };
