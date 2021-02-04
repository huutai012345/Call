const videoGird = $("#video-grid");
const peer = new Peer();
const socket = io();
let myVideoStream;
let currentPeer;
const users = {};

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myVideoStream = stream;

    addVideoParticipant(stream);
    users["You"] = { stream: myVideoStream };
    loadParticipant();

    //answer
    peer.on("call", (call) => {
      call.answer(stream);
      addVideoParticipant(stream);
      call.on("stream", (userVideoStream) => {
        currentPeer = call.peerConnection;
      });
      users[call.peer] = { call, stream };
      loadParticipant();
    });

    //call
    socket.on("connected", (userId) => {
      callPeer(userId, stream);
      addVideoParticipant(stream);
      loadParticipant();
    });

    let text = $("input");
    $("html").keydown(function (e) {
      if (e.which == 13 && text.val().length > 0) {
        socket.emit("message", text.val());
        $(".messages").append(
          `<li class="message"><b>You: </b>${text.val()}</li>`
        );
        text.val("");
      }
    });

    $(".main__leave_button").click(function (e) {
      socket.emit("disconnected");
      $(".participants").empty();
    });

    socket.on("create-message", (message, userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>${message}</li>`
      );
    });

    socket.on("shared-screen", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>started screen sharing</li>`
      );

      // const video = document.createElement("video");
      // video.classList.add("fullscreen");
      //video.srcObject = users[userId].stream;
      // addVideoParticipant(video, users[userId].stream);

      loadParticipant();
      setUnShareScreen();
    });

    socket.on("share-screen", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>stopped screen sharing</li>`
      );

      setShareScreen();
    });

    socket.on("disconnected", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>left room</li>`
      );

      if (users[userId]) {
        users[userId].call.close();
        $(users[userId].video).css({ display: "none" }).remove();
        delete users[userId];
        loadParticipant();
      }
    });

    socket.on("close", () => {
      peer.disconnect();
      peer.destroy();
      socket.close();
      window.location.href = "http://localhost:3000/";
    });
  })
  .catch((err) => {
    console.log(err);
  });

peer.on("open", (id) => {
  $(".messages").append(
    `<li class="message"><b>You: </b>have joined room</li>`
  );

  setUserId(id);
  socket.emit("join-room", roomId, id);
});

const createVideo = (stream) => {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.play();
  return video;
};

const addVideoParticipant = (stream) => {
  const video = createVideo(stream);
  videoGird.append(video);

  console.log(stream);
};

const addVideoMain = (stream) => {
  videoGird.empty();
  const video = createVideo(stream);
  video.classList.add("fullscreen");
  videoGird.append(video);
};

const callPeer = (userId, stream) => {
  const call = peer.call(userId, stream);
  call.on("stream", (remoteStream) => {
    currentPeer = call.peerConnection;
  });

  users[userId] = { call, stream };
};

const loadParticipant = () => {
  $(".participants").empty();

  console.log("participants");
  Object.keys(users).forEach((key) => {
    $(".participants").append(`<li id="${key}"></li>`);

    const stream = users[key].stream;
    const video = createVideo(stream);
    if (key === "You") {
      video.muted = true;
    }
    video.muted = true;
    console.log(stream);
    $(`#${key}`).append(video);
    $(`#${key}`).append(`<p>${key}</p>`);

    $(`#${key}`).click(function (e) {
      addVideoMain(stream);
    });
  });
};

const startShareScreen = () => {
  $(".messages").append(
    `<li class="message"><b>You: </b>have screen sharing</li>`
  );

  setUnShareScreen();

  navigator.mediaDevices
    .getDisplayMedia({
      video: {
        cursor: "always",
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    .then((stream) => {
      let videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopShareScreen();
      };

      let sender = currentPeer.getSenders().find((s) => {
        return s.track.kind == videoTrack.kind;
      });
      sender.replaceTrack(videoTrack);

      socket.emit("share-screen");
    })
    .catch((err) => {
      console.log(err);
    });
};

const stopShareScreen = () => {
  $(".messages").append(
    `<li class="message"><b>You: </b>have stopped screen sharing</li>`
  );

  let videoTrack = myVideoStream.getVideoTracks()[0];
  let sender = currentPeer.getSenders().find((s) => {
    return s.track.kind == videoTrack.kind;
  });
  sender.replaceTrack(videoTrack);
  setShareScreen();
  socket.emit("stop-share-screen");
};

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
  }
};

const playStop = () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo();
  } else {
    setStopVideo();
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
};

const setUserId = (userId) => {
  const html = `
    <i class="fas fa-user"></i>
    <span>${userId}</span>
  `;
  document.querySelector(".main__user_button").innerHTML = html;
};

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `;
  document.querySelector(".main__mute_button").innerHTML = html;
};

const setUnmuteButton = () => {
  const html = `
    <i class="un fas fa-microphone-slash"></i>
    <span>Mute</span>
  `;
  document.querySelector(".main__mute_button").innerHTML = html;
};

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Video</span>
  `;
  document.querySelector(".main__video_button").innerHTML = html;
};

const setPlayVideo = () => {
  const html = `
    <i class="un fas fa-video-slash"></i>
    <span>Video</span>
  `;
  document.querySelector(".main__video_button").innerHTML = html;
};

const setShowChat = () => {
  const html = `
    <i class="fas fa-comment"></i>
    <span>Chat</span>
  `;
  document.querySelector(".main__showChat_button").innerHTML = html;
};

const setUnShowChat = () => {
  const html = `
    <i class="un fas fa-comment-slash"></i>
    <span>Chat</span>
  `;
  document.querySelector(".main__showChat_button").innerHTML = html;
};

const setShareScreen = () => {
  $(".main__share_button").css("display", "flex");
};

const setUnShareScreen = () => {
  $(".main__share_button").css("display", "none");
};

$(".tab-item").each((index, obj) => {
  $(obj).click(function (e) {
    $(".tab-item.active").removeClass("active");
    $(".tab-pane.active").removeClass("active");

    $(this).addClass("active");
    let id = $(this).attr("id");
    $("#" + id + "c").addClass("active");
  });
});

// window.addEventListener("beforeunload", function (e) {
//   const confirmationMessage = "o/";

//   socket.emit("disconnected");
//   peer.disconnect();
//   peer.destroy();
//   socket.close();

//   (e || window.event).returnValue = confirmationMessage; //Gecko + IE
//   return confirmationMessage; //Webkit, Safari, Chrome
// });
