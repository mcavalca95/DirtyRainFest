// server.js
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const ipn = require('paypal-ipn');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email templates
function createBuyerMessageHtml({ name, surname, email, quantity }) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #111;">🎟️ Conferma acquisto - Dirty Rain Fest</h2>
        <p>Grazie per il tuo acquisto! Abbiamo ricevuto il pagamento per <strong>${quantity}</strong> prevendita/e.</p>
        <hr style="margin: 20px 0;">
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Cognome:</strong> ${surname}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Quantità:</strong> ${quantity}</p>
        <hr style="margin: 20px 0;">
        <p>Ti aspettiamo all’evento! 🎶</p>
      </div>
    </div>
  `;
}

function createOrganizerMessageHtml({ name, surname, formEmail, paypalEmail, quantity }) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #111;">✅ Pagamento ricevuto</h2>
        <p>Nuovo acquisto confermato per il Dirty Rain Fest:</p>
        <hr style="margin: 20px 0;">
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Cognome:</strong> ${surname}</p>
        <p><strong>Email PayPal:</strong> ${paypalEmail}</p>
        <p><strong>Email form:</strong> ${formEmail}</p>
        <p><strong>Quantità:</strong> ${quantity}</p>
      </div>
    </div>
  `;
}

// Endpoint IPN PayPal
app.post('/api/ipn', (req, res) => {
  console.log('📩 IPN ricevuto:', req.body);
  res.status(200).send('OK');

  ipn.verify(req.body, { allow_sandbox: false }, async function (err, msg) {
    if (err) {
      console.error('❌ Errore verifica IPN:', err);
    } else {
      if (req.body.payment_status === 'Completed') {
        const name = req.body.first_name || 'N/D';
        const surname = req.body.last_name || 'N/D';
        const paypalEmail = req.body.payer_email;
        const quantity = req.body.quantity || 1;

        let formEmail = null;
        try {
          const customData = JSON.parse(req.body.custom);
          formEmail = customData.formEmail;
        } catch (e) {
          console.warn('⚠️ Campo custom mancante o non valido');
        }

        try {
          // Email all'organizzatore
          await transporter.sendMail({
            from: `"Prevendite Evento" <${process.env.EMAIL_SENDER}>`,
            to: process.env.EMAIL_ORGANIZER,
            subject: 'Pagamento confermato da PayPal',
            html: createOrganizerMessageHtml({ name, surname, formEmail, paypalEmail, quantity })
          });

          // Email all'utente (solo email del form, se presente)
          if (formEmail) {
            await transporter.sendMail({
              from: `"Prevendite Evento" <${process.env.EMAIL_SENDER}>`,
              to: formEmail,
              subject: 'Conferma pagamento avvenuto',
              html: createBuyerMessageHtml({ name, surname, email: formEmail, quantity })
            });
            console.log(`📧 Email inviata a ${formEmail}`);
          } else {
            console.warn('⚠️ Nessuna email utente disponibile per l\'invio');
          }

        } catch (err) {
          console.error('❌ Errore nell\'invio delle email:', err);
        }
      }
    }
  });
});

// Checkout → genera link PayPal con custom
app.post('/api/checkout', (req, res) => {
  const { name, surname, email, quantity } = req.body;

  const customData = JSON.stringify({ name, surname, formEmail: email });
  const encodedCustom = encodeURIComponent(customData);

  const paypalLink = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${process.env.PAYPAL_EMAIL}&item_name=Prevendite+per+evento&amount=12.00&quantity=${quantity}&currency_code=EUR&notify_url=${process.env.IPN_URL}&custom=${encodedCustom}`;

  console.log('🔗 Link PayPal generato:', paypalLink);

  res.json({ paypalLink });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server attivo su http://localhost:${PORT}`));
