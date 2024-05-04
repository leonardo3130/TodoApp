const express = require("express");
const app = express();
const path = require("path");
const _ = require("lodash"); //libreria di utility --> stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro //libreria di utility -- stringhe, array, oggetti e altro 
const cors = require("cors");
const expressSession = require("express-session");
const flash = require("connect-flash");
const passport = require("passport"); //autenticazione
const LocalStrategy = require("passport-local").Strategy; //strategia per autenticazione
const bcrypt = require("bcrypt");

const {subNote, Note, User} = require("./mongoose_setup.js")

// Middleware setup
app.use(cors());
app.set("view engine", "ejs"); // Set EJS as the view engine
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/scripts", express.static(path.join(__dirname, "node_modules/markdown/lib")));

//express-session setup
app.use(
  expressSession({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Set to 'true' only for HTTPS
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req, res, next) => {
  res.locals.flashMessages = req.flash(); // Make flash messages available in views
  res.locals.username = req.isAuthenticated() ? req.user.username : null; // Provide username if authenticated
  next(); // Continue with the next middleware
});


// Passport setup for user authentication
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username });
      if (!user) {
        return done(null, false, { message: "Incorrect username or password." });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return done(null, false, { message: "Incorrect username or password." });
      }

      return done(null, user); // Successful authentication
    } catch (err) {
      return done(err); // Error during authentication
    }
  })
);

//loading e unloading di dati a inizio e fine della sessione
passport.serializeUser((user, done) => {
  done(null, user._id); // serializza l'id utente
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user); //chiama done(), funzione di passport che gestisce success/error o fail
  } catch (err) {
    done(err); // Handle errors during deserialization
  }
});

// middleware per mantenere l'autenticazione dell'utente
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) { //passport.js
    return next(); // User is authenticated
  }
  res.redirect("/login"); // Redirect if not authenticated
};

// Routes for login and registration
app.get("/login", (req, res) => {
  res.render("login", { username: req.user ? req.user.username : null });
});


app.post( //https://betaweb.github.io/flashjs/ ma non implementato nella versione corrente
  "/login",
  passport.authenticate("local", {
    successRedirect: "/", // Redirect after successful login
    failureRedirect: "/login", // Redirect after failed login
    failureFlash: true, // Enable flash messages
  })
);

app.get("/register", (req, res) => {
  res.render("register", { username: req.user ? req.user.username : null });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10); //10 = salt rounds (10 volte bit stuffing)

    const newUser = new User({
      username,
      password: hashedPassword, // Store the hashed password
    });

    await newUser.save();

    req.login(newUser, (err) => { //metodo reso disponibile da passport.js 
      if (err) {
        return res.status(500).send("Error during login after registration.");
      }

      res.redirect("/"); // Redirect after successful registration
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send("Registration failed."); // Handle registration errors
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Error during logout:", err);
      return res.status(500).send("Error during logout.");
    }

    res.redirect(302, "/login"); // Use a valid status code and clear redirect
  });
});

// Main routes
app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found"); // If user is not found
    }

    const notes = await Note.find({ author: user.username }); //legame fra la collection degli user e 

    res.render("home", {
      notes: notes.map((note) => ({
        ...note.toObject() // Convert Mongoose document to plain object
      })),
      username: user.username, // Pass username to the template
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).send("Error fetching notes."); // Handle errors
  }
});

app.get("/createNote", ensureAuthenticated, async (req, res) => {
  res.render("createNote");
});

//add Note
app.post("/createNote", ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const newNote = new Note({
      heading: req.body.title,
      content: req.body.content,
      author: user.username,
    });

    try {
      await newNote.save(); // Save to the database
    } catch (error) {
      console.error("Error saving note:", error); // Handle error
      res.status(500).send("Error saving note."); // Respond with a server error
    }
    
    const URL = `/${encodeURIComponent(newNote.heading)}`;
    res.redirect(URL); // Redirect after successful deletion

  } catch(err) {
    console.error("Error adding note:", err);
    res.status(500).send("Error adding note.");
  }
});

//delete Note 
app.post("/users/:username/notes/:noteId", ensureAuthenticated, async (req, res) => {
  try {
    console.error("deleting");
    const username = req.params.username;
    const user = await User.findOne({ username: username });

    if (!user) {
      return res.status(404).send("User not found");
    }

    const note = await Note.findByIdAndDelete(req.params.noteId);

    if(!note) {
      console.error("Note not found, d");
      return res.status(404).send("Note not found");
    }

    res.json({ redirectTo: '/'});
    //richieste AJAX non cambiano l'URL, devo inviare json con nuovo url,
    //e cambiare l'URL nella gestione della risposta alla post (vedi footer)

  } catch (error) {
    console.error("Error deleting note:", err);
    res.status(500).send("Error deleting note.");
  }
});

//note view
app.get("/:noteTitle", ensureAuthenticated, async (req, res) => {
  try {
    //trova utente
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found"); // If user is not found
    }

    //trova nota
    const title = decodeURIComponent(req.params.noteTitle);
    const note = await Note.findOne({heading: title, author: user.username});
    
    if (!note) {
      console.error("Note not found !!");
      return res.status(404).send("Note not found"); // If note is not found
    } else {
      res.render("note", {
        username: user.username,
        id: note._id,
        title: note.heading,
        content: note.content,
      });
    }
    
  } catch (error) {
    console.error("Error checking tasks:", error);
    res.status(500).send("Error checking tasks:", error);
  }
});

//note tasks view 
app.get("/:noteTitle/tasks", ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const title = decodeURIComponent(req.params.noteTitle);
    const note = await Note.findOne({author: user.username, heading: title});

    if (note) {
      res.render("list", {
        username: user.username,
        title: title,
        noteId: note._id,
        tasks: note.tasks.map((task) => ({
          ...task.toObject()
        })) 
      });
    } else {
      res.status(404).send("Note not found");
    }
  } catch (error) {
    console.error("Error fetching tasks:", error); // Handle error
    res.status(500).send("Error fetching tasks."); // Respond with a server error
  }
});

//add Sub-Note
app.post("/:noteTitle/task", ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    const noteName = req.params.noteTitle;
    const filter = {heading: noteName, author: user.username};
    let note = await Note.findOne(filter);

    if(note){
      const task = new subNote({
        heading: req.body.title //title (content) of task
      });
      note.tasks.push(task);
      try {
        await note.save();
      } catch (error) {
        console.error("Error saving note:", error); // Handle error
        res.status(500).send("Error saving note."); // Respond with a server error
      }
    }
    

    const URL = `/${encodeURIComponent(note.heading)}/tasks`;
    res.redirect(URL); // Redirect after successful deletion
  } catch(err) {
    console.error("Error adding task:", error); // Handle error
    res.status(500).send("Error adding task."); // Respond with a server error
  }
});

//delete Sub-Note
app.post("/users/:username/notes/:noteId/delete/:taskId", ensureAuthenticated, async (req, res) => {
  try {
    const noteId = req.params.noteId;
    const note = await Note.findById(noteId);

    if (!note) {
      return res.status(404).send("Note not found");
    }

    if (note.author !== req.user.username) {
      return res.status(403).send("You don't have permission to delete this note.");
    }
    
    let index = note.tasks.findIndex(task => task._id === req.params.taskId);
    note.tasks.splice(index, 1);
    try {
      await note.save();
    } catch (error) {
      console.error("Error saving post:", error); // Handle error
      res.status(500).send("Error saving post."); // Respond with a server error
    }

    const URL = `/${encodeURIComponent(note.heading)}/tasks`;
    res.redirect(URL); // Redirect after successful deletion
  } catch (error) {
    console.error("Error deleting note:", error);
    res.status(500).send("Error deleting note.");
  }
});

//edit Sub-Note
app.post("/users/:username/notes/:noteTitle/:taskTitle", ensureAuthenticated, async (req, res) => {
  try {
    const username = req.params.username;
    const noteTitle = decodeURIComponent(req.params.noteTitle);
    const taskTitle = decodeURIComponent(req.params.taskTitle);
    const user = await User.findOne({ username });

    if (!user) {
      console.error("User not found");
      return res.status(404).send("User not found");
    }

    const filter = { 
      heading: new RegExp("^" + _.escapeRegExp(noteTitle) + "$", "i"), 
      author: username
    };
    const note = await Note.findOne(filter);
    const index = note.tasks.findIndex(task => task.heading === taskTitle);

    if(index != -1) {
      note.tasks[index].done = note.tasks[index].done ? false : true;
      try {
        await note.save();  
      } catch (error) {
        console.error("Error saving note:", error);
        res.status(500).send("Error saving note");
      }
    }
    else {
      console.error("Task not found");
      return res.status(404).send("Task not found");
    }

    if (!res) {
      return res.status(404).send("Note not found");
    }

    const URL = `/${encodeURIComponent(note.heading)}/tasks`;
    res.redirect(URL); // Redirect after successful deletion
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).send("Error updating task.");
  }
});

// Listen on default port 3000
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
