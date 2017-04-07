const User = require('../models/user')
/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  // Write migration here
  // console.log(User.schema);
  // await User.update({$eq: 'isVerified'}, {
  //   $unset: { unique: '' }
  // }, { multi: true });
  await this('User').find()
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  // Write migration here
}
