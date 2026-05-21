const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 3000;

// ==========================================
// 1. DATABASE & MEMORY POOL (MVP Simulation)
// ==========================================

// Realistic pool of unassigned Nigerian X-SIM numbers (+234916 prefix)
// Managed atomically to ensure zero duplicate allocations
const availableXSimPool = [
    "+2349160703168",
    "+2349160703169",
    "+2349160703170",
    "+2349160703171",
    "+2349160703172"
];

// Production-ready data structure mimicking Unique Database Constraints
const activeXSimRegistry = new Map(); // Key: X-SIM Number, Value: User Profile
const registeredNins = new Set();    // Ensures a NIN can only register once

// ==========================================
// 2. THE USSD REGISTRATION GATEWAY (*111#)
// ==========================================
app.post('/ussd', (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = '';
    let textArray = text ? text.split('*') : [];
    let currentStep = textArray.length;

    // STEP 0: Main Menu
    if (currentStep === 0) {
        response = `CON Welcome to X-SIM: Connected Forever.\n1. Register / Activate X-SIM\n2. Recover My Number`;
    } 
    
    // BRANCH 1: Registration Flow
    else if (textArray[0] === '1') {
        if (currentStep === 1) {
            response = `CON Enter your Full Name:`;
        } 
        else if (currentStep === 2) {
            response = `CON Enter your 11-digit NIN (National Identification Number):`;
        } 
        else if (currentStep === 3) {
            const fullName = textArray[1];
            const nin = textArray[2];

            // Core Validation Layer
            if (nin.length !== 11 || isNaN(nin)) {
                response = `END Activation Failed. Invalid NIN format. Must be 11 digits.`;
            } else if (registeredNins.has(nin)) {
                response = `END Access Denied. This NIN is already linked to an active X-SIM profile.`;
            } else {
                // ATOMIC ALLOCATION ENGINE: Pull one number safely from the array
                // In production, this maps directly to an atomic Redis Redis LPOP command
                const assignedNumber = availableXSimPool.shift();

                if (!assignedNumber) {
                    response = `END System busy. No remaining virtual lines available in this network sector.`;
                } else {
                    // Lock down the data structures to guarantee absolute uniqueness
                    registeredNins.add(nin);
                    activeXSimRegistry.set(assignedNumber, {
                        fullName,
                        nin,
                        physicalLine: phoneNumber // Map to the user's hosting device
                    });

                    response = `END Success! Your X-SIM is now fully provisioned.\nYour Number: ${assignedNumber}\nNo plastic needed. Connected forever.`;
                }
            }
        }
    } 
    
    // BRANCH 2: Instant Identity Recovery Flow
    else if (textArray[0] === '2') {
        if (currentStep === 1) {
            response = `CON Enter your 11-digit NIN to recover your virtual line:`;
        } else if (currentStep === 2) {
            const recoveryNin = textArray[1];
            let foundUser = null;
            let foundXSimNumber = null;

            // Search registry safely
            for (let [xSim, profile] of activeXSimRegistry.entries()) {
                if (profile.nin === recoveryNin) {
                    foundUser = profile;
                    foundXSimNumber = xSim;
                    break;
                }
            }

            if (foundUser) {
                response = `END Profile Found!\nX-SIM Line: ${foundXSimNumber}\nRegistered To: ${foundUser.fullName}`;
            } else {
                response = `END No active X-SIM profile found matching this identification number.`;
            }
        }
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// ==========================================
// 3. THE CLOUD VOICE SWITCHBOARD (Call Routing)
// ==========================================
app.post('/voice', (req, res) => {
    const { destinationNumber } = req.body;

    // Look up who owns the incoming dialed virtual line
    const userProfile = activeXSimRegistry.get(destinationNumber);

    let telecomXML = '';

    if (userProfile) {
        // Intercept call in the cloud and instantly tunnel it to their hardware phone
        telecomXML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Dial phoneNumbers="${userProfile.physicalLine}" maxDuration="1800"/>
        </Response>`;
    } else {
        // Route to an automated service warning if number does not exist
        telecomXML = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say>The X-SIM line you are trying to reach is currently unassigned.</Say>
        </Response>`;
    }

    res.set('Content-Type', 'application/xml');
    res.send(telecomXML);
});

// ==========================================
// 4. SERVER INITIALIZATION
// ==========================================
app.listen(PORT, () => {
    console.log(`[X-SIM CORE ENGINE]: Online and listening on port ${PORT}`);
});
