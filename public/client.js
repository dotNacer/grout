const socket = io();
let peerConnection;
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  iceTransportPolicy: 'all',
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  sdpSemantics: 'unified-plan',
  encodings: [
    { maxBitrate: 64000, maxFramerate: 15 }
  ]
};

const startButton = document.getElementById('startButton');
startButton.addEventListener('click', startCall);

function startCall() {
  const roomId = 'test-room'; // Vous pouvez générer un ID unique pour chaque salle
  socket.emit('join-room', roomId);

  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })
    .then(stream => {
      peerConnection = new RTCPeerConnection(configuration);
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          socket.emit('ice-candidate', event.candidate, roomId);
        }
      };

      peerConnection.ontrack = event => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
      };

      createAndSendOffer();
    })
    .catch(error => console.error('Erreur lors de l\'accès au microphone:', error));
}

function createAndSendOffer() {
  peerConnection.createOffer()
    .then(offer => peerConnection.setLocalDescription(offer))
    .then(() => {
      socket.emit('offer', peerConnection.localDescription, 'test-room');
    })
    .catch(error => console.error('Erreur lors de la création de l\'offre:', error));
}

socket.on('offer', offer => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => peerConnection.createAnswer())
    .then(answer => peerConnection.setLocalDescription(answer))
    .then(() => {
      socket.emit('answer', peerConnection.localDescription, 'test-room');
    })
    .catch(error => console.error('Erreur lors de la réponse à l\'offre:', error));
});

socket.on('answer', answer => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
    .catch(error => console.error('Erreur lors de la définition de la réponse distante:', error));
});

socket.on('ice-candidate', candidate => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    .catch(error => console.error('Erreur lors de l\'ajout du candidat ICE:', error));
});

socket.on('user-connected', () => {
  console.log('Un autre utilisateur s\'est connecté');
  startCall();
});

setInterval(() => {
  peerConnection.getStats().then(stats => {
    stats.forEach(report => {
      if (report.type === 'inbound-rtp' && report.kind === 'audio') {
        console.log('Latence:', report.jitter);
        console.log('Paquets perdus:', report.packetsLost);
      }
    });
  });
}, 1000);