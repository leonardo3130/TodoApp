const mongoose = require("mongoose");

// MongoDB connection
//const mongoDBUri = "mongodb+srv://admin:fTe6uS1KMiVrWgcN@notes-cluster.1tihbik.mongodb.net/?retryWrites=true&w=majority&appName=Notes-Cluster";
const mongoDBUri = "mongodb+srv://leonardopo313:cGihcLOxco0h37WF@cluster0.whpiqrm.mongodb.net/TodoDB?retryWrites=true&w=majority";
mongoose.connect(mongoDBUri, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on("connected", () => console.log("Connected to MongoDB"));
mongoose.connection.on("reconnected", () => console.log("Reconnected to MongoDB"));
mongoose.connection.on("disconnected", () => console.log("Disconnected from MongoDB"));
mongoose.connection.on("error", (err) => console.error("MongoDB connection error:", err));

// Close MongoDB connection on SIGINT (Ctrl+C)
process.on("SIGINT", () => { //evento emesso con Ctrl+C --> process =  
  mongoose.connection.close(() => {
    console.log("MongoDB connection closed due to application termination");
    process.exit(0);
  });
});

// Mongoose schemas
const subNoteSchema = new mongoose.Schema({
  heading: String,
  done: {type: Boolean, default: false }
});

const noteSchema = new mongoose.Schema({
  heading: String,
  author: String,
  content: String,
  creation: { type: Date, default: Date.now},
  lastEdit: { type: Date, default: Date.now},
  tasks: {type: [subNoteSchema], default: []}
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

// Mongoose models
const Note = mongoose.model("Note", noteSchema);
const subNote = mongoose.model("subNote", subNoteSchema);
const User = mongoose.model("User", userSchema);

module.exports = {
  subNote,
  Note,
  User
};
