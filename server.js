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

// HTML & TEXT email templates
function createBuyerMessageHtml({ name, surname, email, quantity }) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #111;">🎟️ Conferma acquisto biglietti - Dirty Rain Fest Atto 2 - 15/11/2025</h2>
        <p>Grazie per il tuo acquisto! Abbiamo ricevuto il pagamento per <strong>${quantity}</strong> prevendita/e. Presenta questa email direttamente in cassa.</p>
        
        <hr style="margin: 20px 0;">
        
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Cognome:</strong> ${surname}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Quantità:</strong> ${quantity}</p>
        
        <hr style="margin: 20px 0;">
        
        <p>Ti aspettiamo all’evento! 🎶</p>
        
        <p style="margin-top: 20px;">
          🎫 Ingresso riservato agli associati <strong>AICS 2025-26</strong> [Tessera AICS valida anche al FreakOut Club, Locomotiv Club, Binario69, Studio54 TANK e su tutto il territorio nazionale] che abbiano perfezionato la propria affiliazione.
        </p>
        
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Contattaci: rain.info@raincrew.com</p>
      </div>
    </div>
  `;
}

function createBuyerMessageText({ name, surname, email, quantity }) {
  return `
🎟️ Conferma acquisto biglietti - Dirty Rain Fest Atto 2 - 15/11/2025

Grazie per il tuo acquisto! Abbiamo ricevuto il pagamento per ${quantity} prevendita/e. Presenta questa email direttamente in cassa.

Nome: ${name}
Cognome: ${surname}
Email: ${email}
Quantità: ${quantity}

Ti aspettiamo all’evento! 🎶

Contattaci: rain.info@raincrew.com
  `;
}

function createOrganizerMessageHtml({ name, surname, formEmail, paypalEmail, quantity }) {
  return `
    <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #111;">✅ Pagamento ricevuto</h2>
        <p>Nuovo acquisto confermato per il Dirty Rain Fest Atto 2 - 15/11/2025:</p>
        <hr style="margin: 20px 0;">
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Cognome:</strong> ${surname}</p>
        <p><strong>Email PayPal:</strong> ${paypalEmail}</p>
        <p><strong>Email form:</strong> ${formEmail}</p>
        <p><strong>Quantità:</strong> ${quantity}</p>
        <p style="margin-top: 30px; font-size: 12px; color: #888;">Contatto cliente: ${formEmail}</p>
      </div>
    </div>
  `;
}

function createOrganizerMessageText({ name, surname, formEmail, paypalEmail, quantity }) {
  return `
✅ Pagamento ricevuto - Dirty Rain Fest Atto 2 - 15/11/2025

Nuovo acquisto confermato:

Nome: ${name}
Cognome: ${surname}
Email PayPal: ${paypalEmail}
Email form: ${formEmail}
Quantità: ${quantity}

Contatto cliente: ${formEmail}
  `;
}

// IPN endpoint
app.post('/api/ipn', (req, res) => {
  console.log('📩 IPN ricevuto:', req.body);
  res.status(200).send('OK');

  ipn.verify(req.body, { allow_sandbox: false }, async function (err, msg) {
    if (err) {
      console.error('❌ Errore verifica IPN:', err);
    } else if (req.body.payment_status === 'Completed') {
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
          html: createOrganizerMessageHtml({ name, surname, formEmail, paypalEmail, quantity }),
          text: createOrganizerMessageText({ name, surname, formEmail, paypalEmail, quantity }),
          headers: {
            'X-Mailer': 'NodeMailer',
            'X-Originating-IP': req.ip,
            'Reply-To': process.env.EMAIL_SENDER
          }
        });

        // Email all'utente
        if (formEmail) {
          await transporter.sendMail({
            from: `"Dirty Rain Fest" <${process.env.EMAIL_SENDER}>`,
            to: formEmail,
            subject: 'Conferma acquisto biglietti',
            html: createBuyerMessageHtml({ name, surname, email: formEmail, quantity }),
            text: createBuyerMessageText({ name, surname, email: formEmail, quantity }),
            headers: {
              'X-Mailer': 'NodeMailer',
              'X-Originating-IP': req.ip,
              'Reply-To': process.env.EMAIL_SENDER
            }
          });
          console.log(`📧 Email inviata a ${formEmail}`);
        } else {
          console.warn('⚠️ Nessuna email utente disponibile per l\'invio');
        }

      } catch (err) {
        console.error('❌ Errore nell\'invio delle email:', err);
      }
    }
  });
});

// Genera link PayPal
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
