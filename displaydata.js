const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();

// Enable CORS to allow external websites to interact with your API
app.use(cors({
    origin: '*', // Adjust this to the specific origin(s) that should have access, e.g., 'https://your-website.com'
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection URI (ensure this is set in Vercel's environment variables)
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let collection, usersCollection, offersCollection, messagesCollection;

// Session configuration (for production use Redis, or switch to JWT)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Connect to MongoDB once at the start
async function connectDB() {
    try {
        await client.connect();
        const database = client.db('Freelancer');
        collection = database.collection('one'); // Tasks
        usersCollection = database.collection('users'); // Users
        offersCollection = database.collection('Offer'); // Offers
        messagesCollection = database.collection('messages'); // Messages
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
}

connectDB();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Example API route to check if the server is running
app.get('/ping', (req, res) => {
    res.json({ message: 'API is running!' });
});

// API routes (e.g., /login, /register, /tasks, etc.) go here
// ...

// Set the port based on the environment (Vercel assigns a port automatically)
const port = process.env.PORT || 3000;

// api/displaydata.js
module.exports = (req, res) => {
    res.status(200).json({ message: 'Hello from displaydata.js!' });
  };
  

// Connect to MongoDB once at the start
async function connectDB() {
    try {
        await client.connect();
        const database = client.db('Freelancer');
        collection = database.collection('one'); // Tasks
        usersCollection = database.collection('users'); // Users
        offersCollection = database.collection('Offer'); // Offers
        messagesCollection = database.collection('messages'); // Messages
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
}

connectDB();

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file for user setup
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Usersetup.html'));
});

// API to fetch current logged-in username from session
app.get('/current-username', (req, res) => {
    if (req.session.user && req.session.user.username) {
        res.json({ username: req.session.user.username });
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});

// API to fetch task details by ID
app.get('/task/:id', async (req, res) => {
    const taskId = req.params.id; 
    try {
        const task = await collection.findOne({ _id: new ObjectId(taskId) });
        if (!task) {
            return res.status(404).json({ message: 'Task not found.' });
        }
        res.json(task);
    } catch (error) {
        console.error('Error fetching task details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to fetch offers for a specific task
app.get('/offers/:taskId', async (req, res) => {
    const { taskId } = req.params;
    try {
        const offers = await offersCollection.find({ taskId: new ObjectId(taskId) }).toArray();
        res.json(offers);
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to register a new user
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.json({ message: 'Username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ username, email, password: hashedPassword });

        res.json({ message: 'User registered successfully.' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to log in a user
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await usersCollection.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.json({ message: 'Invalid username or password.' });
        }

        req.session.user = { username: user.username, email: user.email, _id: user._id };
        res.json({ message: 'Login successful', username: user.username, email: user.email });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to fetch user details
app.get('/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json({ username: user.username, email: user.email });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to fetch tasks
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await collection.find().toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to send a message
app.post('/sendMessage', async (req, res) => {
    const { title, message, taskOwnerId } = req.body; // Extract title, message, and task owner's ID from the request body
    const user = req.session.user; // Get the currently logged-in user from the session

    if (!user || !user._id) { // Check if user is logged in
        return res.status(401).json({ message: 'User not logged in.' });
    }

    try {
        // Fetch sender's username using their _id
        const sender = await usersCollection.findOne({ _id: new ObjectId(user._id) });
        if (!sender || !sender.username) {
            return res.status(404).json({ message: 'Sender not found.' });
        }

        // Fetch task owner's username using taskOwnerId
        const taskOwner = await usersCollection.findOne({ _id: new ObjectId(taskOwnerId) });
        if (!taskOwner || !taskOwner.username) {
            return res.status(404).json({ message: 'Task owner not found.' });
        }

        // Insert the message into the 'messages' collection with usernames instead of IDs
        await messagesCollection.insertOne({
            senderUsername: sender.username, // Store sender's username
            recipientUsername: taskOwner.username, // Store task owner's username
            title, // Message title
            message // Message content
        });

        res.json({ message: 'Message sent successfully.' }); // Return success response
    } catch (error) {
        console.error('Error sending message:', error); // Log any errors
        res.status(500).json({ message: 'Internal server error.' }); // Return error response
    }
});

//get message
app.get('/messages', async (req, res) => {
    const userId = req.query.userId; // Get userId from the URL query parameters

    if (!userId) { // Check if userId is provided
        return res.status(400).json({ message: 'UserId not provided.' });
    }

    try {
        // Find messages where the recipientId matches the userId from the URL
        const messages = await messagesCollection.find({
            recipientId: new ObjectId(userId) // Convert userId to ObjectId
        }).toArray(); // Convert cursor to array

        // Format messages with only title and message
        const formattedMessages = messages.map(msg => ({
            title: msg.title,
            message: msg.message
        }));

        res.json(formattedMessages); // Return the formatted messages
    } catch (error) {
        console.error('Error fetching messages:', error); // Log any errors
        res.status(500).json({ message: 'Internal server error.' }); // Return error response
    }
});





// API to fetch tasks for service receiver (only tasks posted by the logged-in user)
// API to fetch tasks for service receiver (only tasks posted by the logged-in user)
app.get('/reciverIndex/tasks', async (req, res) => {
    const user = req.session.user; // Get user from session
    if (!user || !user.username) {
        return res.status(401).json({ message: 'User not logged in.' });
    }

    try {
        // Fetch tasks where the username matches the logged-in user's username
        const tasks = await collection.find({ username: user.username }).toArray();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching receiver tasks:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


//return cuurent userID
app.get('/receiverIndex/tasks', (req, res) => {
    const user = req.session.user; // Get user from session
    if (!user || !user.username) {
        return res.status(401).json({ message: 'User not logged in.' });
    }

    // Return only userId and sessionId
    res.json({
        userId: user._id,  // Assuming user._id stores the user's unique ID
        sessionId: req.sessionID  // session ID from express-session
    });
});

// Role selection page
app.get('/role-selection', (req, res) => {
    if (req.session.user) {
        res.sendFile(path.join(__dirname, 'public', 'role-selection.html')); // Ensure this file exists in your public directory
    } else {
        res.status(401).json({ message: 'User not logged in.' });
    }
});

// API to submit an offer
app.post('/submit-offer', async (req, res) => {
    const { taskId, deadline, pitch } = req.body;
    const user = req.session.user; // Get user from session

    if (!user || !user._id) {
        return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

    try {
        await offersCollection.insertOne({
            taskId: new ObjectId(taskId), 
            userId: new ObjectId(user._id), // Store user's ID
            username: user.username,
            deadline,
            pitch
        });
        res.status(201).json({ message: 'Offer submitted successfully.' });
    } catch (error) {
        console.error('Error submitting offer:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// API to add a new task with user's specific ID
app.post('/add-task', async (req, res) => {
    const { title, detail, deadline, mode, type, budget } = req.body;  // Added "budget" to match the form fields

    // Get the user's ID and username from the session
    const user = req.session.user;

    // If the user is not logged in, return an error
    if (!user || !user._id) {
        return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

    try {
        // Insert task with user ID, budget, and other details
        const result = await collection.insertOne({
            title,
            detail,
            deadline,  // Store deadline of the task
            mode,
            type,
            budget,   // Store the budget value
            userId: new ObjectId(user._id),  // Store user's ID
            username: user.username  // Optionally store the username too
        });

        // Send a successful response with the task ID
        res.status(200).json({ success: true, message: 'Task added successfully', taskId: result.insertedId });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ success: false, message: 'Failed to add task' });
    }
});

/* Start the server
app.listen(port, () => { 
    console.log(`Server is running on port ${port}`);
});*/
