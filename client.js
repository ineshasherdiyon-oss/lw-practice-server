// client.js
const socket = io();

const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const status = document.getElementById("status");

let mediaStream = null;
let recorder = null;

startBtn.onclick = async () => {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    status.textContent = "Microphone access denied or not available";
    return;
  }

  // prefer audio/webm; the browser will choose workable mime type
  recorder = new MediaRecorder(mediaStream);
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        socket.emit("audio-chunk", base64);
      };
      reader.readAsDataURL(e.data);
    }
  };

  recorder.onstart = () => {
    status.textContent = "recording... streaming chunks";
  };

  recorder.onstop = () => {
    status.textContent = "stopped";
  };

  recorder.start(250); // create a blob every 250ms
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
  socket.emit("stop-audio");
  startBtn.disabled = false;
  stopBtn.disabled = true;
};
