const OpenAI = require('openai');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const app = express();
app.use(express.static('public'));
const openAI = new OpenAI({
    apiKey: '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'//process.env.OPENAI_API_KEY 
});
//const upload = multer({ dest: 'uploads/' }); // store files in an 'uploads' folder
const path = require('path');
const sysMessage = [
    { "role": "system", "content": "You are a translator. Please repeat everything said in Mandarin into English, and repeat everything said in English into Mandarin. If you don't understand, then don't say anything!" },
];
let userMessages = [];
let finalMessage = [];
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        // Generate a unique filename: originalname + timestamp + .mp3
        cb(null, path.basename(file.originalname, path.extname(file.originalname)) + '.mp3');
    }
});

const upload = multer({ storage: storage });
app.get('/', (req, res) => {
    res.sendFile('./public/frontend.htm', {root: __dirname});
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
    const filePath = req.file.path; // get the path of the uploaded file
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
            console.log(JSON.stringify(finalMessage, null, 2)); // Prints the chat response
            res.json([ chatCompletion.choices[0].message, response.text ]); //added response.. maybe not proper json
        } else {
            res.status(500).send("No transcription received from API");
        }
    } catch (error) {
        console.error(error);
        res.status(500).send(error.message);

    }

    fs.unlink(filePath, (err) => { // delete the uploaded file after transcription
        if (err) console.error(`Error deleting file ${filePath}`);
    });
});

const port = 1337;
app.listen(port, () => console.log(`Server running on port ${port}`));
