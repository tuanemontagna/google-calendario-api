const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const express = require('express');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.get('/list-events', async (req, res) => {
  try {
    const auth = await authorize();
    const calendar = google.calendar({version: 'v3', auth});
    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });
    const events = eventsResponse.data.items;
    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      url: event.htmlLink,
    }));
    res.status(200).json(formattedEvents);
  } catch (error) {
    console.error("Erro ao listar eventos:", error);
    res.status(500).json({ message: 'Falha ao listar os eventos.' });
  }
});

app.post('/create-event', async (req, res) => {
  try {
    const auth = await authorize();
    const calendar = google.calendar({version: 'v3', auth});
    const eventDetails = req.body;
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: eventDetails,
      conferenceDataVersion: 1,
      sendUpdates: 'all',
    });
    res.status(200).json({
      message: 'Evento criado com sucesso!',
      link: response.data.htmlLink
    });
  } catch (error) {
    console.error("Erro ao criar evento:", error);
    res.status(500).json({ message: 'Falha ao criar o evento.' });
  }
});

app.patch('/update-event/:eventId', async (req, res) => {
  try {
    const auth = await authorize();
    const calendar = google.calendar({version: 'v3', auth});
    const { eventId } = req.params; 
    const eventPatchDetails = req.body; 

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      resource: eventPatchDetails,
    });

    res.status(200).json({
      message: 'Evento atualizado com sucesso!',
      event: response.data
    });
  } catch (error) {
    console.error("Erro ao atualizar evento:", error);
    res.status(500).json({ message: 'Falha ao atualizar o evento.' });
  }
});


app.delete('/delete-event/:eventId', async (req, res) => {
  try {
    const auth = await authorize();
    const calendar = google.calendar({version: 'v3', auth});
    const { eventId } = req.params; 

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    res.status(200).json({ message: 'Evento deletado com sucesso.' });
  } catch (error) {
    console.error("Erro ao deletar evento:", error);
    res.status(500).json({ message: 'Falha ao deletar o evento.' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});