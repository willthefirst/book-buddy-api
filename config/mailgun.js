const mailgun = require('mailgun-js')({ apiKey: process.env.MAILGUN_PRIV_KEY,
  domain: process.env.MAILGUN_DOMAIN });

// Create and export function to send emails through Mailgun API
exports.sendEmail = function (recipient, message) {
  const data = {
    from: 'Will <no-reply@bookbuddy.com>',
    to: recipient,
    subject: message.subject,
    text: message.text
  };

  mailgun.messages().send(data, (error, body) => {
    //  console.log(body);
  });
};
