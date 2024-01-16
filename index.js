import { RecordingsApi, Configuration, Bxml } from 'bandwidth-sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BW_ACCOUNT_ID = process.env.BW_ACCOUNT_ID;
const BW_VOICE_APPLICATION_ID = process.env.BW_VOICE_APPLICATION_ID;
const BW_NUMBER = process.env.BW_NUMBER;
const BW_USERNAME = process.env.BW_USERNAME;
const BW_PASSWORD = process.env.BW_PASSWORD;
const LOCAL_PORT = process.env.LOCAL_PORT;
const BASE_CALLBACK_URL = process.env.BASE_CALLBACK_URL;

if([
    BW_ACCOUNT_ID,
    BW_VOICE_APPLICATION_ID,
    BW_NUMBER,
    BW_USERNAME,
    BW_PASSWORD,
    LOCAL_PORT,
    BASE_CALLBACK_URL
].some(item => item === undefined)) {
    throw new Error('Please set the environment variables defined in the README');
}

const config = new Configuration({
    username: BW_USERNAME,
    password: BW_PASSWORD
});

const app = express();
app.use(express.json());

app.post('/callbacks/inboundCall', async (req, res) => {
    const unavailableSpeakSentence = new Bxml.SpeakSentence('You have reached Vandelay Industries, Kal Varnsen is unavailable at this time.');
    const messageSpeakSentence = new Bxml.SpeakSentence('At the tone, please record your message, when you have finished recording, you may hang up.');
    const playAudio = new Bxml.PlayAudio('Tone.mp3');
    const record = new Bxml.Record({ recordingAvailableUrl: '/callbacks/recordingAvailableCallback' });
    const response = new Bxml.Response([unavailableSpeakSentence, messageSpeakSentence, playAudio, record]);

    res.status(200).send(response.toBxml());
});

app.get('/callbacks/Tone.mp3', async (req, res) => {
    res.set('Content-Type', 'audio/mp3');
    res.status(200).sendFile('Tone.mp3', { root: __dirname });
});

app.post('/callbacks/recordingAvailableCallback', async (req, res) => {
    const {eventType, fileFormat, callId, recordingId} = req.body;

    if (eventType === 'recordingAvailable') {
        const recordingsApi = new RecordingsApi(config);
        const { data } = await recordingsApi.downloadCallRecording(
            BW_ACCOUNT_ID,
            callId,
            recordingId,
            { responseType: 'arraybuffer' }
        );
        fs.writeFile(`./${recordingId}.${fileFormat}`, data, (err) => {
            if (err) throw err;
        });
    }
});

app.listen(LOCAL_PORT);
