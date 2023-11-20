//importing necessary modules
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');

//load environment variables from .env file
require('dotenv').config();

//add path module for setting view directory
const path = require('path');

//retrieve API keys from environment variables
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

//configure express to use ejs as the view engine
app.set('view engine', 'ejs');
// Set the directory where the view templates are located
app.set('views', path.join(__dirname, 'views'));

//configure passport to use spotify for authentication
passport.use(new SpotifyStrategy({
    clientID: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    callbackURL: 'http://localhost:51556/auth/spotify/callback'
},
function(accessToken, refreshToken, expires_in, profile, done) {
    //passport callback function
    return done(null, profile);
}));

//configure session middleware for maintaining session state across HTTP requests
app.use(session({
    secret: process.env.SESSION_SECRET, // Secret used to sign the session ID cookie
    resave: false, //avoid resaving sessions that are not modified
    saveUninitialized: true //save uninitialized sessions to the store
}));

//serialize user instance to the session
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

app.use(passport.initialize());
app.use(passport.session());

//serve static files from these directories
app.use(express.static('www/html/public'));
app.use(express.static('public'));

//define route handlers for Spotify authentication
app.get('/auth/spotify', passport.authenticate('spotify'));
app.get('/auth/spotify/callback', passport.authenticate('spotify', { failureRedirect: '/' }),
    function(req, res) {
        //successful authentication, redirect home
        res.redirect('/');
    }
);

//route for getting user's spotify playlists
app.get('/api/user-playlists', (req, res) => {
    const accessToken = req.user.accessToken;
    axios.get('https://api.spotify.com/v1/me/playlists', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    }).then(response => {
        //render playlists view with data from Spotify API
        res.render('playlists', { playlists: response.data.items });
    }).catch(error => {
        //handle errors in API call
        res.status(500).send(error);
    });
});

//route for fetching a random recipe using the Spoonacular API
app.get('/api/random-recipe', async (req, res) => {
    try {
        const response = await axios.get(`https://api.spoonacular.com/recipes/random?apiKey=${SPOONACULAR_API_KEY}`);
        //render recipe view with data from Spoonacular API
        res.render('recipe', { recipe: response.data.recipes[0] });
    } catch (error) {
        //handle errors in API call
        console.error("Error fetching from API:", error);
        res.status(500).send("Error retrieving recipes");
    }
});

//route for the home page
app.get('/', (req, res) => {
    res.render('index', { title: 'Home Page' });
});

//start Express server on port 3001
app.listen(3001, () => {
    console.log('Server is running on port 3001');
});

//socket.IO functionality for communication
io.on('connection', (socket) => {
    console.log('A user connected');

    //handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    //broadcast chat messages to all connected users
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
});

//route for the chat page
app.get('/chat', (req, res) => {
    //render chat page view
    res.render('chat');
});

//start HTTP server on the environment's designated port, defaulting to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
