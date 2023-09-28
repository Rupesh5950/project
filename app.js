const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const serviceAccount = require('./newkey.json');
const path = require('path');
const ejs = require('ejs');
const axios = require('axios'); 

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-ef3h1%40project-2-c1bf4.iam.gserviceaccount.com'
});

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

async function updateLastLoginTime(userEmail) {
  try {
    const userRef = db.collection('userdata').doc(userEmail);
    await userRef.update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating last login time:', error);
  }
}

async function addUser(email, username, password) {
  try {
    const userRef = db.collection('userdata').doc(email);
    await userRef.set({
      email: email,
      username: username,
      password: password,
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('Document written with ID:', email);
    return email;
  } catch (error) {
    console.error('Error adding document:', error);
    throw error;
  }
}
app.get('/', (req, res) => {
  res.render('login');
});
app.get('/signup', (req, res) => {
  res.render('signup');
});
app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/dashboard', async (req, res) => {
  try {
    const loginEmail = req.query.loginEmail;

    const userSnapshot = await db.collection('userdata').doc(loginEmail).get();

    if (!userSnapshot.exists) {
      res.send('User not found.');
    } else {
      const userData = userSnapshot.data();
      const username = userData.username;
      const userEmail = userData.email;
      res.render('dashboard', { username });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while loading the dashboard.');
  }
});

app.post('/get-movies-by-actor', async (req, res) => {
  try {
    const actorName = req.body.actorName; 
    const movies = await fetchData(actorName);
    res.render('celebrity', { actorName: actorName, movies: movies });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).send('An error occurred while fetching movies.');
  }
});
async function fetchData(actorName) {
  const apiKeyHeader = '2f0b5bd727msh25f9aa3f14b14e8p19cfa2jsn6618975f6061';
  const apiKeyQueryParam = '62ffac58c57333a136053150eaa1b587';

  const encodedActorName = encodeURIComponent(actorName); 

  const options = {
    method: 'GET',
    url: `https://actor-movie-api1.p.rapidapi.com/getid/${encodedActorName}`,
    params: {
      apiKey: apiKeyQueryParam
    },
    headers: {
      'X-RapidAPI-Key': apiKeyHeader,
      'X-RapidAPI-Host': 'actor-movie-api1.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    const moviesData = response.data;
    const movies = moviesData.map((movie) => ({
      title: movie.title,
      character: movie.character,
      original_language: movie.original_language,
      original_title: movie.original_title,
      release_date: movie.release_date,
      overview: movie.overview,
    }));

    return movies;
  } catch (error) {
    console.error(error);
    return [];
  }
}

app.post('/login', async (req, res) => {
  const { loginEmail, loginPassword } = req.body;
  try {
    const userSnapshot = await db.collection('userdata').doc(loginEmail).get();
    if (!userSnapshot.exists) {
      const errorMessage = 'Please create an account to log in.';
      res.render('login', { errorMessage }); 
    } else {
      const user = userSnapshot.data();
      if (loginPassword === user.password) {
        console.log('Login Successful!');
        await updateLastLoginTime(loginEmail);
        const lastLoginMessage = user.lastLogin
          ? `, Last Login: ${user.lastLogin.toDate()}`
          : '';
        res.redirect(`/dashboard?loginEmail=${encodeURIComponent(loginEmail)}`);
      } else {
        const errorMessage = 'Incorrect password. Please try again.';
        res.render('login', { errorMessage }); 
      }
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = 'Login Failed. Please try again.';
    res.render('login', { errorMessage }); 
  }
});


app.post('/create', async (req, res) => {
  const { newUsername, newEmail, newPassword } = req.body;

  const emailRegex = /^[A-Za-z0-9._%-]+@gmail\.com$/;

  if (!emailRegex.test(newEmail)) {   
    const errorMessage = 'Email address must be in the format yourname@gmail.com';
    res.render('signup', { errorMessage });
    return;
  }

  try {
    const existingUserSnapshot = await db.collection('userdata').doc(newEmail).get();

    if (existingUserSnapshot.exists) {
      const errorMessage = 'You already have an account. Please log in.';
    res.render('signup', { errorMessage });
    } else {
      if (!newPassword) {
        const errorMessage = 'Password is required';
    res.render('signup', { errorMessage });
        return;
      }
      await addUser(newEmail, newUsername, newPassword);
      console.log('User added successfully!');
      const errorMessage = 'Account created successfully. Please login now.';
    res.render('signup', { errorMessage });
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = 'Error creating user. Please try again.';
    res.render('signup', { errorMessage });
  }
});


app.listen(port, () => {
  console.log(`Access the web app at http://localhost:${port}`);
});
