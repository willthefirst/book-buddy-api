const User = require('../models/user')
/**
 * Make any changes you need to make to the database here
 */
export async function up () {
  // Write migration here
  await User.update({$eq: 'isVerified'}, {
    $unset: { unique: '' }
  }, { multi: true });
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
export async function down () {
  // Write migration here
}
