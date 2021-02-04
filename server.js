const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.json({ message: `${req.protocol}://${req.headers.host}/create` });
});

app.get("/create", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).broadcast.emit("connected", userId);
    socket
      .to(roomId)
      .broadcast.emit("create-message", "has joined room", userId);

    socket.on("message", (message) => {
      socket.to(roomId).broadcast.emit("create-message", message, userId);
    });

    socket.on("share-screen", () => {
      socket.to(roomId).broadcast.emit("shared-screen", userId);
    });

    socket.on("stop-share-screen", () => {
      socket.to(roomId).broadcast.emit("share-screen", userId);
    });

    socket.on("disconnected", () => {
      socket.to(roomId).broadcast.emit("disconnected", userId);
      socket.emit("close");
    });
  });
});

const port = process.env.port || 3000;
server.listen(port, () => {
  console.log("Server listening on port " + port);
});
