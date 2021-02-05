const videoGird = $("#video-grid");
const videoFocus = $("#video-focus");
const peer = new Peer();
const socket = io();
let myVideoStream;
let currentPeer;
const users = {};
let focusUser = null;

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    myVideoStream = stream;

    const myVideo = document.createElement("video");
    myVideo.muted = true;
    addVideoParticipant(myVideo, stream);

    users["You"] = { stream: myVideoStream };
    loadParticipant();

    //answer
    peer.on("call", (call) => {
      call.answer(stream);
      const video = document.createElement("video");

      call.on("stream", (userVideoStream) => {
        users[call.peer] = { stream: userVideoStream };
        currentPeer = call.peerConnection;
        video.setAttribute("id", "participant" + call.peer);

        addVideoParticipant(video, userVideoStream);
        loadParticipant();
      });

      call.on("close", () => {
        console.log("answer");

        video.remove();
        call.close();
      });
    });

    //call
    socket.on("connected", (userId) => {
      callPeer(userId, stream);
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
        scrollToBottom();
      }
    });

    $(".leave-button").click(function (e) {
      socket.emit("disconnected");
    });

    socket.on("create-message", (message, userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>${message}</li>`
      );

      scrollToBottom();
    });

    socket.on("shared-screen", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>started screen sharing</li>`
      );

      $(`#${userId}`).append(`<i class="fas fa-thumbtack"></i>`);
      focusUser = userId;

      const video = document.createElement("video");
      addVideoFocus(video, users[userId].stream);

      loadParticipant();
      setUnShareScreen();
    });

    socket.on("stopped-share-screen", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>stopped screen sharing</li>`
      );

      if (focusUser === userId) {
        $(`#${userId}`).find("i").remove();
        videoFocus.css({ display: "none" });
        videoGird.css({ display: "flex" });
      }

      setShareScreen();
    });

    socket.on("disconnected", (userId) => {
      $(".messages").append(
        `<li class="message"><b>${userId}: </b>left room</li>`
      );

      if (users[userId]) {
        $(`#participant${userId}`).css({ display: "none" });
        $(`#participant${userId}`).remove();
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

  $(".users").append(`<li class="message"><b>ID: </b>${id}</li>`);
  socket.emit("join-room", roomId, id);
});

const addVideoParticipant = (video, stream) => {
  video.classList.add("normal");
  video.srcObject = stream;
  video.play();

  videoGird.append(video);
};

const addVideoFocus = (video, stream) => {
  videoGird.css({ display: "none" });

  video.classList.add("fullscreen");
  video.srcObject = stream;
  video.play();

  videoFocus.css({ display: "flex" });
  videoFocus.empty();
  videoFocus.append(video);
};

const callPeer = (userId, stream) => {
  const call = peer.call(userId, stream);
  const video = document.createElement("video");

  call.on("stream", (userVideoStream) => {
    currentPeer = call.peerConnection;
    users[userId] = { stream: userVideoStream };

    video.setAttribute("id", "participant" + userId);
    addVideoParticipant(video, userVideoStream);
    loadParticipant();
  });

  call.on("close", () => {
    video.remove();
    call.close();
  });
};

const loadParticipant = () => {
  $(".participants").empty();

  Object.keys(users).forEach((key) => {
    $(".participants").append(`<li id="${key}"></li>`);

    const stream = users[key].stream;

    const video = document.createElement("video");
    video.srcObject = stream;
    video.play();

    if (key === "You") {
      video.muted = true;
    }

    $(`#${key}`).append(video);
    $(`#${key}`).append(`<p>${key}</p>`);
    if (key === focusUser) {
      $(`#${key}`).append(`<i class="fas fa-thumbtack"></i>`);
    }

    $(`#${key}`).click(function (e) {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      if (focusUser) {
        if (focusUser === key) {
          focusUser = null;

          $(`#${key}`).find("i").remove();
          videoFocus.css({ display: "none" });
          videoGird.css({ display: "flex" });
        } else {
          $(`#${focusUser}`).find("i").remove();

          focusUser = key;

          $(`#${key}`).append(`<i class="fas fa-thumbtack"></i>`);
          addVideoFocus(video, stream);
        }
      } else {
        focusUser = key;

        $(`#${key}`).append(`<i class="fas fa-thumbtack"></i>`);
        addVideoFocus(video, stream);
      }
    });
  });
};

const startShareScreen = () => {
  if (Object.keys(users).length === 1) {
    alert("Room chỉ có mình bạn ???");
    return;
  }

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
      $(".messages").append(
        `<li class="message"><b>You: </b>have screen sharing</li>`
      );
      setUnShareScreen();

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
    `<li class="message"><b>You: </b>stopped screen sharing</li>`
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

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `;
  document.querySelector(".mute-button").innerHTML = html;
};

const setUnmuteButton = () => {
  const html = `
    <i class="un fas fa-microphone-slash"></i>
    <span>Mute</span>
  `;
  document.querySelector(".mute-button").innerHTML = html;
};

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Video</span>
  `;
  document.querySelector(".video-button").innerHTML = html;
};

const setPlayVideo = () => {
  const html = `
    <i class="un fas fa-video-slash"></i>
    <span>Video</span>
  `;
  document.querySelector(".video-button").innerHTML = html;
};

const setShareScreen = () => {
  $(".share-button").css("display", "flex");
};

const setUnShareScreen = () => {
  $(".share-button").css("display", "none");
};

const scrollToBottom = () => {
  let d = $(".main-window");
  console.log(d.prop("scrollHeight"));
  d.scrollTop(d.prop("scrollHeight"));
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

window.addEventListener("beforeunload", function (e) {
  const confirmationMessage = "o/";

  socket.emit("disconnected");
  peer.disconnect();
  peer.destroy();
  socket.close();

  (e || window.event).returnValue = confirmationMessage; //Gecko + IE
  return confirmationMessage; //Webkit, Safari, Chrome
});
