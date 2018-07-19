import React, { Component } from 'react';
import { Platform } from 'react-native';
import firebase from 'firebase';
import SocketIOClient from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCMediaStream,
  RTCIceCandidate,
  RTCView,
  MediaStreamTrack,
  getUserMedia,
} from 'react-native-webrtc';
import { Header, CardSection, Button, Card, Input } from './components/common';
import SignInForm from './components/SignInForm';

const socket = SocketIOClient.connect('https://stream.roomsforhumanity.org', { transports: ['websocket'] });
const configOptions = { iceServers: [
                          { url: 'stun:stun.l.google.com:19302' },
                          { url: 'turn:turn:numb.viagenie.ca',
                            credential: 'enter1234',
                            username: 'bethin.charles@yahoo.com' }
                        ] };

let isPublished;

let roomName = 'helloAdele';
let localStreams = {};
let localStream;

let peers = [];
let peerNumberOf = {
  'userID': 'peerNumber'
};

let numPublishers = 0;

let streamEng = {
  socket: null,
  serviceAddress: null,
  onSubscribeDone: undefined,
  shouldScreenshare: false
}

let pin = '';
let user = { userID: '' };

let videoIndices = [];
let activeVideos = [];

let videoSourceId;
let videoURL;

function uuid() {
  // Function to generate userID
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function s4() {
  //Helper function to generate userID
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}

streamEng.setUpService = () => {
  streamEng.subscribe();
  user.userID = uuid();
};

streamEng.subscribe = () => {
  streamEng.socket = SocketIOClient.connect('https://stream.roomsforhumanity.org', { transports: ['websocket'] });
  console.log('Connected to Stream Server', 'https://stream.roomsforhumanity.org', roomName);

  streamEng.socket.emit('subscribe rooms', roomName);
  streamEng.socket.on('subscribe response', (roomExists, passcode) => {
    if (!roomExists) {
        //Enter a pin to protect the room
    } else {
      pin = passcode;
    }

    streamEng.socket.emit('subscribe', user.userID, roomName, pin);

    streamEng.socket.on('subscriber ready', (clientID) => {
      console.log('Subscriber ready from', clientID);

      if (!peerNumberOf.hasOwnProperty(clientID)) {
        // If this clientID isn't on record yet, create a new PC and add it to record
          // Then join room
        if (user.userID !== clientID) {
          const newPeerConnection = createPeerConnection(clientID);
          peers.push({
            userID: clientID,
            number: (peers.length),
            peerConnection: newPeerConnection,
            setAndSetDescription: false
          });
          peerNumberOf[clientID] = peers.length - 1;
        }

        joinRoom(peerNumberOf[clientID]);
      } else {
        console.log('Already connected to this peer. Initiating stream');

        let peerNumber = peerNumberOf[clientID];
        joinRoom(peerNumberOf[clientID]);
      }
    });

    streamEng.socket.on('publisher ready', (publisherID, publisherNumber) => {
      console.log('Publisher ready from:', publisherNumber);

      if (!peerNumberOf.hasOwnProperty(publisherID)){
        if (user.userID !== publisherID) {
          const newPeerConnection = createPeerConnection(publisherID, publisherNumber);
          peers.push({
            userID: publisherID,
            number: (peers.length),
            peerConnection: newPeerConnection,
            publisherNumber
          });

          peerNumberOf[publisherID] = peers.length - 1;
        }
      } else {
        peers[peerNumberOf[publisherID]].publisherNumber = publisherNumber;
        peers[peerNumberOf[publisherID]].peerConnection.onaddstream = (event) => {
          console.log('Received remote stream');
          console.log('Adding stream to:', peers[peerNumberOf[publisherID]].publisherNumber);
          console.log('for peer:', publisherID);
        };
      }
      streamEng.onAddNewPublisher(publisherNumber);
    });

    // On signal, go to goetMessageFromSever to handle the message
    streamEng.socket.on('signal', (message) => {
    gotMessageFromServer(message);
    });

    //Handle client disconnect
    streamEng.socket.on('disconnect user', (userID, roomName) => {
      if (peerNumberOf.hasOwnProperty(userID)) {
        const peerNumber = peerNumberOf[userID];
        if (peers[peerNumber].hasOwnProperty('publisherNumber')) {
          //If it's a publisher, delete publisher;
          streamEng.onDeletePublisher(peers[peerNumber].publisherNumber);
        }
        peers.splice(peerNumber, 1);
      }
    });

    if (typeof streamEng.onSubscribeDone !== 'undefined') {
      streamEng.onSubscribeDone();
    }
  });
};

streamEng.onAddNewPublisher = (videoIndex) => {
  if (!videoIndices.includes(videoIndex)) {
    videoIndices.push(videoIndex);
    activeVideos.push(videoSourceId);
  }
};

streamEng.onPublish = (stream) => {
  if (!isPublished) {
    numPublishers++;
    activeVideos.push(videoURL);
  }
  isPublished = true;

};

function gotMessageFromServer(message) {
  const signal = message;
  let peerNumber = -1;

  //Ignore message from ourself
  if (signal.userID === user.userID) {
    console.log('Received from self');
    return;
  }
  peerNumber = peerNumberOf[signal.userID];

  if (peers[peerNumber].userID === signal.userID) {
    if (signal.type === 'sdp') {
      console.log('Got offer');
      peers[peerNumber].peerConnection.createAnswer().then((description) => {
        setAndSendDescription(description, peerNumber);
      });
    } else {
      console.log('Got answer');
    }
    } else if (signal.type === 'ice') {
      peers[peerNumber].peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice));
  }
}

function setupMediaStream(startStream, peerNumber) {
  const isFront = true;

  if (localStream !== undefined) {
    console.log('Reusing stream');
    shareStream(localStream, startStream, peerNumber);
  } else {
    if (Platform.OS === 'ios') {
      MediaStreamTrack.getSources((sourceInfos) => {
        console.log('sourceInfos: ', sourceInfos);

        for (let i = 0; i < sourceInfos.length; i++) {
          const sourceInfo = sourceInfos[i];
          if (sourceInfo.kind === 'video' && sourceInfo.facing === (isFront ? 'front' : 'back')) {
            videoSourceId = sourceInfo.id
          }
        }
      });
    }

    getUserMedia(
      {
      audio: true,
      video: {
        mandatory: {},
        facingMode: isFront ? 'user' : 'environment',
        optional: (videoSourceId ? [{ sourceId: videoSourceId }] : []),
      }
    }, (stream) => {
      console.log('Setting up stream');
      localStream = stream;
      videoURL = stream.toURL();
      this.setState({ videoURL: stream.toURL() });
      shareStream(stream, startStream, peerNumber);
    }
  );
  }
}

function joinRoom(peerNumber) {
  try {
    setupMediaStream(true, peerNumber);
  } catch (err) {
    console.log('Error: ', err);
  }
}


function shareStream(stream, startStream, peerNumber) {
  localStreams[peerNumber] = stream;

  if (startStream === false) {
    streamEng.onPublish(stream);
  }
  else {
    console.log('NOT ON PUBLISH');
    if (!peers[peerNumber]) {
      console.log('NOPE: ', peerNumber);
    }
    peers[peerNumber].peerConnection.addStream(localStreams[peerNumber]);
    peers[peerNumber].peerConnection.createOffer().then((description) => {
      setAndSetDescription(description, peerNumber);
    });
  }
}

function createPeerConnection(peerUserID, publisherNumber) {
  const newPeerConnection = new RTCPeerConnection(configOptions);

  newPeerConnection.onicecandidate = (event) => {
    console.log('onicecandidate')
    if (event.candidate !== null) {
      streamEng.socket.emit('signal', { type: 'ice', ice: event.candidate, userID: user.userID }, peerUserID, roomName);
    }
  };

  if (publisherNumber !== null) {
    newPeerConnection.onaddstream = (event) => {
      console.log('Received remote stream: ', event.stream);
      console.log('Adding stream to: ', publisherNumber);
      peers[peerNumberOf[peerUserID]].hasConnected = true;
    };
  }

  return newPeerConnection;
}

function setAndSetDescription(description, peerNumber) {
  peers[peerNumber].peerConnection.setLocalDescription(description).then(() => {
    streamEng.socket.emit('signal', {
      type: 'sdp',
      sdp: peers[peerNumber].peerConnection.localDescription,
      userID: user.userID
    }, peers[peerNumber].userID, roomName);
  });
}

class App extends Component {
  state = { roomNameInput: '' };


  componentWillMount() {
    }

  componentDidMount() {
    }


    onGoToChat() {
      const { roomNameInput, videoURL } = this.state;
      roomName = this.state.roomNameInput;
      console.log('Attempting to create a room');
      socket.emit('query rooms', '#' + this.state.roomNameInput);
      socket.on('query response', (exists, pin) => {
        console.log('Received response');
        console.log('Room exists: ');
        console.log(exists);
        console.log('Pin: ');
        console.log(pin);
        if (exists) {
          // Do something if room exists
          streamEng.setUpService();
        } else {
          // The room does not exist
        }
      });
    }

    getLocalStream() {
      const isFront = true;
      getUserMedia({
        audio: true,
        video: {
          mandatory: {},
          facingMode: isFront ? 'user' : 'environment',
        }
      },
      (stream) => {
        this.setState({ videoURL: stream.toURL() });
        localStream = stream;
      },
        err => console.error(err)
      );
    }

    publish() {
      setupMediaStream(false);

      socket.emit('publish', user.userID, roomName, pin);
        console.log('publish');
      }

  render() {
    return (
      <Card>

        <Header headerText='Rooms for Humanity' />

        <CardSection>
          <Input
          label='Room Name'
          placeholder='abc123'
          value={this.state.roomNameInput}
          onChangeText={roomNameInput => this.setState({ roomNameInput })}
          />
        </CardSection>

        <CardSection>
          <Button onPress={this.onGoToChat.bind(this)}>
            Go Live
          </Button>
        </CardSection>

        <CardSection>
          <Button onPress={this.publish.bind(this)}>
            Publish
          </Button>
        </CardSection>

        <CardSection>
          <Button onPress={this.getLocalStream.bind(this)}>
            Get Video
          </Button>
        </CardSection>

        <CardSection>
          <RTCView style={styles.rtc} streamURL={this.state.videoURL} />
        </CardSection>


      </Card>
    );
  }
}

const styles = {
  rtc: {
    height: 640,
    width: 320,
    flex: 1,
    backgroundColor: '#000'
  }
};

export default App;
