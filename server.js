const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

let testUser = null;

const getNextAvailableNumber = () => {
    return `+2349160703168`;
};

// ==========================================
// 2. THE USSD GATEWAY ENGINE (*384*60505#)
// ==========================================
app.post('/ussd', (req, res) => {
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
                const assignedNumber = getNextAvailableNumber();
                
                testUser = {
                    fullName,
                    nin,
                    physicalLine: phoneNumber,
                    xSimNumber: assignedNumber
                };

                response = `END Success! Your X-SIM is now fully provisioned.\nYour Number: ${assignedNumber}\nNo plastic needed. Connected forever.`;
            }
        }
    } 
    
    else if (textArray[0] === '2') {
        if (currentStep === 1) {
            response = `CON Enter your 11-digit NIN to recover your virtual line:`;
        } else if (currentStep === 2) {
            const recoveryNin = textArray[1];

            if (testUser && testUser.nin === recoveryNin) {
                response = `END Profile Found!\nX-SIM Line: ${testUser.xSimNumber}\nRegistered To: ${testUser.fullName}`;
            } else {
                response = `END No active X-SIM profile found matching this identification number.`;
            }
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// ==========================================
// 3. VOICE CALL ROUTING ENGINE
// ==========================================
app.post('/voice', (req, res) => {
    const { callerNumber, destinationNumber } = req.body;

    let responseXML = '';

    if (testUser && destinationNumber === testUser.xSimNumber) {
        responseXML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Dial phoneNumbers="${testUser.physicalLine}" callerId="${destinationNumber}" maxDuration="300"/>
        </Response>`;
    } else {
        responseXML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="woman">The X-SIM number you have dialed is currently not active.</Say>
        </Response>`;
    }

    res.set('Content-Type', 'application/xml');
    res.send(responseXML);
});

app.listen(PORT, () => {
    console.log(`[X-SIM CORE ENGINE]: Running on port ${PORT}`);
});
