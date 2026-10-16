import { RecordingsApi, Configuration, Bxml } from 'bandwidth-sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BW_ACCOUNT_ID = process.env.BW_ACCOUNT_ID;
const BW_CLIENT_ID = process.env.BW_CLIENT_ID;
const BW_CLIENT_SECRET = process.env.BW_CLIENT_SECRET;
const LOCAL_PORT = process.env.LOCAL_PORT;

if([
    BW_ACCOUNT_ID,
    BW_CLIENT_ID,
    BW_CLIENT_SECRET,
    LOCAL_PORT
].some(item => item === undefined) || !Number.isInteger(Number(LOCAL_PORT))) {
    throw new Error('Please set the environment variables defined in the README');
}

const config = new Configuration({
    clientId: BW_CLIENT_ID,
    clientSecret: BW_CLIENT_SECRET
});

const app = express();
app.use(express.json());

app.post('/callbacks/inbound/voice', async (req, res) => {
    if (req.body?.eventType !== 'initiate') {
        return res.sendStatus(400);
    }

    const unavailableSpeakSentence = new Bxml.SpeakSentence('You have reached Vandelay Industries, Kal Varnsen is unavailable at this time.');
    const messageSpeakSentence = new Bxml.SpeakSentence('At the tone, please record your message, when you have finished recording, you may hang up.');
    const playAudio = new Bxml.PlayAudio('/tone.mp3');
    const record = new Bxml.Record({ recordingAvailableUrl: '/callbacks/inbound/voice/recordingAvailable', maxDuration: 30 });
    const response = new Bxml.Response([unavailableSpeakSentence, messageSpeakSentence, playAudio, record]);

    res.set('Content-Type', 'application/xml');
    res.status(200).send(response.toBxml());
});

app.get('/tone.mp3', async (req, res) => {
    res.set('Content-Type', 'audio/mpeg');
    res.status(200).sendFile('tone.mp3', { root: __dirname });
});

app.post('/callbacks/inbound/voice/recordingAvailable', async (req, res) => {
    const {eventType, fileFormat, callId, recordingId} = req.body ?? {};

    if (eventType !== 'recordingAvailable') {
        return res.sendStatus(400);
    }

    try {
        const recordingsApi = new RecordingsApi(config);
        const { data } = await recordingsApi.downloadCallRecording(
            BW_ACCOUNT_ID,
            callId,
            recordingId,
            { responseType: 'arraybuffer' }
        );
        await fs.promises.writeFile(`./${recordingId}.${fileFormat}`, data);
    } catch (err) {
        console.error('Failed to download recording:', err.message);
        return res.sendStatus(500);
    }

    res.sendStatus(204);
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.sendStatus(400);
    }
    next(err);
});

app.listen(LOCAL_PORT);
