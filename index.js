const OpenAI = require('openai');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const app = express();
app.use(express.static('public'));
const openAI = new OpenAI({
    apiKey: process.env.OPEN_AI_KEY
});
const os = require('os');
const path = require('path');
const sysMessage = [
    { "role": "system", "content": "You are a translator. Please translate Mandarin into English, and English into Mandarin. If you don't understand, then don't say anything!  Example User entry: 'How is the weather?'  Example Assistant reply: '??????' " },
];
let userMessages = [];
let finalMessage = [];
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, os.tmpdir())
    },
    filename: function (req, file, cb) {
        cb(null, path.basename(file.originalname, path.extname(file.originalname)) + '.mp3');
    }
});

const upload = multer({ storage: storage });
app.get('/', (req, res) => {
    res.sendFile('./public/frontend.htm', {root: __dirname});
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
    const filePath = req.file.path; // get the path of the uploaded file
    //const tempDir = os.tmpdir(); 
    //const filePath = path.join(tempDir, req.file.originalname);
    try {
        const response = await openAI.audio.transcriptions.create({
            model: 'whisper-1',
            file: fs.createReadStream(filePath),
        });
        if (response) {
            let transcription = response.text; 
            userMessages.push({ "role": "user", "content": transcription });
            if (userMessages.length > 7) { //keep only 4 of each type
                userMessages.shift(); // Removes the oldest entry
            }
            finalMessage = sysMessage.concat(userMessages);
            const chatCompletion = await openAI.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: finalMessage,
            });
            userMessages.push(chatCompletion.choices[0].message);
            if (userMessages.length > 8) { //keep only 4 of each type
                userMessages.shift(); // Removes the oldest entry
            }
            console.log(JSON.stringify(finalMessage, null, 2)); 
            res.json([ chatCompletion.choices[0].message, response.text ]); 
        } else {
            res.status(500).send("No transcription received from API");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);

    }

    fs.unlink(filePath, (err) => { 
        if (err) console.error(`Error deleting file ${filePath}`);
    });
});

const port = process.env.PORT || 1337;
app.listen(port, () => console.log(`Server running on port ${port}`));
