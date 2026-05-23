const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// ==========================================
// 1. PERMANENT DATABASE CONFIGURATION
// ==========================================
// Paste your link from MongoDB Atlas here when you have it!
const MONGO_URI = "YOUR_MONGODB_ATLAS_CONNECTION_STRING_HERE";

mongoose.connect(MONGO_URI)
    .then(() => console.log("[X-SIM DB]: Connected securely to cloud storage."))
    .catch(err => console.error("[X-SIM DB]: Connection error:", err));

// Database Schema enforcing data integrity
const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    nin: { type: String, required: true, unique: true }, 
    physicalLine: { type: String, required: true },
    xSimNumber: { type: String, required: true, unique: true } 
});

const XSimUser = mongoose.model('XSimUser', UserSchema);

const getNextAvailableNumber = async () => {
    const totalUsers = await XSimUser.countDocuments();
    const baseNumber = 2349160703168;
    return `+${baseNumber + totalUsers}`;
};

// ==========================================
// 2. THE USSD GATEWAY ENGINE (*384*60505#)
// ==========================================
app.post('/ussd', async (req, res) => {
    const { phoneNumber, text } = req.body;

    let response = '';
    let textArray = text ? text.split('*') : [];
    let currentStep = textArray.length;

    if (currentStep === 0) {
        response = `CON Welcome to X-SIM: Connected Forever.\n1. Register / Activate X-SIM\n2. Recover My Number`;
    } 
    
    else if (textArray[0] === '1') {
        if (currentStep === 1) {
            response = `CON Enter your Full Name:`;
        } 
        else if (currentStep === 2) {
            response = `CON Enter your 11-digit NIN:`;
        } 
        else if (currentStep === 3) {
            const fullName = textArray[1];
            const nin = textArray[2];

            if (nin.length !== 11 || isNaN(nin)) {
                response = `END Activation Failed. Invalid NIN format.`;
            } else {
                try {
                    const existingUser = await XSimUser.findOne({ nin });
                    if (existingUser) {
                        return res.send(`END Access Denied. This NIN already owns line: ${existingUser.xSimNumber}`);
                    }

                    const assignedNumber = await getNextAvailableNumber();

                    const newUser = new XSimUser({
                        fullName,
                        nin,
                        physicalLine: phoneNumber,
                        xSimNumber: assignedNumber
                    });

                    await newUser.save();
                    response = `END Success! Your X-SIM is now fully provisioned.\nYour Number: ${assignedNumber}\nNo plastic needed. Connected forever.`;
                } catch (error) {
                    response = `END Allocation error. Please try again later.`;
                }
            }
        }
    } 
    
    else if (textArray[0] === '2') {
        if (currentStep === 1) {
            response = `CON Enter your 11-digit NIN to recover your virtual line:`;
        } else if (currentStep === 2) {
            const recoveryNin = textArray[1];
            const user = await XSimUser.findOne({ nin: recoveryNin });

            if (user) {
                response = `END Profile Found!\nX-SIM Line: ${user.xSimNumber}\nRegistered To: ${user.fullName}`;
            } else {
                response = `END No active X-SIM profile found matching this identification number.`;
            }
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// ==========================================
// 3. VOICE CALL ROUTING ENGINE (The Code You Sent)
// ==========================================
app.post('/voice', async (req, res) => {
    const { callerNumber, destinationNumber } = req.body;

    console.log(`[X-SIM VOICE]: Incoming call from ${callerNumber} to virtual line ${destinationNumber}`);

    let responseXML = '';

    try {
        const user = await XSimUser.findOne({ xSimNumber: destinationNumber });

        if (user) {
            responseXML = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Dial phoneNumbers="${user.physicalLine}" callerId="${destinationNumber}" maxDuration="300"/>
            </Response>`;
        } else {
            responseXML = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="woman">The X-SIM number you have dialed is currently not active.</Say>
            </Response>`;
        }
    } catch (error) {
        responseXML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="woman">X-SIM network busy. Please try again later.</Say>
        </Response>`;
    }

    res.set('Content-Type', 'application/xml');
    res.send(responseXML);
});

// ==========================================
// 4. CORE ENGINE BOOT (Always stays at the very bottom)
// ==========================================
app.listen(PORT, () => {
    console.log(`[X-SIM CORE ENGINE]: Running on port ${PORT}`);
});
               
