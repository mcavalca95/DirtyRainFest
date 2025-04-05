document.getElementById('preorder-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.target;

  // Pulisce gli errori precedenti
  document.querySelectorAll('.error').forEach(el => el.textContent = '');

  const name = form.name.value.trim();
  const surname = form.surname.value.trim();
  const email = form.email.value.trim();
  const quantity = parseInt(form.quantity.value);

  let valid = true;

  if (name === '') {
    document.getElementById('error-name').textContent = 'Il nome è obbligatorio';
    valid = false;
  }

  if (surname === '') {
    document.getElementById('error-surname').textContent = 'Il cognome è obbligatorio';
    valid = false;
  }

  if (email === '') {
    document.getElementById('error-email').textContent = 'L\'email è obbligatoria';
    valid = false;
  } else if (!/\S+@\S+\.\S+/.test(email)) {
    document.getElementById('error-email').textContent = 'Email non valida';
    valid = false;
  }

  if (isNaN(quantity) || quantity < 1) {
    document.getElementById('error-quantity').textContent = 'Inserisci una quantità valida (minimo 1)';
    valid = false;
  }

  if (!valid) return;

  // Se i dati sono validi, invia la richiesta
  const data = { name, surname, email, quantity };

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const { paypalLink } = await res.json();
    window.location.href = paypalLink;
  } catch (err) {
    alert('Errore durante la creazione del pagamento. Riprova più tardi.');
  }
});
