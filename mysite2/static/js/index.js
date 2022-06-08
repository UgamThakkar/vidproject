console.log("js working")


const roomName = JSON.parse(document.getElementById('room-name').textContent);



var mapPeers = {};

var usernameInput = document.querySelector('#username');
var btnJoin = document.querySelector('#btn-join');

var username;
var webSocket;

let iceServers = {
            iceServers: [
                { urls: "stun:stun.services.mozilla.com" },
                { urls: "stun:stun.l.google.com:19302" },
            ],
        };

//this will be triggered everytime our websocket receives a message from our consumer
//consumer sends a json string after serializing a python dict and we need to deserialize it receive a js object
function webSocketOnMessage(event) {
    var parsedData = JSON.parse(event.data);

    var peerUsername = parsedData['peer']; // getting the username of the new peer that joins the room
    var action = parsedData['action'];

    if (username == peerUsername) {
        return;
    }

    //holds the channel name of the peer whom we are going to send the message to 
    var receiver_channel_name = parsedData['message']['receiver_channel_name'];
    if (action == 'new-peer') {
        createOfferer(peerUsername, receiver_channel_name); //this function will create an offer sdp and send it to the channel associated with receiver_channel_name
        return;
    }

    if (action == 'new-offer') {
        var offer = parsedData['message']['sdp'];

        createAnswerer(offer, peerUsername, receiver_channel_name);
        return;
    }

    if (action == 'new-answer') {
        var answer = parsedData['message']['sdp'];

        var peer = mapPeers[peerUsername][0];

        peer.setRemoteDescription(answer);
        return;
    }

}


//done correct
btnJoin.addEventListener('click', () => {

    //here we are getting the username that a user will type in the field
    username = usernameInput.value;

    console.log('username:', username);

    if (username == '') {//if the username is empty then we will simply return as we cannot join a room without it
        return;
    }
    usernameInput.value = ''; //else after the username is provided we will clear the username field and disable it so that user wont be able to change the username
    usernameInput.disabled = true;
    usernameInput.style.visibility = 'hidden';

    btnJoin.disabled = true;
    btnJoin.style.visibility = 'hidden';

    var labelUsername = document.querySelector('#lable-username');
    labelUsername.innerHTML = username;

    var loc = window.location;
    var wsStart = 'ws://';

    if (loc.protocol == 'https:') {
        wsStart = 'wss://';
    }

    //endpoint carries the url we will use to connect to our consumer.
    // var endpoint = wsStart + loc.host + loc.pathname
    var endpoint = 'ws://'
            + window.location.host
            + '/ws/live/'
            + roomName
            + '/'
    console.log('endpoint:', endpoint);

    //by providing the endpoint as an arg it will connect to our consumer
    //thus it will be routed to our chatconsumer and a new instance of the chatconsumer will be created for each connection.
    webSocket = new WebSocket(endpoint)

    webSocket.addEventListener('open', (e) => {
        console.info('connection opened:');
        sendSignal('new-peer', {}); //done correct


    });


    webSocket.addEventListener('message', webSocketOnMessage);

    webSocket.addEventListener('close', (e) => {
        console.log('connection closed!');
    });

    webSocket.addEventListener('error', (e) => {
        console.log('error occured!');
    });

});


//code for getting the audio and video of users

var localStream = new MediaStream();
const constraints = {
    'video': true,
    
    'audio': true,
};

const localVideo = document.querySelector('#local-video');


const btnToggleAudio = document.querySelector('#btn-toggle-audio');
const btnToggleVideo = document.querySelector('#btn-toggle-video');




var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
        localStream = stream; //getting the stream from our headphones and webcam and passing it into this variable
        localVideo.srcObject = localStream;//further passing the same var into the front video element that we obtained here 
        localVideo.muted = true;

        var audioTracks = stream.getAudioTracks();
        var videoTracks = stream.getVideoTracks();

        audioTracks[0].enabled = true;
        videoTracks[0].enabled = true;

        btnToggleAudio.addEventListener('click', () => {
            audioTracks[0].enabled = !audioTracks[0].enabled;

            if (audioTracks[0].enabled) {
                btnToggleAudio.innerHTML = 'Audio Mute';
                return;
            }
            btnToggleAudio.innerHTML = 'Audio Unmute';
        });

        btnToggleVideo.addEventListener('click', () => {
            videoTracks[0].enabled = !videoTracks[0].enabled;

            if (videoTracks[0].enabled) {
                btnToggleVideo.innerHTML = 'Video Off';
                return;
            }
            btnToggleVideo.innerHTML = 'Video On';
        });

    })
    .catch(err => {
        console.error(err);
    });


//send message functionality/Chat functionality     
var btnSendMsg = document.querySelector('#btn-send-msg');
var messageList = document.querySelector('#message-list');
var messageInput = document.querySelector('#msg');
btnSendMsg.addEventListener('click', sendMsgOnClick);


function sendMsgOnClick() {
    var message = messageInput.value;
    var li = document.createElement('li');
    li.appendChild(document.createTextNode('Me:' + message));
    messageList.appendChild(li);

    var dataChannels = getDataChannels();
    message = username + ':' + message;
    for (index in dataChannels) {
        dataChannels[index].send(message);
    }
    messageInput.value = '';
}





function sendSignal(action, message) {
    var jsonStr = JSON.stringify({
        'peer': username,
        'action': action,
        'message': message
    });

    webSocket.send(jsonStr);
}

function createOfferer(peerUsername, receiver_channel_name) {
    console.log('new peer joined running offerer function')
    var peer = new RTCPeerConnection(iceServers); //this here will only allow us to connect to the devices which are within our wifi network  
    //if we want to connect to other devices then we need to setup turn and stun servers

    //by passing the RTCPeerConnection in this function we will be able to send our audio and video to other users over the channel
    addLocalTracks(peer);

    var dc = peer.createDataChannel('channel'); //creating a data channel to send audio and video
    dc.addEventListener('open', () => {
        console.log('data channel opened');
    });
    dc.addEventListener('message', dcOnMessage);//whenever we receive a message through this data channel it will trigger this dcOnMessage function


    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);

    mapPeers[peerUsername] = [peer, dc];

    //this is when a peer cannot join for some reason i.e. its state changes then we call this event on that peer
    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'closed' || iceConnectionState === 'disconnected') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    });

    //collecting ice candidates and sending them as sdp
    peer.addEventListener('icecandidate', (event) => { //done correct
        if (event.candidate) {
            console.log('new ice candidate', JSON.stringify(peer.localDescription));
            return;
        }

        //after collection the ice candidates(sdp) we will send them using this function 
        sendSignal('new-offer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    //this here createOffer will start gathering the ice candidates for a peer
    peer.createOffer()
        .then(o => peer.setLocalDescription(o))
        .then(() => {
            console.log('Local Description set successfully');
        });
}


function createAnswerer(offer, peerUsername, receiver_channel_name) {
    var peer = new RTCPeerConnection(iceServers);
    addLocalTracks(peer);

    var remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);


    peer.addEventListener('datachannel', e => {
        peer.dc = e.channel;
        peer.dc.addEventListener('open', () => {
            console.log("connection opened");
        });
        peer.dc.addEventListener('message', dcOnMessage);

        mapPeers[peerUsername] = [peer, peer.dc];

    });


    //this is when a peer cannot join for some reason i.e. its state changes then we call this event on that peer
    peer.addEventListener('iceconnectionstatechange', () => {
        var iceConnectionState = peer.iceConnectionState;

        if (iceConnectionState === 'failed' || iceConnectionState === 'closed' || iceConnectionState === 'disconnected') {
            delete mapPeers[peerUsername];

            if (iceConnectionState != 'closed') {
                peer.close();
            }
            removeVideo(remoteVideo);
        }
    });

    //collecting ice candidates and sending them as sdp
    peer.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('new ice candidate', JSON.stringify(peer.localDescription));
            return;
        }

        //after collection the ice candidates(sdp) we will send them using this function 
        sendSignal('new-answer', {
            'sdp': peer.localDescription,
            'receiver_channel_name': receiver_channel_name
        });
    });

    peer.setRemoteDescription(offer)
        .then(() => {
            console.log('Remote description set successfully for %s', peerUsername);

            return peer.createAnswer();
        })
        .then(a => {
            console.log('Answer created');
            peer.setLocalDescription(a)
        })


}

function addLocalTracks(peer) {
    localStream.getTracks().forEach(track => {
        peer.addTrack(track, localStream);
    });
    return;
}



//dc.addeventlistener(message) will give us the message received thorugh the data channel and we extract that message using event.data
function dcOnMessage(event) {
    //done correct
    var message = event.data;

    //further we create a list item and append this msg to the list
    var li = document.createElement('li');
    li.appendChild(document.createTextNode(message));
    messageList.appendChild(li);
}


//this function will create the video element and play the video of new peer
function createVideo(peerUsername) { 
    var videoContainer = document.querySelector('#video-container');

    var remoteVideo = document.createElement('video');

    remoteVideo.id = peerUsername + '-video';
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;


    var videoWrapper = document.createElement('div');

    videoContainer.appendChild(videoWrapper);

    videoWrapper.appendChild(remoteVideo);

    return remoteVideo;

}


function setOnTrack(peer, remoteVideo) {
    var remoteStream = new MediaStream();

    remoteVideo.srcObject = remoteStream;

    //this means that whenever we receive a track(audio/video) then we wil play it
    peer.addEventListener('track', async (event) => {
        remoteStream.addTrack(event.track, remoteStream)
    });
}

//remove video
function removeVideo(video) {
    var videoWrapper = video.parentNode;

    videoWrapper.parentNode.removeChild(videoWrapper);
}


function getDataChannels() {
    var dataChannels = [];
    for (peerUsername in mapPeers) {
        var dataChannel = mapPeers[peerUsername][1];
        dataChannels.push(dataChannel);
    }
    return dataChannels;
}